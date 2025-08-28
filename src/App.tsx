import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { Sidebar } from './components/Sidebar'
import { ExcalidrawEditor } from './components/ExcalidrawEditor'
import { useStore } from './store/useStore'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useMenuHandler } from './hooks/useMenuHandler'
import { useDialog } from './contexts/DialogContext'
import { PanelLeft } from 'lucide-react'
import './index.css'

function App() {
  const { loadPreferences, loadDirectory, currentDirectory, sidebarVisible, isDirty, saveCurrentFile, toggleSidebar, activeFile } = useStore()
  const { showDialog } = useDialog()


  // Load preferences and setup on mount
  useEffect(() => {
    loadPreferences()
  }, [])

  // Update window title based on active file
  useEffect(() => {
    const updateTitle = async () => {
      try {
        let title = 'OwnExcaliDesk'
        
        if (activeFile) {
          const fileName = activeFile.name.replace('.excalidraw', '')
          const dirtyIndicator = isDirty ? ' •' : ''
          // 使用绝对路径
          const absolutePath = activeFile.path
          title = `OwnExcaliDesk - ${fileName}${dirtyIndicator} (${absolutePath})`
        }
        
        console.log('🏷️ Updating window title to:', title)
        await invoke('set_title', { title })
      } catch (error) {
        console.error('Failed to set window title:', error)
      }
    }
    
    updateTitle()
  }, [activeFile, isDirty])

  // Listen for file system changes
  useEffect(() => {
    if (!currentDirectory) return

    const unlisten = listen('file-system-change', async () => {
      // Reload the directory to refresh file list
      const state = useStore.getState()
      await state.loadFileTree(currentDirectory)
      
      // If the active file was deleted, clear it
      if (state.activeFile) {
        const fileStillExists = state.fileTree.some(node => 
          node.path === state.activeFile?.path || 
          (node.children && node.children.some(child => child.path === state.activeFile?.path))
        )
        
        if (!fileStillExists) {
          state.setActiveFile(null)
          state.setFileContent(null)
          state.setIsDirty(false)
        }
      }
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [currentDirectory, loadDirectory])

  // Listen for window close event
  useEffect(() => {
    const unlisten = listen('check-unsaved-before-close', async () => {
      if (isDirty) {
        // First ask if they want to save
        const shouldSave = await showDialog({
          title: 'Save Your Work? - OwnExcaliDesk',
          message: `You have unsaved changes in your current drawing.

Your creative work is important! Would you like to save it before closing the application?`,
          type: 'info',
          confirmLabel: 'Save & Close',
          cancelLabel: 'Cancel',
          showCancel: true
        })
        
        if (shouldSave === true) {
          // Save before closing
          await saveCurrentFile()
          await invoke('force_close_app')
        } else if (shouldSave === false) {
          // User chose "Cancel" - ask for confirmation to close without saving
          const reallyClose = await showDialog({
            title: 'Confirm Close Without Saving - OwnExcaliDesk',
            message: `Warning: All your unsaved changes will be permanently lost!

This action cannot be undone. Are you sure you want to continue?`,
            type: 'warning',
            confirmLabel: 'Close Without Saving',
            cancelLabel: 'Go Back',
            showCancel: true
          })
          
          if (reallyClose === true) {
            await invoke('force_close_app')
          }
          // If reallyClose is false or null (ESC/X), stay in the app
        }
        // If shouldSave is null (ESC/X pressed), don't close - user wants to stay
      } else {
        // No unsaved changes, close directly
        await invoke('force_close_app')
      }
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [isDirty, saveCurrentFile])

  // Setup keyboard shortcuts
  useKeyboardShortcuts()
  
  // Setup menu handler (NOTE: ExcalidrawEditor will set the Excalidraw API)
  useMenuHandler()

  return (
    <div className="h-screen flex bg-white text-gray-900 overflow-hidden">
      {/* 侧边栏容器带动画 */}
      <div 
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          sidebarVisible ? 'w-[280px]' : 'w-0'
        }`}
      >
        <Sidebar />
      </div>
      
      {/* 主内容区域 */}
      <div className="flex-1 relative">
        {!sidebarVisible && (
          <button
            onClick={toggleSidebar}
            className="absolute bottom-20 left-4 z-[60] flex items-center justify-center w-10 h-10 rounded-lg shadow-xs hover:shadow-sm hover:bg-gray-100 transition-all duration-150 active:scale-95"
            style={{ backgroundColor: '#ECECF4' }}
            title="Show sidebar"
          >
            <PanelLeft className="w-4 h-4 text-gray-700" />
          </button>
        )}
        <ExcalidrawEditor />
      </div>
    </div>
  )
}

export default App