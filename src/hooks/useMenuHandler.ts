import { useEffect } from 'react'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useStore } from '../store/useStore'
import { convertPreferencesToRust } from '../lib/preferences'

interface MenuCommand {
  command: string
  data?: any
}

// Singleton to store the Excalidraw API reference
let globalExcalidrawAPI: any = null

export function setGlobalExcalidrawAPI(api: any) {
  globalExcalidrawAPI = api
}

export function useMenuHandler() {
  const {
    loadDirectory,
    createNewFile,
    createNewFolder,
    saveCurrentFile,
    activeFile,
    toggleSidebar,
    preferences,
    savePreferences,
  } = useStore()

  // Use the global reference instead of a local one
  const setExcalidrawAPI = (api: any) => {
    setGlobalExcalidrawAPI(api)
  }

  useEffect(() => {
    let unlisten: UnlistenFn | null = null

    const setupListener = async () => {
      unlisten = await listen<MenuCommand>('menu-command', async (event) => {
        const { command, data } = event.payload

        switch (command) {
          // File menu commands
          case 'open_directory':
            handleOpenDirectory()
            break

          case 'new_file':
            handleNewFile()
            break

          case 'new_folder':
            handleNewFolder()
            break

          case 'save':
            await saveCurrentFile()
            break

          case 'save_as':
            handleSaveAs()
            break

          case 'quit':
            await getCurrentWindow().close()
            break

          // Recent directories
          case command.match(/^recent_dir_\d+$/)?.input:
            if (data?.directory) {
              await loadDirectory(data.directory)
            }
            break

          case 'clear_recent':
            handleClearRecent()
            break


          // View menu commands
          case 'toggle_sidebar':
            toggleSidebar()
            break

          case 'zoom_in':
            handleZoomIn()
            break

          case 'zoom_out':
            handleZoomOut()
            break

          case 'reset_zoom':
            handleResetZoom()
            break

          case 'fullscreen':
            handleToggleFullscreen()
            break

          // Window menu commands
          case 'minimize':
            await getCurrentWindow().minimize()
            break

          case 'close_window':
            await getCurrentWindow().close()
            break

          // Help menu commands
          case 'keyboard_shortcuts':
            handleShowKeyboardShortcuts()
            break

          default:
            console.warn('Unknown menu command:', command)
        }
      })
    }

    setupListener()

    return () => {
      if (unlisten) {
        unlisten()
      }
    }
  }, [
    loadDirectory,
    createNewFile,
    createNewFolder,
    saveCurrentFile,
    activeFile,
    toggleSidebar,
    preferences,
    savePreferences,
  ])

  // File menu handlers
  const handleOpenDirectory = async () => {
    const selected = await invoke<string | null>('select_directory')
    if (selected) {
      await loadDirectory(selected)
    }
  }

  const handleNewFile = async () => {
    const state = useStore.getState()
    
    // If no directory is selected, select one first
    if (!state.currentDirectory) {
      const dir = await invoke<string | null>('select_directory')
      if (dir) {
        await state.loadDirectory(dir)
      }
      return
    }
    
    const fileName = window.prompt('File name', 'Untitled.excalidraw')
    if (!fileName?.trim()) {
      return
    }

    await createNewFile(fileName.trim())
  }

  const handleNewFolder = async () => {
    const state = useStore.getState()

    // If no directory is selected, select one first
    if (!state.currentDirectory) {
      const dir = await invoke<string | null>('select_directory')
      if (dir) {
        await state.loadDirectory(dir)
      }
      return
    }

    const folderName = window.prompt('Folder name', 'New Folder')
    if (!folderName?.trim()) {
      return
    }

    await createNewFolder(folderName.trim())
  }

  const handleSaveAs = async () => {
    if (!activeFile) return

    // Get the current content from the store
    const state = useStore.getState()
    const content = state.fileContent
    
    if (!content) return

    const newPath = await invoke<string | null>('save_file_as', {
      content,
    })

    if (newPath) {
      useStore.getState().setActiveFile({
        name: newPath.split('/').pop() ?? activeFile.name,
        path: newPath,
        modified: false,
      })
    }
  }

  const handleClearRecent = async () => {
    const newPrefs = {
      ...preferences,
      recentDirectories: [],
    }
    // Convert to snake_case for Rust backend
    const prefsToSave = convertPreferencesToRust(newPrefs)
    await invoke('save_preferences', { preferences: prefsToSave })
    useStore.getState().setPreferences(newPrefs)
  }


  // View menu handlers
  const handleZoomIn = () => {
    if (globalExcalidrawAPI) {
      const appState = globalExcalidrawAPI.getAppState()
      globalExcalidrawAPI.updateScene({
        appState: {
          ...appState,
          zoom: {
            value: Math.min(appState.zoom.value * 1.1, 30),
          },
        },
      })
    }
  }

  const handleZoomOut = () => {
    if (globalExcalidrawAPI) {
      const appState = globalExcalidrawAPI.getAppState()
      globalExcalidrawAPI.updateScene({
        appState: {
          ...appState,
          zoom: {
            value: Math.max(appState.zoom.value * 0.9, 0.1),
          },
        },
      })
    }
  }

  const handleResetZoom = () => {
    if (globalExcalidrawAPI) {
      // Use scrollToContent to reset zoom without triggering changes
      const elements = globalExcalidrawAPI.getSceneElements()
      if (elements && elements.length > 0) {
        globalExcalidrawAPI.scrollToContent(elements, {
          fitToContent: true,
        })
      } else {
        // If no elements, just reset the zoom and scroll
        globalExcalidrawAPI.updateScene({
          appState: {
            zoom: { value: 1 },
            scrollX: 0,
            scrollY: 0,
          },
        })
      }
    }
  }

  const handleToggleFullscreen = async () => {
    const window = getCurrentWindow()
    const isFullscreen = await window.isFullscreen()
    await window.setFullscreen(!isFullscreen)
    
    // Wait for fullscreen transition to complete, then refresh the view
    if (globalExcalidrawAPI) {
      setTimeout(() => {
        try {
          // Force Excalidraw to refresh its dimensions
          globalExcalidrawAPI.refresh()
          
          // Then recenter the content
          const elements = globalExcalidrawAPI.getSceneElements()
          if (elements && elements.length > 0) {
            setTimeout(() => {
              globalExcalidrawAPI.scrollToContent(elements, {
                fitToContent: true,
              })
            }, 100)
          }
        } catch (err) {
          console.error('Failed to refresh view on fullscreen toggle:', err)
        }
      }, 300)
    }
  }

  const handleShowKeyboardShortcuts = () => {
    // Create a simple modal or alert with keyboard shortcuts
    const shortcuts = `
Keyboard Shortcuts:

File:
  Open Directory: Cmd/Ctrl+O
  New File: Cmd/Ctrl+N
  New Folder: Cmd/Ctrl+Shift+N
  Save: Cmd/Ctrl+S
  Save As: Cmd/Ctrl+Shift+S
  Quit: Cmd/Ctrl+Q

View:
  Toggle Sidebar: Cmd/Ctrl+B
  Zoom In: Cmd/Ctrl++
  Zoom Out: Cmd/Ctrl+-
  Reset Zoom: Cmd/Ctrl+0
  Fullscreen: F11 (Ctrl+Cmd+F on Mac)

Window:
  Minimize: Cmd/Ctrl+M
  Close Window: Cmd/Ctrl+W

Note: All editing operations (copy, paste, undo, etc.) are handled natively by Excalidraw.
    `
    alert(shortcuts)
  }

  return { setExcalidrawAPI }
}
