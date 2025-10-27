# Feature: Folder Creation

## Overview
Add the ability for users to create new folders within the file browser sidebar, enabling better organization of Excalidraw files. Currently, users can only create new files but cannot organize them into folders without using external file managers.

## Requirements

### Functional Requirements
- **REQ-1**: User can create a new folder from the sidebar
- **REQ-2**: Default folder naming follows pattern: `New Folder-{timestamp}`
- **REQ-3**: System prevents duplicate folder names by appending numbers
- **REQ-4**: Created folders appear immediately in the file tree
- **REQ-5**: Keyboard shortcut `Cmd/Ctrl+Shift+N` creates new folder
- **REQ-6**: Folder names are sanitized to prevent path traversal attacks
- **REQ-7**: Users must select a directory before creating folders

### Non-Functional Requirements
- **Performance**: Folder creation completes in <100ms
- **Security**: All folder names validated and sanitized
- **Usability**: UI clearly distinguishes between "New File" and "New Folder"

## Architecture

### High-Level Design
```
┌─────────────────────────────────────────┐
│         Sidebar Component               │
│  ┌────────────┐   ┌─────────────┐     │
│  │ New File   │   │ New Folder  │     │
│  │  Button    │   │   Button    │     │
│  └─────┬──────┘   └──────┬──────┘     │
│        │                  │             │
└────────┼──────────────────┼─────────────┘
         │                  │
         └────────┬─────────┘
                  │
         ┌────────▼─────────┐
         │  Zustand Store   │
         │ createNewFolder()│
         └────────┬─────────┘
                  │ IPC
         ┌────────▼─────────┐
         │ Tauri Command    │
         │create_new_folder │
         └────────┬─────────┘
                  │
         ┌────────▼─────────┐
         │ Security Layer   │
         │  - validate_path │
         │  - safe_join     │
         └────────┬─────────┘
                  │
         ┌────────▼─────────┐
         │  File System     │
         │ fs::create_dir   │
         └──────────────────┘
```

### Interfaces

#### Tauri Command
```rust
#[tauri::command]
async fn create_new_folder(
    directory: String,
    folder_name: String
) -> Result<String, String>
```

**Parameters:**
- `directory`: Parent directory path (absolute)
- `folder_name`: Desired folder name (will be sanitized)

**Returns:**
- `Ok(String)`: Absolute path to created folder
- `Err(String)`: Error message

#### Store Action
```typescript
createNewFolder: (folderName?: string) => Promise<void>
```

**Behavior:**
- Generates default name if `folderName` not provided
- Checks current directory is selected
- Invokes Tauri command
- Reloads file tree to show new folder

### Data Models
No new data models required. Uses existing:
- `FileTreeNode` - Will automatically include new folders
- Directory path tracking in store

## Implementation Steps

1. **Backend Implementation (Rust)**
   - Add `create_new_folder()` command to `lib.rs`
   - Validate directory path using `security::validate_path()`
   - Use `security::safe_path_join()` to sanitize folder name
   - Handle duplicate names with counter suffix
   - Use `fs::create_dir()` for folder creation
   - Verify folder was created successfully
   - Register command in invoke handler

2. **State Management (TypeScript)**
   - Add `createNewFolder()` action to `useStore.ts`
   - Generate timestamp-based default name
   - Validate current directory is selected
   - Invoke Tauri command with parameters
   - Reload file tree after creation
   - Handle errors with user-friendly messages

3. **UI Implementation (Sidebar)**
   - Add "New Folder" button below "New File" button
   - Use `FolderPlus` icon from lucide-react
   - Disable button when no directory selected
   - Add tooltip explaining functionality
   - Match styling of existing "New File" button

4. **Menu Integration**
   - Add "New Folder" menu item to File menu
   - Assign keyboard shortcut `Cmd/Ctrl+Shift+N`
   - Handle menu event in frontend
   - Emit menu-command event from backend

## Testing Strategy

### Unit Tests
- **Security validation**: Test `safe_path_join()` with malicious inputs
  - `"../../../etc"` should be sanitized
  - `"test/../secret"` should be sanitized
  - `"folder/with/slashes"` should replace slashes with underscores
- **Duplicate naming**: Create folder multiple times, verify counter increments
- **Invalid directory**: Test error when directory doesn't exist

### Integration Tests
- **End-to-end flow**: Select directory → create folder → verify in file tree
- **Multiple folders**: Create several folders with same base name
- **Edge cases**:
  - No directory selected (should prompt or show error)
  - Long folder names (should handle gracefully)
  - Special characters in names (should sanitize)
  - Read-only directory (should show permission error)

### Manual Testing
- Create folder in root directory
- Create nested folders (folder within folder via external tools, then create within app)
- Verify file tree updates immediately
- Test keyboard shortcut
- Test menu item
- Verify on macOS, Windows, Linux

## Acceptance Criteria

- [ ] "New Folder" button appears in sidebar below "New File"
- [ ] Button disabled when no directory selected
- [ ] Clicking button creates folder with default name pattern
- [ ] Duplicate folder names automatically get counter suffix
- [ ] Created folders appear immediately in file tree
- [ ] Keyboard shortcut `Cmd/Ctrl+Shift+N` creates folder
- [ ] File menu has "New Folder" item
- [ ] Folder names are sanitized (no path traversal possible)
- [ ] Error messages displayed for failures (permissions, etc.)
- [ ] Performance: Folder creation completes in <100ms
- [ ] Works on all platforms (macOS, Windows, Linux)

## Security Considerations

### Path Traversal Prevention
- All folder names passed through `safe_path_join()`
- Removes `..`, `/`, `\` characters
- Validates final path is within parent directory
- Uses canonical paths for comparison

### Input Validation
- Empty folder names rejected
- Maximum length enforced (OS limits)
- Reserved names prevented (e.g., ".", "..", "CON", "PRN" on Windows)

### Permission Handling
- Gracefully handle permission denied errors
- Show user-friendly error messages
- Don't expose internal file system paths in errors

## Future Enhancements (Out of Scope)
- Rename folder functionality
- Delete folder functionality (with confirmation)
- Folder context menu in tree view
- Drag-and-drop files into folders
- Nested folder creation (e.g., "parent/child" creates both)
