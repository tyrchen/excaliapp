import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { CachedExcalidrawScene, ExcalidrawFile, FileTreeNode, OpenTab, Preferences } from '../types'
import { convertPreferencesFromRust, convertPreferencesToRust } from '../lib/preferences'
import { ask } from '@tauri-apps/plugin-dialog'

type UnsavedChangesDecision = 'save' | 'discard' | 'cancel'
type FileLoadSource = 'cache' | 'disk' | null

interface FileContentResult {
  content: string
  content_hash: string
}

function parseSceneFromContent(content: string): CachedExcalidrawScene {
  const data = JSON.parse(content)

  return {
    elements: data.elements || [],
    appState: data.appState || {},
    files: data.files || {},
  }
}

function toOpenTab(
  file: ExcalidrawFile,
  content: string,
  contentHash: string,
  sceneVersion = 0
): OpenTab {
  return {
    ...file,
    cachedContent: content,
    contentHash,
    cachedScene: parseSceneFromContent(content),
    sceneVersion,
  }
}

function toExcalidrawFile(tab: OpenTab): ExcalidrawFile {
  return {
    name: tab.name,
    path: tab.path,
    modified: tab.modified,
  }
}

async function readOpenTabFromDisk(file: ExcalidrawFile, sceneVersion = 0): Promise<OpenTab> {
  const { content, content_hash: contentHash } = await invoke<FileContentResult>(
    'read_file_with_hash',
    { filePath: file.path }
  )

  return toOpenTab({ ...file, modified: false }, content, contentHash, sceneVersion)
}

async function confirmUnsavedChanges(
  fileName: string,
  actionDescription: string
): Promise<UnsavedChangesDecision> {
  const shouldSave = await ask(
    `Do you want to save changes to "${fileName}" before ${actionDescription}?`,
    {
      title: 'Unsaved Changes',
      kind: 'warning',
      okLabel: 'Save',
      cancelLabel: "Don't Save",
    }
  )

  if (shouldSave) {
    return 'save'
  }

  const shouldDiscard = await ask(
    `Discard unsaved changes to "${fileName}"?`,
    {
      title: 'Discard Unsaved Changes',
      kind: 'warning',
      okLabel: "Don't Save",
      cancelLabel: 'Cancel',
    }
  )

  return shouldDiscard ? 'discard' : 'cancel'
}

interface AppStore {
  // State
  currentDirectory: string | null
  files: ExcalidrawFile[]
  fileTree: FileTreeNode[]
  activeFile: ExcalidrawFile | null
  fileContent: string | null
  activeFileLoadSource: FileLoadSource
  preferences: Preferences
  sidebarVisible: boolean
  isDirty: boolean
  presentationMode: boolean
  openTabs: OpenTab[]

  // Actions
  setCurrentDirectory: (dir: string | null) => void
  setFiles: (files: ExcalidrawFile[]) => void
  setFileTree: (tree: FileTreeNode[]) => void
  setActiveFile: (file: ExcalidrawFile | null) => void
  setFileContent: (content: string | null) => void
  updateTabScene: (filePath: string, scene: CachedExcalidrawScene) => void
  setPreferences: (prefs: Preferences) => void
  setSidebarVisible: (visible: boolean) => void
  setIsDirty: (dirty: boolean) => void
  markFileAsModified: (filePath: string, modified: boolean) => void
  markTreeNodeAsModified: (filePath: string, modified: boolean) => void
  togglePresentationMode: () => void
  closeTab: (filePath: string) => Promise<void>
  toggleDecorations: () => void

  // Async actions
  loadDirectory: (dir: string) => Promise<void>
  loadFileTree: (dir: string) => Promise<void>
  loadFile: (file: ExcalidrawFile) => Promise<void>
  loadFileFromTree: (node: FileTreeNode) => Promise<void>
  saveCurrentFile: (content?: string) => Promise<void>
  createNewFile: (fileName?: string) => Promise<void>
  renameFile: (oldPath: string, newName: string) => Promise<void>
  deleteFile: (filePath: string) => Promise<boolean>
  loadPreferences: () => Promise<void>
  savePreferences: () => Promise<void>
  toggleSidebar: () => void
}

