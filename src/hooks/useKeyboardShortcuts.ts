import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useStore } from '../store/useStore'

export function useKeyboardShortcuts() {
  const {
    toggleSidebar,
    saveCurrentFile,
    openTabs,
    activeFile,
    loadFile,
    createNewFile,
    createNewFolder,
    togglePresentationMode,
    closeTab,
    toggleDecorations,
  } = useStore()

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modKey = isMac ? e.metaKey : e.ctrlKey

      // Don't handle any events if clipboard operations are being used
      // Let Excalidraw handle all clipboard operations natively
      if (modKey && (e.key === 'c' || e.key === 'v' || e.key === 'x' || e.key === 'a')) {
        return
      }

      // F5: Toggle presentation mode
      if (e.key === 'F5') {
        e.preventDefault()
        togglePresentationMode()
      }

      // Escape: Exit presentation mode
      if (e.key === 'Escape') {
        const state = useStore.getState()
        if (state.presentationMode) {
          e.preventDefault()
          togglePresentationMode()
        }
      }

      // Ctrl/Cmd + Shift + D: Toggle decorations
      if (modKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        toggleDecorations()
      }

      // Cmd/Ctrl + B: Toggle sidebar
      if (modKey && e.key === 'b') {
        e.preventDefault()
        toggleSidebar()
      }

      // Cmd/Ctrl + S: Save current file
      if (modKey && e.key === 's') {
        e.preventDefault()
        await saveCurrentFile()
      }

      // Cmd/Ctrl + O: Open directory
      if (modKey && e.key === 'o') {
        e.preventDefault()
        const dir = await invoke<string | null>('select_directory')
        if (dir) {
          await useStore.getState().loadDirectory(dir)
        }
      }

      // Cmd/Ctrl + Shift + N: New folder
      if (modKey && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()

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

      // Cmd/Ctrl + N: New file
      if (modKey && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()

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

      // Cmd/Ctrl + W: Close current tab
      if (modKey && e.key === 'w') {
        e.preventDefault()
        if (activeFile) {
          await closeTab(activeFile.path)
        }
      }

      // Cmd/Ctrl + Tab / Cmd/Ctrl + Shift + Tab: Switch tabs
      if (modKey && e.key === 'Tab') {
        e.preventDefault()
        if (openTabs.length > 1 && activeFile) {
          const currentIndex = openTabs.findIndex((f) => f.path === activeFile.path)
          if (e.shiftKey) {
            const prevIndex = currentIndex === 0 ? openTabs.length - 1 : currentIndex - 1
            await loadFile(openTabs[prevIndex])
          } else {
            const nextIndex = (currentIndex + 1) % openTabs.length
            await loadFile(openTabs[nextIndex])
          }
        }
      }
    }

    // Use non-capturing phase to let Excalidraw handle events first
    window.addEventListener('keydown', handleKeyDown, false)
    return () => window.removeEventListener('keydown', handleKeyDown, false)
  }, [toggleSidebar, saveCurrentFile, openTabs, activeFile, loadFile, createNewFile, createNewFolder, togglePresentationMode, closeTab, toggleDecorations])
}
