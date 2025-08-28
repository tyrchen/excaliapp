import { ScrollArea } from '@radix-ui/react-scroll-area'
import { FolderOpen, Plus, PanelLeftClose, FolderPlus } from 'lucide-react'
import { useStore } from '../store/useStore'
import { TreeView } from './TreeView'
import { FileTreeNode } from '../types'
import { invoke } from '@tauri-apps/api/core'

function countFilesInTree(nodes: FileTreeNode[]): number {
  let count = 0
  for (const node of nodes) {
    if (!node.is_directory) {
      count++
    }
    if (node.children) {
      count += countFilesInTree(node.children)
    }
  }
  return count
}

export function Sidebar() {
  const {
    currentDirectory,
    fileTree,
    activeFile,
    loadFileFromTree,
    createNewFile,
    createDirectory,
    toggleSidebar,
  } = useStore()

  const handleSelectDirectory = async () => {
    const dir = await invoke<string | null>('select_directory')
    if (dir) {
      await useStore.getState().loadDirectory(dir)
    }
  }

  const handleNewFile = async () => {
    // Simple direct call without prompts for now
    if (!currentDirectory) {
      // If no directory, select one first
      const dir = await invoke<string | null>('select_directory')
      if (dir) {
        await useStore.getState().loadDirectory(dir)
      }
      return
    }
    
    // Create with timestamp filename for now
    const fileName = `Untitled-${Date.now()}.excalidraw`
    await createNewFile(fileName)
  }

  const handleNewFolder = async () => {
    console.log('handleNewFolder clicked')
    
    if (!currentDirectory) {
      console.log('No current directory, selecting one first')
      // If no directory, select one first
      const dir = await invoke<string | null>('select_directory')
      if (dir) {
        await useStore.getState().loadDirectory(dir)
      }
      return
    }
    
    console.log('Current directory:', currentDirectory)
    
    try {
      // Generate default folder name like files do
      const defaultFolderName = `New Folder ${Date.now()}`
      console.log('Creating directory with default name:', currentDirectory, defaultFolderName)
      
      await createDirectory(currentDirectory, defaultFolderName)
      console.log('Directory created successfully')
    } catch (error) {
      console.error('Error in handleNewFolder:', error)
      alert(`Failed to create folder: ${error}`)
    }
  }

  return (
    <div className="w-[280px] h-full bg-gray-50 border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={handleSelectDirectory}
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
            <span className="text-sm font-medium truncate">
              {currentDirectory ? currentDirectory.split('/').pop() : 'Select Directory'}
            </span>
          </button>
          
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-md hover:bg-gray-100 hover:text-gray-900 transition-colors ml-2"
            title="Hide sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
        
        <button
          onClick={handleNewFolder}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 hover:text-gray-900 transition-colors"
          title={!currentDirectory ? 'Select a directory first' : 'Create a new folder'}
        >
          <FolderPlus className="w-4 h-4" />
          <span className="text-sm">New Folder</span>
        </button>
        
        <button
          onClick={handleNewFile}
          className="w-full mt-1 flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 hover:text-gray-900 transition-colors"
          title={!currentDirectory ? 'Select a directory first' : 'Create a new Excalidraw file'}
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">New File</span>
        </button>
      </div>

      {/* File Tree */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-2">
          {fileTree.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-8">
              {currentDirectory ? 'No .excalidraw files found' : 'No directory selected'}
            </div>
          ) : (
            <TreeView
              nodes={fileTree}
              onFileClick={loadFileFromTree}
              activeFilePath={activeFile?.path}
            />
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          {countFilesInTree(fileTree)} file{countFilesInTree(fileTree) !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}