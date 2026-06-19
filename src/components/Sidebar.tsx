import { ScrollArea } from '@radix-ui/react-scroll-area'
import { FolderOpen, Plus } from 'lucide-react'
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

  return (
    <div className="sidebar-panel w-[280px] h-full border-r flex flex-col">
      {/* Header */}
      <div className="sidebar-section p-4 border-b">
        <button
          onClick={handleSelectDirectory}
          className="sidebar-action w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors"
        >
          <FolderOpen className="w-4 h-4" />
          <span className="text-sm font-medium truncate">
            {currentDirectory ? currentDirectory.split('/').pop() : 'Select Directory'}
          </span>
        </button>
        
        <button
          onClick={handleNewFile}
          className="sidebar-action w-full mt-2 flex items-center gap-2 px-3 py-2 rounded-md transition-colors"
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
            <div className="sidebar-muted text-sm text-center py-8">
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
      <div className="sidebar-section p-3 border-t">
        <div className="sidebar-muted text-xs">
          {countFilesInTree(fileTree)} file{countFilesInTree(fileTree) !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}
