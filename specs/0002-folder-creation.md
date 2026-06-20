# Feature: Folder Management

## Overview
Add first-class folder management to the file browser sidebar so users can organize Excalidraw files without switching to an external file manager.

## Functional Requirements
- Users can create a folder at the selected workspace root from the sidebar or File menu.
- Users can create a file or folder inside any existing folder from the tree context menu.
- Users can rename folders from the tree context menu.
- Users can delete folders from the tree context menu after confirmation.
- Deleting a folder closes any open tabs for files inside that folder.
- Renaming a folder updates open tab paths for files inside that folder.
- Folder deletion warns when the folder contains unsaved open files.
- Empty folders appear in the file tree immediately after creation.
- `Cmd/Ctrl+Shift+N` creates a new folder.
- User-entered file names are normalized to `.excalidraw`.
- File and folder names are sanitized to prevent path traversal.

## Architecture

### Backend Commands
```rust
#[tauri::command]
async fn create_new_folder(directory: String, folder_name: String) -> Result<String, String>

#[tauri::command]
async fn rename_folder(old_path: String, new_name: String) -> Result<String, String>

#[tauri::command]
async fn delete_folder(folder_path: String) -> Result<(), String>
```

The backend validates existing paths, sanitizes user-provided names with `safe_path_join`, rejects invalid folder targets, and uses Rust filesystem operations for creation, rename, and recursive deletion.

### Store Actions
```typescript
createNewFile(fileName?: string, directory?: string): Promise<void>
createNewFolder(folderName?: string, directory?: string): Promise<void>
renameFolder(oldPath: string, newName: string): Promise<void>
deleteFolder(folderPath: string): Promise<boolean>
```

The store handles directory selection fallback, file-tree refreshes, open-tab path rewrites after folder rename, and open-tab cleanup after folder delete.

### UI
- Sidebar buttons create root-level files and folders with user-provided names.
- Folder context menu supports `New File`, `New Folder`, `Rename`, and `Delete`.
- File context menu continues to support `Rename` and `Delete`.
- Inline rename supports Escape cancellation without submitting stale input.

## Acceptance Criteria
- [x] Root-level folder creation is available from the sidebar and File menu.
- [x] Nested file and folder creation is available from folder context menus.
- [x] Folder rename works and preserves open tab state.
- [x] Folder delete works recursively and closes affected tabs.
- [x] Folder delete warns before discarding unsaved affected tabs.
- [x] Empty folders remain visible in the tree.
- [x] Duplicate folder and file names are resolved by backend suffixing.
- [x] User-entered bare file names become `.excalidraw` files.
- [x] Path separators and traversal segments in names are sanitized.
- [x] TypeScript and Rust checks pass.

## Out Of Scope
- Drag-and-drop moving files between folders.
- Multi-select bulk operations.
- Undo for filesystem operations.
