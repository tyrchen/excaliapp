import { useState, useRef, useEffect, memo } from 'react'
import { ChevronDown, ChevronRight, File, Folder, FolderOpen, Edit2, Trash2, MoreVertical } from 'lucide-react'
import { cn } from '../lib/utils'
import { FileTreeNode } from '../types'
import { useStore } from '../store/useStore'
import { ask, message } from '@tauri-apps/plugin-dialog'

interface TreeViewProps {
  nodes: FileTreeNode[]
  onFileClick: (node: FileTreeNode) => void
  activeFilePath?: string
}

interface TreeNodeProps {
  node: FileTreeNode
  onFileClick: (node: FileTreeNode) => void
  activeFilePath?: string
  depth: number
}

const TreeNode = memo(function TreeNode({ node, onFileClick, activeFilePath, depth }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(depth === 0)
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(node.name.replace('.excalidraw', ''))
  const [showMenu, setShowMenu] = useState(false)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const { renameFile, deleteFile, activeFile, isDirty } = useStore()
  
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [isRenaming])
  
  const handleClick = () => {
    if (node.is_directory) {
      setIsExpanded(!isExpanded)
    } else {
      onFileClick(node)
    }
  }
  
  const handleRename = async () => {
    if (!newName.trim()) {
      setNewName(node.name.replace('.excalidraw', ''))
      setIsRenaming(false)
      return
    }
    
    const finalName = newName.trim()
    if (finalName !== node.name.replace('.excalidraw', '')) {
      await renameFile(node.path, finalName)
    }
    setIsRenaming(false)
  }
  
  const handleDelete = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    // Close menu first
    setShowMenu(false)
    
    // Get the filename for clear confirmation
    const fileName = node.name.replace('.excalidraw', '')
    
    try {
      // Use Tauri's native dialog API for confirmation
      const confirmed = await ask(
        `Are you sure you want to delete "${fileName}"?`,
        {
          title: 'Confirm Deletion',
          kind: 'warning',
          okLabel: 'Delete',
          cancelLabel: 'Cancel'
        }
      )
      
      if (confirmed === true) {
        if (activeFile?.path === node.path && isDirty) {
          const discardUnsaved = await ask(
            `"${fileName}" has unsaved changes. Delete it without saving?`,
            {
              title: 'Unsaved Changes',
              kind: 'warning',
              okLabel: 'Delete Without Saving',
              cancelLabel: 'Cancel',
            }
          )

          if (!discardUnsaved) {
            return
          }
        }

        try {
          await deleteFile(node.path)
        } catch (error) {
          console.error('Failed to delete file:', error)
          await message(`Failed to delete file: ${error}`, { title: 'Error', kind: 'error' })
        }
      }
    } catch (error) {
      console.error('Error showing confirmation dialog:', error)
    }
  }
  
  const handleContextMenu = (e: React.MouseEvent) => {
    if (!node.is_directory) {
      e.preventDefault()
      setShowMenu(true)
    }
  }
  
  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(!showMenu)
  }
  
  const isActive = activeFilePath === node.path
  const hasChildren = node.children && node.children.length > 0
  
  return (
    <div className="relative">
      <div
        className={cn(
          'tree-node w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors group relative',
          isActive && 'active',
          node.modified && 'font-semibold'
        )}
        style={{ paddingLeft: `${8 + depth * 20}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {node.is_directory && hasChildren && (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
          )
        )}
        
        {node.is_directory && !hasChildren && (
          <div className="w-4 h-4 flex-shrink-0" />
        )}
        
        {node.is_directory ? (
          isExpanded ? (
            <FolderOpen className="tree-folder-icon w-4 h-4 flex-shrink-0" />
          ) : (
            <Folder className="tree-folder-icon w-4 h-4 flex-shrink-0" />
          )
        ) : (
          <File className="tree-icon w-4 h-4 flex-shrink-0" />
        )}
        
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRename()
              } else if (e.key === 'Escape') {
                setNewName(node.name.replace('.excalidraw', ''))
                setIsRenaming(false)
              }
            }}
            className="tree-input flex-1 text-sm px-1 py-0 border rounded outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-sm truncate flex-1">
            {node.is_directory ? node.name : node.name.replace('.excalidraw', '')}
          </span>
        )}
        
        {node.modified && (
          <span className="modified-dot w-2 h-2 rounded-full flex-shrink-0" />
        )}
        
        {!node.is_directory && (
          <button
            onClick={handleMenuClick}
            className="tree-menu-item opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
            title="File actions"
            aria-label={`File actions for ${node.name}`}
          >
            <MoreVertical className="w-3 h-3" />
          </button>
        )}
        
        {isActive && !node.is_directory && (
          <ChevronRight className="w-4 h-4 flex-shrink-0" />
        )}
      </div>
      
      {/* Context Menu */}
      {showMenu && !node.is_directory && (
        <div 
          className="tree-menu absolute right-0 top-8 z-50 rounded-md border py-1 min-w-[150px]"
          onMouseLeave={() => setShowMenu(false)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsRenaming(true)
              setShowMenu(false)
            }}
            className="tree-menu-item w-full px-3 py-2 text-left text-sm flex items-center gap-2"
          >
            <Edit2 className="w-3 h-3" />
            Rename
          </button>
          <button
            onClick={(e) => {
              handleDelete(e)
            }}
            className="tree-menu-item tree-menu-danger w-full px-3 py-2 text-left text-sm flex items-center gap-2"
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
        </div>
      )}
      
      {node.is_directory && hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              onFileClick={onFileClick}
              activeFilePath={activeFilePath}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
})

export function TreeView({ nodes, onFileClick, activeFilePath }: TreeViewProps) {
  if (nodes.length === 0) {
    return (
      <div className="sidebar-muted text-sm text-center py-8">
        No .excalidraw files found
      </div>
    )
  }
  
  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          onFileClick={onFileClick}
          activeFilePath={activeFilePath}
          depth={0}
        />
      ))}
    </div>
  )
}
