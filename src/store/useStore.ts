import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { ExcalidrawFile, FileTreeNode, Preferences } from '../types'
import { convertPreferencesFromRust, convertPreferencesToRust } from '../lib/preferences'
import { dialogService } from '../services/dialogService'

interface AppStore {
  // State
  currentDirectory: string | null
  files: ExcalidrawFile[]
  fileTree: FileTreeNode[]
  activeFile: ExcalidrawFile | null
  fileContent: string | null
  preferences: Preferences
  sidebarVisible: boolean
  isDirty: boolean

  // Actions
  setCurrentDirectory: (dir: string | null) => void
  setFiles: (files: ExcalidrawFile[]) => void
  setFileTree: (tree: FileTreeNode[]) => void
  setActiveFile: (file: ExcalidrawFile | null) => void
  setFileContent: (content: string | null) => void
  setPreferences: (prefs: Preferences) => void
  setSidebarVisible: (visible: boolean) => void
  setIsDirty: (dirty: boolean) => void
  markFileAsModified: (filePath: string, modified: boolean) => void
  markTreeNodeAsModified: (filePath: string, modified: boolean) => void
  
  // Async actions
  loadDirectory: (dir: string) => Promise<void>
  loadFileTree: (dir: string) => Promise<void>
  loadFile: (file: ExcalidrawFile) => Promise<void>
  loadFileFromTree: (node: FileTreeNode) => Promise<void>
  saveCurrentFile: (content?: string) => Promise<void>
  createNewFile: (fileName?: string) => Promise<void>
  renameFile: (oldPath: string, newName: string) => Promise<void>
  renameDirectory: (oldPath: string, newName: string) => Promise<void>
  deleteFile: (filePath: string) => Promise<boolean>
  deleteDirectory: (dirPath: string) => Promise<boolean>
  moveFile: (sourcePath: string, targetDirectory: string) => Promise<void>
  createDirectory: (parentPath: string, directoryName: string) => Promise<void>
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
  preferences: {
    lastDirectory: null,
    recentDirectories: [],
    theme: 'system',
    sidebarVisible: true,
  },
  sidebarVisible: true,
  isDirty: false,

  // Basic setters
  setCurrentDirectory: (dir) => set({ currentDirectory: dir }),
  setFiles: (files) => set({ files }),
  setFileTree: (tree) => set({ fileTree: tree }),
  setActiveFile: (file) => set({ activeFile: file }),
  setFileContent: (content) => set({ fileContent: content }),
  setPreferences: (prefs) => set({ preferences: prefs }),
  setSidebarVisible: (visible) => set({ sidebarVisible: visible }),
  setIsDirty: (dirty) => set({ isDirty: dirty }),
  