export const useStore = create<AppStore>((set, get) => ({
  // Initial state
  currentDirectory: null,
  files: [],
  fileTree: [],
  activeFile: null,
  fileContent: null,
  activeFileLoadSource: null,
  preferences: {
    lastDirectory: null,
    recentDirectories: [],
    theme: 'system',
    sidebarVisible: true,
    showDecorations: true,
  },
  sidebarVisible: true,
  isDirty: false,
  presentationMode: false,
  openTabs: [],

  // Basic setters
  setCurrentDirectory: (dir) => set({ currentDirectory: dir }),
  setFiles: (files) => set({ files }),
  setFileTree: (tree) => set({ fileTree: tree }),
  setActiveFile: (file) => set({ activeFile: file }),
  setFileContent: (content) => set((state) => ({
    fileContent: content,
    openTabs:
      content && state.activeFile
        ? state.openTabs.map((tab) =>
            tab.path === state.activeFile?.path
              ? { ...tab, cachedContent: content }
              : tab
          )
        : state.openTabs,
  })),
  updateTabScene: (filePath, scene) => set((state) => ({
    openTabs: state.openTabs.map((tab) =>
      tab.path === filePath ? { ...tab, cachedScene: scene } : tab
    ),
  })),
  setPreferences: (prefs) => set({ preferences: prefs }),
  setSidebarVisible: (visible) => set({ sidebarVisible: visible }),
  setIsDirty: (dirty) => set({ isDirty: dirty }),
  
  markFileAsModified: (filePath, modified) => {
    set((state) => ({
      files: state.files.map((f) =>
        f.path === filePath ? { ...f, modified } : f
      ),
      openTabs: state.openTabs.map((f) =>
        f.path === filePath ? { ...f, modified } : f
      ),
    }))
  },

  markTreeNodeAsModified: (filePath, modified) => {
    const updateNode = (nodes: FileTreeNode[]): FileTreeNode[] => {
      return nodes.map(node => {
        if (node.path === filePath) {
          return { ...node, modified }
        }
        if (node.children) {
          return { ...node, children: updateNode(node.children) }
        }
        return node
      })
    }
    
    set((state) => ({
      fileTree: updateNode(state.fileTree)
    }))
  },

  // Load directory and list files
  loadDirectory: async (dir) => {
    try {
      const state = get()
      const [files, fileTree] = await Promise.all([
        invoke<ExcalidrawFile[]>('list_excalidraw_files', { directory: dir }),
        invoke<FileTreeNode[]>('get_file_tree', { directory: dir })
      ])

      if (state.presentationMode && state.preferences.showDecorations) {
        await invoke('set_menu_visible', { visible: true }).catch((error) => {
          console.error('Failed to restore menu before loading directory:', error)
        })
      }
      
      set({
        currentDirectory: dir,
        files,
        fileTree,
        activeFile: null,
        fileContent: null,
        activeFileLoadSource: null,
        isDirty: false,
        presentationMode: false,
        openTabs: [],
      })
      
      // Update preferences with recent directory
      const prefs = get().preferences
      // Ensure recentDirectories is always an array
      const currentRecentDirs = prefs.recentDirectories || []
      const recentDirs = currentRecentDirs.filter((d) => d !== dir)
      recentDirs.unshift(dir)
      if (recentDirs.length > 10) {
        recentDirs.pop()
      }
      
      const newPrefs: Preferences = {
        ...prefs,
        lastDirectory: dir,
        recentDirectories: recentDirs,
      }
      
      set({ preferences: newPrefs })
      await get().savePreferences()
      
      // Start watching directory
      await invoke('watch_directory', { directory: dir })
    } catch (error) {
      console.error('Failed to load directory:', error)
      // Show user-friendly error message
      alert(`Failed to load directory: ${error}`)
    }
  },

  // Load file tree only
  loadFileTree: async (dir) => {
    try {
      const fileTree = await invoke<FileTreeNode[]>('get_file_tree', {
        directory: dir,
      })
      
      set({ fileTree })
    } catch (error) {
      console.error('Failed to load file tree:', error)
    }
  },

  // Load file content
  loadFile: async (file) => {
    const state = get()
    
    // If clicking the same file that's already active, do nothing
    if (state.activeFile?.path === file.path) {
      return
    }
    
    // Check if current file has unsaved changes
    if (state.isDirty && state.activeFile) {
      const decision = await confirmUnsavedChanges(state.activeFile.name, 'switching files')
      
      if (decision === 'save') {
        await state.saveCurrentFile()
      } else if (decision === 'cancel') {
        return
      } else {
        try {
          const existingTab = get().openTabs.find((tab) => tab.path === state.activeFile?.path)
          const cleanTab = await readOpenTabFromDisk(
            state.activeFile,
            (existingTab?.sceneVersion || 0) + 1
          )

          set((currentState) => ({
            activeFile: toExcalidrawFile(cleanTab),
            fileContent: cleanTab.cachedContent,
            activeFileLoadSource: 'disk',
            isDirty: false,
            openTabs: currentState.openTabs.map((tab) =>
              tab.path === cleanTab.path ? cleanTab : tab
            ),
          }))
          state.markFileAsModified(cleanTab.path, false)
          state.markTreeNodeAsModified(cleanTab.path, false)
        } catch (error) {
          console.error('Failed to discard unsaved changes:', error)
          alert(`Failed to discard unsaved changes: ${error}`)
          return
        }
      }
    }
    
    try {
      const latestState = get()
      const existingTab = latestState.openTabs.find(t => t.path === file.path)

      if (existingTab) {
        const diskHash = await invoke<string>('hash_file_content', {
          filePath: file.path,
        })

        if (diskHash === existingTab.contentHash) {
          set({
            activeFile: toExcalidrawFile(existingTab),
            fileContent: existingTab.cachedContent,
            activeFileLoadSource: 'cache',
            isDirty: existingTab.modified,
          })
          return
        }
      }

      const updatedTab = await readOpenTabFromDisk(
        file,
        existingTab ? existingTab.sceneVersion + 1 : 0
      )
      const updatedFile = toExcalidrawFile(updatedTab)
      const openTabs = existingTab
        ? get().openTabs.map((tab) => (tab.path === file.path ? updatedTab : tab))
        : [...get().openTabs, updatedTab]

      set({
        activeFile: updatedFile,
        fileContent: updatedTab.cachedContent,
        activeFileLoadSource: 'disk',
        isDirty: false,
        openTabs,
      })

      state.markFileAsModified(file.path, false)
      state.markTreeNodeAsModified(file.path, false)
    } catch (error) {
      console.error('Failed to load file:', error)
      
      // If file doesn't exist, refresh the tree and show error
      if (String(error).includes('No such file') || String(error).includes('not found')) {
        alert(`File not found: ${file.name}\n\nThe file may have been deleted or moved. Refreshing file list...`)
        
        // Clear active file if it's the one that failed
        if (state.activeFile?.path === file.path) {
          set({
            activeFile: null,
            fileContent: null,
            activeFileLoadSource: null,
            isDirty: false,
          })
        }
        
        // Refresh the file tree
        if (state.currentDirectory) {
          await state.loadFileTree(state.currentDirectory)
        }
      } else {
        // Other errors
        alert(`Failed to load file: ${error}`)
      }
    }
  },

  // Load file from tree node
  loadFileFromTree: async (node) => {
    if (node.is_directory) return

    await get().loadFile({
      name: node.name,
      path: node.path,
      modified: node.modified,
    })
  },

  // Save current file
  saveCurrentFile: async (content) => {
    const state = get()
    const { activeFile, fileContent, isDirty } = state
    
    if (!activeFile) {
      return
    }
    
    // Only save if file is dirty
    if (!isDirty && !content) {
      return
    }
    
    const contentToSave = content || fileContent
    if (!contentToSave) {
      return
    }
    
    // Validate JSON before saving
    try {
      const parsed = JSON.parse(contentToSave)
      if (!parsed || typeof parsed !== 'object') {
        console.error('[saveCurrentFile] Invalid JSON structure')
        return
      }
      
      // Don't save if it's an empty Excalidraw file (no elements)
      if (Array.isArray(parsed.elements) && parsed.elements.length === 0 && !content) {
        // Only skip if this is an auto-save (no explicit content provided)
        return
      }
    } catch (jsonError) {
      console.error('[saveCurrentFile] Invalid JSON, not saving:', jsonError)
      return
    }
    
    try {
      const contentHash = await invoke<string>('save_file', {
        filePath: activeFile.path,
        content: contentToSave,
      })
      
      state.markFileAsModified(activeFile.path, false)
      state.markTreeNodeAsModified(activeFile.path, false)
      set((currentState) => ({
        isDirty: false,
        activeFile: { ...activeFile, modified: false },
        openTabs: currentState.openTabs.map((tab) =>
          tab.path === activeFile.path
            ? {
                ...tab,
                cachedContent: contentToSave,
                contentHash,
                modified: false,
              }
            : tab
        ),
      }))
    } catch (error) {
      console.error('[saveCurrentFile] Failed to save file:', error)
      alert(`Failed to save file: ${error}`)
    }
  },

  // Create new file
  createNewFile: async (fileName) => {
    const state = get()
    let { currentDirectory } = state
    
    // Check if current file has unsaved changes
    if (state.isDirty && state.activeFile) {
      const decision = await confirmUnsavedChanges(state.activeFile.name, 'creating a new file')
      
      if (decision === 'save') {
        await state.saveCurrentFile()
      } else if (decision === 'cancel') {
        return
      } else {
        try {
          const existingTab = get().openTabs.find((tab) => tab.path === state.activeFile?.path)
          const cleanTab = await readOpenTabFromDisk(
            state.activeFile,
            (existingTab?.sceneVersion || 0) + 1
          )

          set((currentState) => ({
            activeFile: toExcalidrawFile(cleanTab),
            fileContent: cleanTab.cachedContent,
            activeFileLoadSource: 'disk',
            isDirty: false,
            openTabs: currentState.openTabs.map((tab) =>
              tab.path === cleanTab.path ? cleanTab : tab
            ),
          }))
          state.markFileAsModified(cleanTab.path, false)
          state.markTreeNodeAsModified(cleanTab.path, false)
        } catch (error) {
          console.error('Failed to discard unsaved changes:', error)
          alert(`Failed to discard unsaved changes: ${error}`)
          return
        }
      }
    }
    
    // Check if a directory is selected
    if (!currentDirectory) {
      // Prompt to select a directory if none is selected
      try {
        const dir = await invoke<string | null>('select_directory')
        if (!dir) {
          return
        }
        // Load the selected directory
        await state.loadDirectory(dir)
        currentDirectory = dir
      } catch (error) {
        console.error('Failed to select directory:', error)
        alert(`Failed to select directory: ${error}`)
        return
      }
    }
    
    // Generate default filename if not provided
    const finalFileName = fileName || `Untitled-${Date.now()}.excalidraw`
    
    try {
      // Create the new file
      const filePath = await invoke<string>('create_new_file', {
        directory: currentDirectory,
        fileName: finalFileName,
      })
      
      // Reload the file tree to show the new file
      await state.loadFileTree(currentDirectory)
      
      // Create an ExcalidrawFile object for the new file
      const file: ExcalidrawFile = {
        name: finalFileName,
        path: filePath,
        modified: false,
      }
      
      // Load the new file immediately
      await state.loadFile(file)
    } catch (error) {
      console.error('Failed to create new file:', error)
      alert(`Failed to create file: ${error}`)
    }
  },
  
  // Rename file
  renameFile: async (oldPath, newName) => {
    try {
      // Ensure the new name has .excalidraw extension
      const finalName = newName.endsWith('.excalidraw') 
        ? newName 
        : `${newName}.excalidraw`
      
      const newPath = await invoke<string>('rename_file', {
        oldPath,
        newName: finalName,
      })
      
      const state = get()
      const renamedFile = {
        name: finalName,
        path: newPath,
        modified: state.activeFile?.path === oldPath ? state.isDirty : false,
      }

      set({
        activeFile: state.activeFile?.path === oldPath ? renamedFile : state.activeFile,
        openTabs: state.openTabs.map((tab) =>
          tab.path === oldPath ? { ...tab, name: finalName, path: newPath } : tab
        ),
      })

      // Reload the file tree
      if (state.currentDirectory) {
        await state.loadFileTree(state.currentDirectory)
      }
    } catch (error) {
      console.error('Failed to rename file:', error)
      alert(`Failed to rename file: ${error}`)
    }
  },
  
  // Delete file
  // NOTE: Confirmation should be handled by the caller
  deleteFile: async (filePath) => {
    try {
      await invoke('delete_file', { filePath })
      const state = get()
      const openTabs = state.openTabs.filter((tab) => tab.path !== filePath)
      
      if (state.activeFile?.path === filePath) {
        set({
          openTabs,
          activeFile: null,
          fileContent: null,
          activeFileLoadSource: null,
          isDirty: false,
        })
      } else {
        set({ openTabs })
      }
      
      if (state.currentDirectory) {
        await state.loadFileTree(state.currentDirectory)
      }
      
      return true
    } catch (error) {
      console.error('[deleteFile] Failed to delete file:', error)
      throw error
    }
  },

  // Load preferences
  loadPreferences: async () => {
    try {
      // The Rust backend returns snake_case fields
      const prefs = await invoke<any>('get_preferences')
      
      // Convert snake_case from Rust to camelCase for TypeScript
      const safePrefs = convertPreferencesFromRust(prefs)
      
      set({
        preferences: safePrefs,
        sidebarVisible: safePrefs.sidebarVisible,
      })

      // Apply decorations preference
      if (safePrefs.showDecorations === false) {
        invoke('set_decorations', { visible: false })
      }

      // Apply theme
      const root = document.documentElement
      if (safePrefs.theme === 'dark') {
        root.classList.add('dark')
      } else if (safePrefs.theme === 'light') {
        root.classList.remove('dark')
      } else {
        // System theme
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        if (prefersDark) {
          root.classList.add('dark')
        } else {
          root.classList.remove('dark')
        }
      }
      
      // Auto-load last directory if it exists
      if (safePrefs.lastDirectory) {
        try {
          await get().loadDirectory(safePrefs.lastDirectory)
        } catch (dirError) {
          console.error('Failed to auto-load last directory:', dirError)
          // Clear the invalid lastDirectory from preferences
          const newPrefs = { ...safePrefs, lastDirectory: null }
          set({ preferences: newPrefs })
          await get().savePreferences()
        }
      }
    } catch (error) {
      console.error('Failed to load preferences:', error)
      // Set default preferences if loading fails
      const defaultPrefs: Preferences = {
        lastDirectory: null,
        recentDirectories: [],
        theme: 'system',
        sidebarVisible: true,
        showDecorations: true,
      }
      set({
        preferences: defaultPrefs,
        sidebarVisible: true,
      })
    }
  },

  // Save preferences
  savePreferences: async () => {
    const { preferences } = get()
    try {
      // Convert camelCase to snake_case for Rust backend
      const prefsToSave = convertPreferencesToRust(preferences)
      await invoke('save_preferences', { preferences: prefsToSave })
    } catch (error) {
      console.error('Failed to save preferences:', error)
    }
  },

  // Toggle sidebar
  toggleSidebar: () => {
    const state = get()
    const newVisible = !state.sidebarVisible
    set({ sidebarVisible: newVisible })

    // Update preferences
    const newPrefs = { ...state.preferences, sidebarVisible: newVisible }
    set({ preferences: newPrefs })
    state.savePreferences()
  },

  // Toggle presentation mode
  togglePresentationMode: () => {
    const state = get()
    const entering = !state.presentationMode
    set({ presentationMode: entering })

    if (entering) {
      invoke('set_menu_visible', { visible: false }).catch((error) => {
        console.error('Failed to hide menu for presentation mode:', error)
        set({ presentationMode: false })
      })
    } else {
      if (state.preferences.showDecorations) {
        invoke('set_menu_visible', { visible: true }).catch((error) => {
          console.error('Failed to restore menu after presentation mode:', error)
        })
      }
    }
  },

  // Toggle decorations
  toggleDecorations: () => {
    const state = get()
    const newVisible = !state.preferences.showDecorations
    invoke('set_decorations', { visible: newVisible })
      .then(() => {
        const newPrefs = { ...state.preferences, showDecorations: newVisible }
        set({ preferences: newPrefs })
        get().savePreferences()
      })
      .catch((error) => {
        console.error('Failed to toggle window decorations:', error)
        alert(`Failed to toggle window decorations: ${error}`)
      })
  },

  // Close tab
  closeTab: async (filePath) => {
    const state = get()
    const tabIndex = state.openTabs.findIndex(t => t.path === filePath)
    if (tabIndex === -1) return

    const tab = state.openTabs[tabIndex]

    // Check for unsaved changes if this is the active file
    if (state.activeFile?.path === filePath && state.isDirty) {
      const decision = await confirmUnsavedChanges(tab.name, 'closing')

      if (decision === 'save') {
        await state.saveCurrentFile()
      } else if (decision === 'cancel') {
        return
      } else {
        try {
          const existingTab = get().openTabs.find((tab) => tab.path === state.activeFile?.path)
          const cleanTab = await readOpenTabFromDisk(
            state.activeFile,
            (existingTab?.sceneVersion || 0) + 1
          )

          set((currentState) => ({
            activeFile: toExcalidrawFile(cleanTab),
            fileContent: cleanTab.cachedContent,
            activeFileLoadSource: 'disk',
            isDirty: false,
            openTabs: currentState.openTabs.map((tab) =>
              tab.path === cleanTab.path ? cleanTab : tab
            ),
          }))
          state.markFileAsModified(cleanTab.path, false)
          state.markTreeNodeAsModified(cleanTab.path, false)
        } catch (error) {
          console.error('Failed to discard unsaved changes:', error)
          alert(`Failed to discard unsaved changes: ${error}`)
          return
        }
      }
    }

    const newTabs = state.openTabs.filter(t => t.path !== filePath)

    if (state.activeFile?.path === filePath) {
      // Switch to adjacent tab
      if (newTabs.length > 0) {
        const newIndex = Math.min(tabIndex, newTabs.length - 1)
        const newActiveTab = newTabs[newIndex]
        set({ openTabs: newTabs })
        await get().loadFile(newActiveTab)
      } else {
        set({
          openTabs: newTabs,
          activeFile: null,
          fileContent: null,
          activeFileLoadSource: null,
          isDirty: false,
        })
      }
    } else {
      set({ openTabs: newTabs })
    }
  },

}))
