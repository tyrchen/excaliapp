import { ScrollArea } from '@radix-ui/react-scroll-area'
import { FolderOpen, Plus, FolderPlus } from 'lucide-react'
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
    createNewFolder,
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
    if (!currentDirectory) {
      // If no directory, select one first
      const dir = await invoke<string | null>('select_directory')
      if (dir) {
        await useStore.getState().loadDirectory(dir)
      }
      return
    }

    // Create with timestamp folder name
    const folderName = `New Folder-${Date.now()}`
    await createNewFolder(folderName)
  }

  return (
    <div className="w-[280px] h-full bg-gray-50 border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={handleSelectDirectory}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <FolderOpen className="w-4 h-4" />
          <span className="text-sm font-medium truncate">
            {currentDirectory ? currentDirectory.split('/').pop() : 'Select Directory'}
          </span>
        </button>
        
        <button
          onClick={handleNewFile}
          className="w-full mt-2 flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 hover:text-gray-900 transition-colors"
          title={!currentDirectory ? 'Select a directory first' : 'Create a new Excalidraw file'}
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">New File</span>
        </button>

        <button
          onClick={handleNewFolder}
          className="w-full mt-2 flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 hover:text-gray-900 transition-colors"
          title={!currentDirectory ? 'Select a directory first' : 'Create a new folder'}
        >
          <FolderPlus className="w-4 h-4" />
          <span className="text-sm">New Folder</span>
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