  markFileAsModified: (filePath, modified) => {
    set((state) => ({
      files: state.files.map((f) =>
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
      const [files, fileTree] = await Promise.all([
        invoke<ExcalidrawFile[]>('list_excalidraw_files', { directory: dir }),
        invoke<FileTreeNode[]>('get_file_tree', { directory: dir })
      ])
      
      set({
        currentDirectory: dir,
        files,
        fileTree,
        activeFile: null,
        fileContent: null,
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
      const response = await dialogService.showDialog({
        title: 'Save Your Current Work? - OwnExcaliDesk',
        message: `You have unsaved changes in "${state.activeFile.name.replace('.excalidraw', '')}".

Would you like to save your work before switching to another file?`,
        type: 'info',
        confirmLabel: 'Save & Switch',
        cancelLabel: "Don't Save",
        showCancel: true
      })
      
      if (response === true) {
        // User chose to save
        await state.saveCurrentFile()
      } else if (response === false) {
        // User chose "Don't Save" - clear the dirty state and file modified status
        const currentFilePath = state.activeFile.path
        set({ isDirty: false })
        // Clear the modified status for the abandoned file
        state.markFileAsModified(currentFilePath, false)
        state.markTreeNodeAsModified(currentFilePath, false)
      } else {
        // User cancelled/closed dialog (response is null) - don't switch files
        return
      }
      // Continue with file switching
    }
    
    try {
      const content = await invoke<string>('read_file', {
        filePath: file.path,
      })
      
      set({
        activeFile: file,
        fileContent: content,
        isDirty: false,
      })
      
      // Clear modified state for this file
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
    
    const state = get()
    
    // If clicking the same file that's already active, do nothing
    if (state.activeFile?.path === node.path) {
      return
    }
    
    // Check if current file has unsaved changes
    if (state.isDirty && state.activeFile) {
      const response = await dialogService.showDialog({
        title: 'Save Your Current Work? - OwnExcaliDesk',
        message: `You have unsaved changes in "${state.activeFile.name.replace('.excalidraw', '')}".

Would you like to save your work before switching to another file?`,
        type: 'info',
        confirmLabel: 'Save & Switch',
        cancelLabel: "Don't Save",
        showCancel: true
      })
      
      if (response === true) {
        // User chose to save
        await state.saveCurrentFile()
      } else if (response === false) {
        // User chose "Don't Save" - clear the dirty state and file modified status
        const currentFilePath = state.activeFile.path
        set({ isDirty: false })
        // Clear the modified status for the abandoned file
        state.markFileAsModified(currentFilePath, false)
        state.markTreeNodeAsModified(currentFilePath, false)
      } else {
        // User cancelled/closed dialog (response is null) - don't switch files
        return
      }
      // Continue with file switching
    }
    
    try {
      const content = await invoke<string>('read_file', {
        filePath: node.path,
      })
      
      // Convert tree node to ExcalidrawFile
      const file: ExcalidrawFile = {
        name: node.name,
        path: node.path,
        modified: node.modified,
      }
      
      set({
        activeFile: file,
        fileContent: content,
        // Don't change isDirty here - it will be set to false by ExcalidrawEditor after loading
      })
      
      // Don't clear modified state here either - let the editor handle it
    } catch (error) {
      console.error('Failed to load file:', error)
      
      // If file doesn't exist, refresh the tree and show error
      if (String(error).includes('No such file') || String(error).includes('not found')) {
        alert(`File not found: ${node.name}\n\nThe file may have been deleted or moved. Refreshing file list...`)
        
        // Clear active file if it's the one that failed
        if (state.activeFile?.path === node.path) {
          set({
            activeFile: null,
            fileContent: null,
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

  // Save current file
  saveCurrentFile: async (content) => {
    const state = get()
    const { activeFile, fileContent, isDirty } = state
    
    if (!activeFile) {
      console.log('[saveCurrentFile] No active file to save')
      return
    }
    
    // Only save if file is dirty
    if (!isDirty && !content) {
      console.log('[saveCurrentFile] File is not dirty, skipping save')
      return
    }
    
    const contentToSave = content || fileContent
    if (!contentToSave) {
      console.log('[saveCurrentFile] No content to save')
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
        console.log('[saveCurrentFile] Skipping save of empty file (auto-save)')
        return
      }
    } catch (jsonError) {
      console.error('[saveCurrentFile] Invalid JSON, not saving:', jsonError)
      return
    }
    
    try {
      console.log('[saveCurrentFile] Saving file:', activeFile.path)
      await invoke('save_file', {
        filePath: activeFile.path,
        content: contentToSave,
      })
      
      state.markFileAsModified(activeFile.path, false)
      state.markTreeNodeAsModified(activeFile.path, false)
      set({ isDirty: false })
      console.log('[saveCurrentFile] File saved successfully')
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
      const response = await dialogService.showDialog({
        title: 'Save Before Creating New File? - OwnExcaliDesk',
        message: `You have unsaved changes in "${state.activeFile.name.replace('.excalidraw', '')}".

Would you like to save your work before creating a new file?`,
        type: 'info',
        confirmLabel: 'Save & Create New',
        cancelLabel: "Don't Save",
        showCancel: true
      })
      
      if (response === true) {
        // User chose to save
        await state.saveCurrentFile()
      } else if (response === false) {
        // User cancelled - don't create new file
        return
      }
      // If response is false, user chose "Don't Save" - continue without saving
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
      
      // Update the active file if it was renamed
      if (state.activeFile?.path === oldPath) {
        set({
          activeFile: {
            ...state.activeFile,
            name: finalName,
            path: newPath,
          },
        })
      }
      
      // Reload the file tree
      if (state.currentDirectory) {
        await state.loadFileTree(state.currentDirectory)
      }
    } catch (error) {
      console.error('Failed to rename file:', error)
      alert(`Failed to rename file: ${error}`)
    }
  },
  
  // Rename directory
  renameDirectory: async (oldPath, newName) => {
    try {
      const newPath = await invoke<string>('rename_directory', {
        oldPath,
        newName,
      })
      
      const state = get()
      
      // Reload the file tree
      if (state.currentDirectory) {
        await state.loadFileTree(state.currentDirectory)
      }
    } catch (error) {
      console.error('Failed to rename directory:', error)
      alert(`Failed to rename directory: ${error}`)
    }
  },
  
  // Delete file
  // NOTE: Confirmation should be handled by the caller
  deleteFile: async (filePath) => {
    console.log('[deleteFile] Starting deletion for:', filePath)
    try {
      // Proceed with deletion directly (confirmation handled by caller)
      console.log('[deleteFile] Calling Rust delete_file command...')
      const result = await invoke('delete_file', { filePath })
      console.log('[deleteFile] Rust command completed, result:', result)
      
      const state = get()
      
      // If the deleted file was active, clear it
      if (state.activeFile?.path === filePath) {
        console.log('[deleteFile] Clearing active file')
        set({
          activeFile: null,
          fileContent: null,
          isDirty: false,
        })
      }
      
      // Reload the file tree
      if (state.currentDirectory) {
        console.log('[deleteFile] Reloading file tree for:', state.currentDirectory)
        await state.loadFileTree(state.currentDirectory)
      }
      
      console.log('[deleteFile] File deleted successfully:', filePath)
      return true // Return success
    } catch (error) {
      console.error('[deleteFile] Failed to delete file:', error)
      console.error('[deleteFile] Error details:', JSON.stringify(error))
      alert(`Failed to delete file: ${error}`)
      throw error // Re-throw so caller knows deletion failed
    }
  },

  // Delete directory
  // NOTE: Confirmation should be handled by the caller
  deleteDirectory: async (dirPath) => {
    console.log('[deleteDirectory] Starting deletion for:', dirPath)
    try {
      // Proceed with deletion directly (confirmation handled by caller)
      console.log('[deleteDirectory] Calling Rust delete_directory command...')
      const result = await invoke('delete_directory', { dirPath })
      console.log('[deleteDirectory] Rust command completed, result:', result)
      
      const state = get()
      
      // If the active file was in the deleted directory, clear it
      if (state.activeFile?.path.startsWith(dirPath)) {
        console.log('[deleteDirectory] Clearing active file in deleted directory')
        set({
          activeFile: null,
          fileContent: null,
          isDirty: false,
        })
      }
      
      // Reload the file tree
      if (state.currentDirectory) {
        console.log('[deleteDirectory] Reloading file tree for:', state.currentDirectory)
        await state.loadFileTree(state.currentDirectory)
      }
      
      console.log('[deleteDirectory] Directory deleted successfully:', dirPath)
      return true // Return success
    } catch (error) {
      console.error('[deleteDirectory] Failed to delete directory:', error)
      console.error('[deleteDirectory] Error details:', JSON.stringify(error))
      alert(`Failed to delete directory: ${error}`)
      throw error // Re-throw so caller knows deletion failed
    }
  },

  // Load preferences
  loadPreferences: async () => {
    try {
      // The Rust backend returns snake_case fields
      const prefs = await invoke<any>('get_preferences')
      console.log('Loaded preferences from backend:', prefs)
      
      // Convert snake_case from Rust to camelCase for TypeScript
      const safePrefs = convertPreferencesFromRust(prefs)
      
      set({
        preferences: safePrefs,
        sidebarVisible: safePrefs.sidebarVisible,
      })
      
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
        console.log('Auto-loading last directory:', safePrefs.lastDirectory)
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

  // Move file to a different directory
  moveFile: async (sourcePath, targetDirectory) => {
    try {
      const newPath = await invoke<string>('move_file', {
        sourcePath,
        targetDirectory,
      })
      
      const state = get()
      
      // If the moved file was active, update its path
      if (state.activeFile?.path === sourcePath) {
        const fileName = newPath.split('/').pop() || state.activeFile.name
        set({
          activeFile: {
            ...state.activeFile,
            path: newPath,
            name: fileName,
          },
        })
      }
      
      // Reload the file tree
      if (state.currentDirectory) {
        await state.loadFileTree(state.currentDirectory)
      }
    } catch (error) {
      console.error('Failed to move file:', error)
      // 移除弹窗提醒，只在控制台记录错误
      throw error
    }
  },
  
  // Create new directory
  createDirectory: async (parentPath, directoryName) => {
    try {
      await invoke<string>('create_directory', {
        parentPath,
        directoryName,
      })
      
      const state = get()
      
      // Reload the file tree
      if (state.currentDirectory) {
        await state.loadFileTree(state.currentDirectory)
      }
    } catch (error) {
      console.error('Failed to create directory:', error)
      alert(`Failed to create directory: ${error}`)
      throw error
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

}))