export interface ExcalidrawFile {
  name: string
  path: string
  modified: boolean
}

export interface CachedExcalidrawScene {
  elements: readonly any[]
  appState: Record<string, any>
  files?: Record<string, any>
}

export interface OpenTab extends ExcalidrawFile {
  cachedContent: string
  contentHash: string
  cachedScene: CachedExcalidrawScene
  sceneVersion: number
}

export interface FileTreeNode {
  name: string
  path: string
  is_directory: boolean
  modified: boolean
  children?: FileTreeNode[]
}

export interface AppState {
  currentDirectory: string | null
  files: ExcalidrawFile[]
  activeFile: ExcalidrawFile | null
  recentDirectories: string[]
}

export interface Preferences {
  lastDirectory: string | null
  recentDirectories: string[]
  theme: 'light' | 'dark' | 'system'
  sidebarVisible: boolean
  showDecorations: boolean
}
