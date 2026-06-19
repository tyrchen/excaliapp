mod menu;
mod security;

use notify::{Event, EventKind, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExcalidrawFile {
    pub name: String,
    pub path: String,
    pub modified: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileTreeNode {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub modified: bool,
    pub children: Option<Vec<FileTreeNode>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Preferences {
    pub last_directory: Option<String>,
    pub recent_directories: Vec<String>,
    pub theme: String,
    pub sidebar_visible: bool,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            last_directory: None,
            recent_directories: Vec::new(),
            theme: "system".to_string(),
            sidebar_visible: true,
        }
    }
}

pub struct AppState {
    pub current_directory: Mutex<Option<PathBuf>>,
    pub modified_files: Mutex<Vec<String>>,
}

#[tauri::command]
async fn select_directory(app: AppHandle) -> Result<Option<String>, String> {
    use std::sync::mpsc;
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = mpsc::channel();

    app.dialog().file().pick_folder(move |path| {
        let _ = tx.send(path);
    });

    match rx.recv() {
        Ok(Some(path)) => Ok(Some(path.to_string())),
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn list_excalidraw_files(directory: String) -> Result<Vec<ExcalidrawFile>, String> {
    let path = Path::new(&directory);

    if !path.exists() {
        return Err("Directory does not exist".to_string());
    }

    let mut files = Vec::new();
    collect_excalidraw_files_recursive(path, &mut files)?;
    files.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(files)
}

#[tauri::command]
async fn get_file_tree(directory: String) -> Result<Vec<FileTreeNode>, String> {
    let path = Path::new(&directory);

    if !path.exists() {
        return Err("Directory does not exist".to_string());
    }

    let mut tree = Vec::new();
    build_file_tree(path, &mut tree)?;
    tree.sort_by(|a, b| match (a.is_directory, b.is_directory) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.cmp(&b.name),
    });
    Ok(tree)
}

fn collect_excalidraw_files_recursive(
    dir: &Path,
    files: &mut Vec<ExcalidrawFile>,
) -> Result<(), String> {
    match fs::read_dir(dir) {
        Ok(entries) => {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(extension) = path.extension() {
                        if extension == "excalidraw" {
                            if let Some(file_name) = path.file_name() {
                                files.push(ExcalidrawFile {
                                    name: file_name.to_string_lossy().to_string(),
                                    path: path.to_string_lossy().to_string(),
                                    modified: false,
                                });
                            }
                        }
                    }
                } else if path.is_dir() {
                    collect_excalidraw_files_recursive(&path, files)?;
                }
            }
        }
        Err(e) => return Err(e.to_string()),
    }
    Ok(())
}

fn build_file_tree(dir: &Path, tree: &mut Vec<FileTreeNode>) -> Result<(), String> {
    match fs::read_dir(dir) {
        Ok(entries) => {
            for entry in entries.flatten() {
                let path = entry.path();
                let name = path
                    .file_name()
                    .ok_or("Invalid file name")?
                    .to_string_lossy()
                    .to_string();

                if path.is_dir() {
                    let mut children = Vec::new();
                    build_file_tree(&path, &mut children)?;

                    // Only include directories that contain .excalidraw files (directly or in subdirs)
                    if has_excalidraw_files(&path)? {
                        children.sort_by(|a, b| match (a.is_directory, b.is_directory) {
                            (true, false) => std::cmp::Ordering::Less,
                            (false, true) => std::cmp::Ordering::Greater,
                            _ => a.name.cmp(&b.name),
                        });

                        tree.push(FileTreeNode {
                            name,
                            path: path.to_string_lossy().to_string(),
                            is_directory: true,
                            modified: false,
                            children: Some(children),
                        });
                    }
                } else if path.is_file() {
                    if let Some(extension) = path.extension() {
                        if extension == "excalidraw" {
                            tree.push(FileTreeNode {
                                name,
                                path: path.to_string_lossy().to_string(),
                                is_directory: false,
                                modified: false,
                                children: None,
                            });
                        }
                    }
                }
            }
        }
        Err(e) => return Err(e.to_string()),
    }
    Ok(())
}

