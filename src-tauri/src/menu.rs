use serde::{Deserialize, Serialize};
use tauri::{
    AppHandle, Emitter, Manager, Runtime,
    menu::{
        AboutMetadataBuilder, Menu, MenuBuilder, MenuId, MenuItemBuilder, PredefinedMenuItem,
        Submenu, SubmenuBuilder,
    },
};

use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MenuCommand {
    pub command: String,
    pub data: Option<serde_json::Value>,
}

pub fn create_menu<R: Runtime>(app: &AppHandle<R>) -> Result<Menu<R>, Box<dyn std::error::Error>> {
    let file_menu = create_file_menu(app)?;
    let edit_menu = create_edit_menu(app)?;
    let view_menu = create_view_menu(app)?;
    let window_menu = create_window_menu(app)?;
    let help_menu = create_help_menu(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[&file_menu, &edit_menu, &view_menu, &window_menu, &help_menu])
        .build()?;

    Ok(menu)
}

fn create_file_menu<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Submenu<R>, Box<dyn std::error::Error>> {
    let open_directory = MenuItemBuilder::with_id("open_directory", "Open Directory")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;

    let new_file = MenuItemBuilder::with_id("new_file", "New File")
        .accelerator("CmdOrCtrl+N")
        .build(app)?;

    let save = MenuItemBuilder::with_id("save", "Save")
        .accelerator("CmdOrCtrl+S")
        .build(app)?;

    let save_as = MenuItemBuilder::with_id("save_as", "Save As...")
        .accelerator("CmdOrCtrl+Shift+S")
        .build(app)?;

    let separator = PredefinedMenuItem::separator(app)?;

    // Recent directories submenu
    let recent_menu = create_recent_directories_menu(app)?;

    let separator2 = PredefinedMenuItem::separator(app)?;

    #[cfg(not(target_os = "macos"))]
    let quit = MenuItemBuilder::with_id("quit", "Quit")
        .accelerator("CmdOrCtrl+Q")
        .build(app)?;

    #[cfg(target_os = "macos")]
    let quit = PredefinedMenuItem::quit(app, None)?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .items(&[
            &open_directory,
            &new_file,
            &separator,
            &save,
            &save_as,
            &separator2,
            &recent_menu,
            &separator2,
            &quit,
        ])
        .build()?;

    Ok(file_menu)
}

fn create_recent_directories_menu<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Submenu<R>, Box<dyn std::error::Error>> {
    let recent_menu = SubmenuBuilder::new(app, "Recent Directories")
        .id(MenuId::from("recent_directories"))
        .build()?;

    Ok(recent_menu)
}

fn create_edit_menu<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Submenu<R>, Box<dyn std::error::Error>> {
    // Use predefined menu items for proper system clipboard integration
    let cut = PredefinedMenuItem::cut(app, None)?;
    let copy = PredefinedMenuItem::copy(app, None)?;
    let paste = PredefinedMenuItem::paste(app, None)?;
    let select_all = PredefinedMenuItem::select_all(app, None)?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .items(&[
            &cut,
            &copy,
            &paste,
            &PredefinedMenuItem::separator(app)?,
            &select_all,
        ])
        .build()?;

    Ok(edit_menu)
}

fn create_view_menu<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Submenu<R>, Box<dyn std::error::Error>> {
    let toggle_sidebar = MenuItemBuilder::with_id("toggle_sidebar", "Toggle Sidebar")
        .accelerator("CmdOrCtrl+B")
        .build(app)?;

    let separator = PredefinedMenuItem::separator(app)?;

    let zoom_in = MenuItemBuilder::with_id("zoom_in", "Zoom In")
        .accelerator("CmdOrCtrl+Plus")
        .build(app)?;

    let zoom_out = MenuItemBuilder::with_id("zoom_out", "Zoom Out")
        .accelerator("CmdOrCtrl+-")
        .build(app)?;

    let reset_zoom = MenuItemBuilder::with_id("reset_zoom", "Reset Zoom")
        .accelerator("CmdOrCtrl+0")
        .build(app)?;

    let separator2 = PredefinedMenuItem::separator(app)?;

    #[cfg(target_os = "macos")]
    let fullscreen = MenuItemBuilder::with_id("fullscreen", "Toggle Fullscreen")
        .accelerator("Ctrl+Cmd+F")
        .build(app)?;

    #[cfg(not(target_os = "macos"))]
    let fullscreen = MenuItemBuilder::with_id("fullscreen", "Toggle Fullscreen")
        .accelerator("F11")
        .build(app)?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .items(&[
            &toggle_sidebar,
            &separator,
            &zoom_in,
            &zoom_out,
            &reset_zoom,
            &separator2,
            &fullscreen,
        ])
        .build()?;

    Ok(view_menu)
}

fn create_window_menu<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Submenu<R>, Box<dyn std::error::Error>> {
    #[cfg(target_os = "macos")]
    let minimize = PredefinedMenuItem::minimize(app, None)?;

    #[cfg(not(target_os = "macos"))]
    let minimize = MenuItemBuilder::with_id("minimize", "Minimize")
        .accelerator("CmdOrCtrl+M")
        .build(app)?;

    #[cfg(target_os = "macos")]
    let close_window = PredefinedMenuItem::close_window(app, None)?;

    #[cfg(not(target_os = "macos"))]
    let close_window = MenuItemBuilder::with_id("close_window", "Close Window")
        .accelerator("CmdOrCtrl+W")
        .build(app)?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .items(&[&minimize, &close_window])
        .build()?;

    Ok(window_menu)
}

