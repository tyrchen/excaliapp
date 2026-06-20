use std::path::{Path, PathBuf};

/// Validates that a path is safe to access (no path traversal attacks)
pub fn validate_path(path: &Path, allowed_base: Option<&Path>) -> Result<PathBuf, String> {
    // Canonicalize the path to resolve symlinks and relative components
    let canonical_path = path
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize path: {}", e))?;

    // If an allowed base directory is specified, ensure the path is within it
    if let Some(base) = allowed_base {
        let canonical_base = base
            .canonicalize()
            .map_err(|e| format!("Failed to canonicalize base path: {}", e))?;

        if !canonical_path.starts_with(&canonical_base) {
            return Err("Path traversal detected: path is outside allowed directory".to_string());
        }
    }

    // Check that the path doesn't contain suspicious patterns
    let path_str = canonical_path.to_string_lossy();
    if path_str.contains("..") || path_str.contains("~") {
        return Err("Path contains suspicious patterns".to_string());
    }

    Ok(canonical_path)
}

/// Validates that a file has the expected .excalidraw extension
pub fn validate_excalidraw_file(path: &Path) -> Result<(), String> {
    match path.extension() {
        Some(ext) if ext == "excalidraw" => Ok(()),
        Some(ext) => Err(format!(
            "Invalid file extension: expected .excalidraw, got .{}",
            ext.to_string_lossy()
        )),
        None => Err("File has no extension".to_string()),
    }
}

/// Validates JSON content to ensure it's a valid Excalidraw file
pub fn validate_excalidraw_content(content: &str) -> Result<(), String> {
    let json: serde_json::Value =
        serde_json::from_str(content).map_err(|e| format!("Invalid JSON: {}", e))?;

    // Check for required Excalidraw fields
    let obj = json.as_object().ok_or("Content is not a JSON object")?;

    // Validate type field
    match obj.get("type") {
        Some(t) if t == "excalidraw" => {}
        Some(t) => {
            return Err(format!(
                "Invalid type field: expected 'excalidraw', got {:?}",
                t
            ));
        }
        None => return Err("Missing required 'type' field".to_string()),
    }

    // Validate version field
    match obj.get("version") {
        Some(v) if v.is_number() => {}
        Some(_) => return Err("Version field must be a number".to_string()),
        None => return Err("Missing required 'version' field".to_string()),
    }

    // Validate elements field
    match obj.get("elements") {
        Some(e) if e.is_array() => {}
        Some(_) => return Err("Elements field must be an array".to_string()),
        None => return Err("Missing required 'elements' field".to_string()),
    }

    Ok(())
}

/// Safely joins a filename to a directory path
pub fn safe_path_join(base: &Path, file_name: &str) -> Result<PathBuf, String> {
    // Remove any path separators from the filename to prevent directory traversal
    let clean_name = file_name
        .replace('/', "_")
        .replace('\\', "_")
        .replace("..", "_");

    if clean_name.is_empty() {
        return Err("Invalid filename".to_string());
    }

    Ok(base.join(clean_name))
}
