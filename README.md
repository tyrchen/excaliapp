# ExcaliApp - Excalidraw Desktop Editor

A free, open-source desktop application for managing and editing local Excalidraw files. Built with Tauri for a native desktop experience while maintaining the familiar Excalidraw interface. See [中文说明](README-zh.md) for Chinese users.

![excaliapp](docs/images/excaliapp.jpg)

## Features

- 📁 **Local File Management**: Browse and organize your Excalidraw files directly from your filesystem
- 🎨 **Full Excalidraw Editor**: Complete drawing and diagramming capabilities with the official Excalidraw editor
- 💾 **Auto-Save**: Never lose your work with automatic saving every 30 seconds
- 🚀 **Fast File Switching**: Quickly navigate between multiple drawings
- 🌲 **Tree View Navigation**: Hierarchical file browser for better organization
- 🎯 **Native Menus**: Platform-specific menus with keyboard shortcuts
- 🌓 **Theme Support**: Light, dark, and system theme options
- 🔒 **Security First**: Path validation and content sanitization for safe file operations

## Installation

### Download Pre-built Binaries

*Coming soon - Pre-built binaries will be available in the Releases section*

### Build from Source

#### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Rust](https://www.rust-lang.org/) (latest stable)
- Platform-specific development tools:
  - **Windows**: Visual Studio Build Tools
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `build-essential`, `libwebkit2gtk-4.1-dev`, `libssl-dev`

#### Build Steps

```bash
# Clone the repository
git clone https://github.com/yourusername/excaliapp.git
cd excaliapp

# Install dependencies
npm install

# Development mode with hot reload
npm run tauri dev

# Build for production
npm run tauri build
```

The built application will be in `src-tauri/target/release/bundle/`

## Usage

### Getting Started

1. **Launch the Application**: Open ExcaliApp from your applications folder or run the executable

2. **Select a Directory**:
   - On first launch, you'll be prompted to select a folder containing your Excalidraw files
   - The app remembers your last selected directory for future sessions
   - Use `File → Open Directory` (Ctrl/Cmd+O) to change directories anytime

3. **Create or Edit Files**:
   - Click "New File" or use `File → New File` (Ctrl/Cmd+N) to create a new drawing
   - Click any file in the sidebar to open it for editing
   - Your changes are automatically saved every 30 seconds

4. **Navigate Between Files**:
   - Use the tree view sidebar to browse your file structure
   - Click on folders to expand/collapse them
   - Files are sorted with folders first, then alphabetically

### Keyboard Shortcuts

| Action         | Windows/Linux | macOS       |
| -------------- | ------------- | ----------- |
| New File       | Ctrl+N        | Cmd+N       |
| Open Directory | Ctrl+O        | Cmd+O       |
| Save           | Ctrl+S        | Cmd+S       |
| Save As        | Ctrl+Shift+S  | Cmd+Shift+S |
| Toggle Sidebar | Ctrl+B        | Cmd+B       |
| Quit           | Ctrl+Q        | Cmd+Q       |

### File Operations

- **Create**: Click "New File" button or use menu/shortcut
- **Rename**: Right-click on a file and select "Rename"
- **Delete**: Right-click on a file and select "Delete"
- **Auto-save**: Files are automatically saved every 30 seconds and when switching between files

## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Frontend (Web Technologies)"
        UI[React UI]
        EX[Excalidraw Editor]
        SM[State Management]
        UI --> EX
        UI --> SM
    end

    subgraph "Tauri Bridge"
        IPC[IPC Commands]
        EV[Event System]
    end

    subgraph "Backend (Rust)"
        FM[File Manager]
        SEC[Security Layer]
        PREF[Preferences Store]
        MENU[Native Menu]
        FS[File System]
        FM --> SEC
        FM --> FS
    end

    UI <--> IPC
    SM <--> IPC
    IPC <--> FM
    IPC <--> PREF
    EV --> UI
    FS --> EV
    MENU --> IPC
```

### Component Interaction Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as React UI
    participant IPC as Tauri IPC
    participant Rust as Rust Backend
    participant FS as File System

    User->>UI: Select file from sidebar
    UI->>IPC: invoke('read_file', {path})
    IPC->>Rust: read_file command
    Rust->>Rust: Validate path security
    Rust->>FS: Read file content
    FS-->>Rust: File data
    Rust->>Rust: Validate JSON content
    Rust-->>IPC: Return content
    IPC-->>UI: File content
    UI->>UI: Load in Excalidraw editor

    User->>UI: Edit drawing
    UI->>UI: Auto-save timer (30s)
    UI->>IPC: invoke('save_file', {path, content})
    IPC->>Rust: save_file command
    Rust->>Rust: Validate path & content
    Rust->>FS: Write file
    FS-->>Rust: Success
    Rust-->>IPC: Success response
    IPC-->>UI: Save confirmed
    UI->>UI: Update status
```