fn create_help_menu<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Submenu<R>, Box<dyn std::error::Error>> {
    let keyboard_shortcuts =
        MenuItemBuilder::with_id("keyboard_shortcuts", "Keyboard Shortcuts").build(app)?;

    let separator = PredefinedMenuItem::separator(app)?;

    let about = PredefinedMenuItem::about(
        app,
        Some("About ExcaliApp"),
        Some(
            AboutMetadataBuilder::new()
                .version(Some(env!("CARGO_PKG_VERSION").to_string()))
                .authors(Some(vec!["ExcaliApp Team".to_string()]))
                .comments(Some(
                    "A native Excalidraw desktop application built with Tauri".to_string(),
                ))
                .build(),
        ),
    )?;

    let help_menu = SubmenuBuilder::new(app, "Help")
        .items(&[&keyboard_shortcuts, &separator, &about])
        .build()?;

    Ok(help_menu)
}

pub fn update_recent_directories_menu<R: Runtime>(
    app: &AppHandle<R>,
    recent_dirs: Vec<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    // Get the main window
    let window = app.get_webview_window("main").ok_or("No main window")?;

    // Get the menu
    if let Some(menu) = window.menu() {
        // Find the recent directories submenu
        if let Some(recent_menu) = menu.get("recent_directories") {
            if let Some(submenu) = recent_menu.as_submenu() {
                // Clear existing items
                let items = submenu.items()?;
                for item in items {
                    submenu.remove(&item)?;
                }

                // Add new items
                for (index, dir) in recent_dirs.iter().enumerate().take(10) {
                    let shortened_path = shorten_path(dir, 50);
                    let item =
                        MenuItemBuilder::with_id(format!("recent_dir_{}", index), shortened_path)
                            .build(app)?;
                    submenu.append(&item)?;
                }

                // Add separator and clear item if there are recent directories
                if !recent_dirs.is_empty() {
                    let separator = PredefinedMenuItem::separator(app)?;
                    submenu.append(&separator)?;

                    let clear_item =
                        MenuItemBuilder::with_id("clear_recent", "Clear Recent").build(app)?;
                    submenu.append(&clear_item)?;
                }
            }
        }
    }

    Ok(())
}

fn shorten_path(path: &str, max_len: usize) -> String {
    if path.len() <= max_len {
        return path.to_string();
    }

    let components: Vec<&str> = path.split(std::path::MAIN_SEPARATOR).collect();
    if components.len() <= 3 {
        return format!("...{}", &path[path.len() - max_len + 3..]);
    }

    let first = components[0];
    let last_two = &components[components.len() - 2..];
    let shortened = format!(
        "{}{}...{}{}",
        first,
        std::path::MAIN_SEPARATOR,
        std::path::MAIN_SEPARATOR,
        last_two.join(std::path::MAIN_SEPARATOR_STR)
    );

    if shortened.len() > max_len {
        format!("...{}", &path[path.len() - max_len + 3..])
    } else {
        shortened
    }
}

pub fn setup_menu_event_handler<R: Runtime>(app: &AppHandle<R>) {
    let app_handle = app.clone();

    app.on_menu_event(move |_app, event| {
        let menu_id = event.id.as_ref();

        // Emit menu command to frontend
        let command = MenuCommand {
            command: menu_id.to_string(),
            data: None,
        };

        if menu_id.starts_with("recent_dir_") {
            // Extract the index and get the directory path
            if let Some(_state) = app_handle.try_state::<AppState>() {
                // Get preferences to access recent directories
                let app_handle_clone = app_handle.clone();
                let menu_id_clone = menu_id.to_string();
                let command_clone = command.clone();

                tauri::async_runtime::spawn(async move {
                    // Get preferences from store directly
                    use tauri_plugin_store::StoreExt;
                    if let Ok(store) = app_handle_clone.store("preferences.json") {
                        if let Some(value) = store.get("preferences") {
                            if let Ok(prefs) =
                                serde_json::from_value::<crate::Preferences>(value.clone())
                            {
                                if let Some(index_str) = menu_id_clone.strip_prefix("recent_dir_") {
                                    if let Ok(index) = index_str.parse::<usize>() {
                                        if let Some(dir) = prefs.recent_directories.get(index) {
                                            let mut command = command_clone;
                                            command.data =
                                                Some(serde_json::json!({ "directory": dir }));
                                            let _ = app_handle_clone.emit("menu-command", command);
                                        }
                                    }
                                }
                            }
                        }
                    }
                });
            }
        } else {
            let _ = app_handle.emit("menu-command", command);
        }
    });
}

#[allow(dead_code)]
pub fn update_menu_item_state<R: Runtime>(
    app: &AppHandle<R>,
    item_id: &str,
    enabled: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let window = app.get_webview_window("main").ok_or("No main window")?;

    if let Some(menu) = window.menu() {
        if let Some(item) = menu.get(item_id) {
            if let Some(menu_item) = item.as_menuitem() {
                menu_item.set_enabled(enabled)?;
            }
        }
    }

    Ok(())
}