fn has_excalidraw_files(dir: &Path) -> Result<bool, String> {
    match fs::read_dir(dir) {
        Ok(entries) => {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(extension) = path.extension() {
                        if extension == "excalidraw" {
                            return Ok(true);
                        }
                    }
                } else if path.is_dir() && has_excalidraw_files(&path)? {
                    return Ok(true);
                }
            }
        }
        Err(e) => return Err(e.to_string()),
    }
    Ok(false)
}

#[tauri::command]
async fn read_file(file_path: String) -> Result<String, String> {
    // Validate path to prevent traversal attacks
    let path = Path::new(&file_path);
    let validated_path = security::validate_path(path, None)?;
    
    // Validate it's an excalidraw file
    security::validate_excalidraw_file(&validated_path)?;
    
    // Read and validate content
    let content = fs::read_to_string(&validated_path)
        .map_err(|e| e.to_string())?;
    
    // Validate the content is valid Excalidraw JSON
    security::validate_excalidraw_content(&content)?;
    
    Ok(content)
}

#[tauri::command]
async fn save_file(file_path: String, content: String) -> Result<(), String> {
    // Validate path to prevent traversal attacks
    let path = Path::new(&file_path);
    let validated_path = security::validate_path(path, None)?;
    
    // Validate it's an excalidraw file
    security::validate_excalidraw_file(&validated_path)?;
    
    // Validate the content before saving
    security::validate_excalidraw_content(&content)?;
    
    fs::write(&validated_path, content)
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn save_file_as(app: AppHandle, content: String) -> Result<Option<String>, String> {
    use std::sync::mpsc;
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = mpsc::channel();

    app.dialog()
        .file()
        .add_filter("Excalidraw", &["excalidraw"])
        .set_title("Save As")
        .save_file(move |path| {
            let _ = tx.send(path);
        });

    match rx.recv() {
        Ok(Some(path)) => {
            let path_str = path.to_string();
            match fs::write(&path_str, content) {
                Ok(_) => Ok(Some(path_str)),
                Err(e) => Err(e.to_string()),
            }
        }
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn create_new_file(directory: String, file_name: String) -> Result<String, String> {
    println!(
        "[create_new_file] Called with directory: {}, file_name: {}",
        directory, file_name
    );

    // Validate and canonicalize the directory path
    let dir_path = Path::new(&directory);
    let validated_dir = security::validate_path(dir_path, None)?;
    
    if !validated_dir.is_dir() {
        return Err(format!("Path is not a directory: {}", directory));
    }

    // Safely join the filename to the directory
    let mut path = security::safe_path_join(&validated_dir, &file_name)?;
    println!("[create_new_file] Initial path: {:?}", path);

    // Check if file already exists and suggest alternative
    if path.exists() {
        println!("[create_new_file] File already exists, finding unique name");
        // Find a unique name by appending numbers
        let mut counter = 1;

        // Get the base name without extension
        let stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .ok_or("Invalid file name")?
            .to_string(); // Convert to owned String

        // Handle the .excalidraw extension properly
        let base_stem = if stem.ends_with(".excalidraw") {
            stem.trim_end_matches(".excalidraw").to_string()
        } else {
            stem
        };

        loop {
            let new_name = format!("{}-{}.excalidraw", base_stem, counter);
            path = dir_path.join(&new_name);

            if !path.exists() {
                println!("[create_new_file] Found unique name: {:?}", path);
                break;
            }
            counter += 1;

            if counter > 100 {
                return Err("Could not find unique file name".to_string());
            }
        }
    }

    let default_content = serde_json::json!({
        "type": "excalidraw",
        "version": 2,
        "source": "ExcaliApp",
        "elements": [],
        "appState": {
            "gridSize": null,
            "viewBackgroundColor": "#ffffff"
        },
        "files": {}
    });

    let content_str = serde_json::to_string_pretty(&default_content)
        .map_err(|e| format!("Failed to serialize content: {}", e))?;

    println!("[create_new_file] Writing to path: {:?}", path);
    match fs::write(&path, &content_str) {
        Ok(_) => {
            println!("[create_new_file] Successfully created file: {:?}", path);

            // Verify the file was created
            if !path.exists() {
                eprintln!("[create_new_file] File doesn't exist after creation!");
                return Err("File creation verification failed".to_string());
            }

            // Verify we can read it back
            match fs::read_to_string(&path) {
                Ok(read_content) => {
                    println!(
                        "[create_new_file] File verified, content length: {}",
                        read_content.len()
                    );
                }
                Err(e) => {
                    eprintln!(
                        "[create_new_file] Warning: Could not verify file content: {}",
                        e
                    );
                }
            }

            Ok(path.to_string_lossy().to_string())
        }
        Err(e) => {
            eprintln!("[create_new_file] Failed to create file: {}", e);
            Err(format!("Failed to create file: {}", e))
        }
    }
}

#[tauri::command]
async fn get_preferences(app: AppHandle) -> Result<Preferences, String> {
    use tauri_plugin_store::StoreExt;

    let store = app.store("preferences.json").map_err(|e| e.to_string())?;

    let prefs = if let Some(value) = store.get("preferences") {
        // Try to deserialize, but ensure all fields have values
        match serde_json::from_value::<Preferences>(value.clone()) {
            Ok(mut p) => {
                // Ensure recent_directories is never None/null
                if p.recent_directories.is_empty() {
                    p.recent_directories = Vec::new();
                }
                p
            }
            Err(_) => Preferences::default(),
        }
    } else {
        Preferences::default()
    };

    Ok(prefs)
}

#[tauri::command]
async fn rename_file(old_path: String, new_name: String) -> Result<String, String> {
    // Validate the old path
    let old_path = Path::new(&old_path);
    let validated_old = security::validate_path(old_path, None)?;
    
    if !validated_old.exists() {
        return Err("File does not exist".to_string());
    }
    
    security::validate_excalidraw_file(&validated_old)?;

    let parent = validated_old.parent().ok_or("Invalid file path")?;
    
    // Safely create the new path
    let new_path = security::safe_path_join(parent, &new_name)?;
    
    // Ensure the new path also has .excalidraw extension
    let new_path = if new_path.extension() != Some(std::ffi::OsStr::new("excalidraw")) {
        new_path.with_extension("excalidraw")
    } else {
        new_path
    };

    if new_path.exists() && new_path != old_path {
        return Err("A file with that name already exists".to_string());
    }

    // CRITICAL FIX: Read the content first, then write to new file, then delete old
    // This prevents data loss if something goes wrong
    println!("Renaming file from {:?} to {:?}", old_path, new_path);

    // Step 1: Read the original file content
    let content = match fs::read_to_string(old_path) {
        Ok(content) => {
            println!(
                "Successfully read original file, content length: {}",
                content.len()
            );
            content
        }
        Err(e) => {
            eprintln!("Failed to read original file: {}", e);
            return Err(format!("Failed to read original file: {}", e));
        }
    };

    // Step 2: Write content to the new file
    match fs::write(&new_path, &content) {
        Ok(_) => {
            println!("Successfully wrote content to new file");
        }
        Err(e) => {
            eprintln!("Failed to write to new file: {}", e);
            return Err(format!("Failed to create new file: {}", e));
        }
    }

    // Step 3: Verify the new file exists and has content
    match fs::read_to_string(&new_path) {
        Ok(new_content) => {
            if new_content != content {
                eprintln!("Warning: New file content doesn't match original!");
                // Delete the corrupted new file
                let _ = fs::remove_file(&new_path);
                return Err("File content verification failed".to_string());
            }
            println!("New file verified successfully");
        }
        Err(e) => {
            eprintln!("Failed to verify new file: {}", e);
            // Delete the potentially corrupted new file
            let _ = fs::remove_file(&new_path);
            return Err(format!("Failed to verify new file: {}", e));
        }
    }

    // Step 4: Only delete the original file after successful verification
    match fs::remove_file(old_path) {
        Ok(_) => {
            println!("Successfully deleted original file");
            Ok(new_path.to_string_lossy().to_string())
        }
        Err(e) => {
            eprintln!("Warning: Failed to delete original file: {}", e);
            // The rename was successful, but cleanup failed
            // Return success but log the warning
            Ok(new_path.to_string_lossy().to_string())
        }
    }
}

#[tauri::command]
async fn delete_file(file_path: String) -> Result<(), String> {
    // Validate path to prevent traversal attacks
    let path = Path::new(&file_path);
    let validated_path = security::validate_path(path, None)?;
    
    if !validated_path.exists() {
        return Err("File does not exist".to_string());
    }
    
    // Ensure we're only deleting excalidraw files
    security::validate_excalidraw_file(&validated_path)?;

    fs::remove_file(&validated_path)
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn save_preferences(app: AppHandle, preferences: Preferences) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;

    let store = app.store("preferences.json").map_err(|e| e.to_string())?;

    store.set("preferences", serde_json::to_value(&preferences).unwrap());
    store.save().map_err(|e| e.to_string())?;

    // Update recent directories menu
    let _ = menu::update_recent_directories_menu(&app, preferences.recent_directories.clone());

    Ok(())
}

#[tauri::command]
async fn force_close_app(app: AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

#[tauri::command]
async fn watch_directory(
    app: AppHandle,
    directory: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let path = PathBuf::from(&directory);

    {
        let mut current_dir = state.current_directory.lock().unwrap();
        *current_dir = Some(path.clone());
    }

    // Set up file watcher
    let app_handle = app.clone();
    let (tx, rx) = std::sync::mpsc::channel();

    let mut watcher = notify::recommended_watcher(tx).map_err(|e| e.to_string())?;

    watcher
        .watch(&path, RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    // Spawn a thread to handle file system events
    std::thread::spawn(move || loop {
        match rx.recv() {
            Ok(Ok(Event {
                kind: EventKind::Create(_) | EventKind::Remove(_) | EventKind::Modify(_),
                paths,
                ..
            })) => {
                for path in paths {
                    if let Some(extension) = path.extension() {
                        if extension == "excalidraw" {
                            let _ = app_handle.emit("file-system-change", &path);
                        }
                    }
                }
            }
            Ok(Err(e)) => eprintln!("Watch error: {:?}", e),
            Err(e) => {
                eprintln!("Watch channel error: {:?}", e);
                break;
            }
            _ => {}
        }
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            app.manage(AppState {
                current_directory: Mutex::new(None),
                modified_files: Mutex::new(Vec::new()),
            });

            // Create and set up the menu
            let menu = menu::create_menu(app.handle())?;
            app.set_menu(menu)?;
            menu::setup_menu_event_handler(app.handle());

            // Load preferences and update recent directories menu
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                use tauri_plugin_store::StoreExt;
                if let Ok(store) = app_handle.store("preferences.json") {
                    if let Some(value) = store.get("preferences") {
                        if let Ok(prefs) = serde_json::from_value::<Preferences>(value.clone()) {
                            let _ = menu::update_recent_directories_menu(
                                &app_handle,
                                prefs.recent_directories,
                            );
                        }
                    }
                }
            });

            // Add window close handler
            let window = app.get_webview_window("main").unwrap();
            let window_clone = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    // Prevent default close
                    api.prevent_close();
                    
                    // Emit event to frontend to check for unsaved changes
                    let _ = window_clone.emit("check-unsaved-before-close", ());
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            select_directory,
            list_excalidraw_files,
            get_file_tree,
            read_file,
            save_file,
            save_file_as,
            create_new_file,
            rename_file,
            delete_file,
            get_preferences,
            save_preferences,
            watch_directory,
            force_close_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