### Technology Stack

- **Desktop Framework**: [Tauri 2.x](https://tauri.app/) - Rust-based framework for building native desktop apps
- **Frontend Framework**: [React 19](https://react.dev/) with TypeScript
- **Drawing Engine**: [@excalidraw/excalidraw](https://github.com/excalidraw/excalidraw)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) with [Tailwind CSS](https://tailwindcss.com/)
- **State Management**: React hooks with local storage persistence

### Security Features

- **Path Traversal Protection**: All file paths are validated and canonicalized
- **File Type Validation**: Only `.excalidraw` files can be read/written
- **Content Validation**: JSON structure is validated before saving
- **Sandboxed File Access**: Tauri's security model restricts file system access

## Development

### Project Structure

```
excaliapp/
├── src/                    # React frontend
│   ├── components/         # React components
│   │   ├── Sidebar.tsx    # File browser sidebar
│   │   ├── TreeView.tsx   # Hierarchical file tree
│   │   └── ExcalidrawEditor.tsx # Editor wrapper
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utilities
│   └── App.tsx            # Main application
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── main.rs        # Entry point
│   │   ├── lib.rs         # Core logic & commands
│   │   ├── menu.rs        # Native menu setup
│   │   └── security.rs    # Security validations
│   └── tauri.conf.json    # Tauri configuration
└── package.json           # Node dependencies
```

### Available Scripts

```bash
# Start development server
npm run dev

# Run Tauri in development mode
npm run tauri dev

# Build for production
npm run tauri build

# Type checking
npm run type-check

# Format code
npm run format
```

## Mac App Store Release

The repository includes a Mac App Store specific Tauri config and helper scripts. Before uploading, create an App Store Connect app whose Bundle ID matches `com.tchen.excaliapp`, then create a "Mac App Store Connect" provisioning profile for that App ID.

Required local environment:

```bash
export APPLE_TEAM_ID="YOURTEAMID"
export APPLE_SIGNING_IDENTITY="Apple Distribution: Your Name (YOURTEAMID)"
export APPLE_INSTALLER_SIGNING_IDENTITY="3rd Party Mac Developer Installer: Your Name (YOURTEAMID)"
export MAS_PROVISION_PROFILE="/absolute/path/to/ExcaliApp.provisionprofile"
export APPLE_API_KEY_ID="APP_STORE_CONNECT_KEY_ID"
export APPLE_API_ISSUER="APP_STORE_CONNECT_ISSUER_ID"
```

Build and upload:

```bash
rustup target add aarch64-apple-darwin
npm ci
npm run test:run
npm run mas:build
npm run mas:pkg
npm run mas:upload
```

### GitHub Actions Release

Every pushed `v*` tag, such as `v0.1.0`, triggers `.github/workflows/release.yml`. The workflow builds the Apple Silicon Mac App Store package, uploads it to App Store Connect, and creates a GitHub Release with the signed `.pkg` attached.

Configure these repository secrets before pushing a release tag:

```text
APPLE_TEAM_ID
APPLE_CERTIFICATE_BASE64
APPLE_CERTIFICATE_PASSWORD
APPLE_INSTALLER_CERTIFICATE_BASE64
APPLE_INSTALLER_CERTIFICATE_PASSWORD
APPLE_API_KEY_ID
APPLE_API_ISSUER
APPLE_API_PRIVATE_KEY_BASE64
KEYCHAIN_PASSWORD
MAS_PROVISION_PROFILE_BASE64
```

Generate the base64 values locally:

```bash
base64 -i AppleDistribution.p12 | pbcopy
base64 -i AppleInstaller.p12 | pbcopy
base64 -i AuthKey_XXXXXXXXXX.p8 | pbcopy
base64 -i ExcaliApp.provisionprofile | pbcopy
```

Publish a release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Notes:

- The Mac App Store build uses `src-tauri/tauri.appstore.conf.json`, `src-tauri/Entitlements.mas.plist.template`, and a generated local `embedded.provisionprofile`.
- The Mac App Store build targets Apple Silicon only (`aarch64-apple-darwin`) and requires macOS 12 or newer.
- Generated signing/provisioning files are intentionally ignored by git.
- The app is sandboxed and uses user-selected read/write access. If persistent access to the last opened folder after app restart is required, implement security-scoped bookmarks before relying on automatic folder restore in the store build.
- Keep `package-lock.json` and `src-tauri/Cargo.lock` committed for reproducible release builds.

### Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

- [Excalidraw](https://excalidraw.com/) for the amazing drawing engine
- [Tauri](https://tauri.app/) for the desktop framework
- The open-source community for continuous inspiration
