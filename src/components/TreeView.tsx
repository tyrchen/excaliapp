import { useState, useRef, useEffect, memo } from 'react'
import { ChevronDown, ChevronRight, File, Folder, FolderOpen, Edit2, Trash2, MoreVertical, FolderPlus } from 'lucide-react'
import { cn } from '../lib/utils'
import { FileTreeNode } from '../types'
import { useStore } from '../store/useStore'
import { useDialog } from '../contexts/DialogContext'

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
  const [isDragOver, setIsDragOver] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartPos, setDragStartPos] = useState<{x: number, y: number} | null>(null)
  const [dragStartTime, setDragStartTime] = useState<number | null>(null)
  const [dragPreviewPos, setDragPreviewPos] = useState<{x: number, y: number} | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const { renameFile, renameDirectory, deleteFile, deleteDirectory, moveFile } = useStore()
  const { showDialog } = useDialog()
  
  // 全局拖拽状态
  const [globalDragData, setGlobalDragData] = useState<{filePath: string, startNode: string} | null>(null)
  
  // 从 window 对象获取全局拖拽数据
  const windowGlobalDragData = (window as any).globalDragData
  
  // 全局鼠标事件监听器
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (dragStartPos && globalDragData) {
        const deltaX = Math.abs(e.clientX - dragStartPos.x)
        const deltaY = Math.abs(e.clientY - dragStartPos.y)
        
        if (deltaX > 5 || deltaY > 5) {
          // 只有在实际移动时才开始拖拽
          if (!isDragging) {
            setIsDragging(true)
          }
          
          document.body.style.cursor = 'grabbing'
          
          // 更新拖拽预览位置
          setDragPreviewPos({ x: e.clientX, y: e.clientY })
          
          // 检查当前鼠标下的文件夹
          const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY)
          const targetFolder = elementUnderMouse?.closest('[data-folder-path]')
          
          // 重置所有文件夹的拖拽样式
          document.querySelectorAll('[data-folder-path]').forEach(el => {
            el.classList.remove('bg-green-200', 'border-green-400', 'border-2')
          })
          
          // 高亮当前目标文件夹
          if (targetFolder) {
            targetFolder.classList.add('bg-green-200', 'border-green-400', 'border-2')
          }
        }
      }
    }
    
    const handleGlobalMouseUp = (e: MouseEvent) => {
      const currentGlobalDragData = (window as any).globalDragData
      if (currentGlobalDragData) {
        // 检查是否有实际的拖拽距离
        const hasDragDistance = dragStartPos && (
          Math.abs(e.clientX - dragStartPos.x) > 5 || 
          Math.abs(e.clientY - dragStartPos.y) > 5
        )
        
        // 检查拖拽时间（防止快速点击被识别为拖拽）
        const dragDuration = dragStartTime ? Date.now() - dragStartTime : 0
        const hasMinDragTime = dragDuration > 100 // 至少拖拽100ms
        
        console.log('🖱️ Global mouse up - checking drop target, isDragging:', isDragging, 'hasDragDistance:', hasDragDistance, 'dragDuration:', dragDuration, 'globalData:', currentGlobalDragData)
        
        // 只有真正拖拽时才执行移动操作：需要距离或时间条件
        if (isDragging || (hasDragDistance && hasMinDragTime)) {
          // 标记为真正的拖拽操作
          ;(window as any).isRealDragOperation = true
          // 检查鼠标释放位置下的元素
          const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY)
          
          // 获取所有可能的目标文件夹（从最深层到最浅层）
          let currentElement = elementUnderMouse
          const possibleTargets: { element: Element, path: string, depth: number }[] = []
          
          console.log('🔍 Starting DOM traversal from:', elementUnderMouse)
          
          while (currentElement) {
            if (currentElement.hasAttribute && currentElement.hasAttribute('data-folder-path')) {
              const targetPath = currentElement.getAttribute('data-folder-path')
              console.log('🔍 Examining element:', {
                targetPath,
                dragFilePath: currentGlobalDragData.filePath,
                isValidTarget: targetPath && targetPath !== currentGlobalDragData.filePath,
                element: currentElement.className,
                tagName: currentElement.tagName
              })
              
              if (targetPath && targetPath !== currentGlobalDragData.filePath) {
                // 计算路径深度（用于选择最具体的目标）
                const depth = targetPath.split('/').length
                possibleTargets.push({ 
                  element: currentElement, 
                  path: targetPath, 
                  depth 
                })
                console.log('📁 Added target:', { 
                  path: targetPath, 
                  depth, 
                  element: currentElement.className,
                  tagName: currentElement.tagName 
                })
              }
            }
            currentElement = currentElement.parentElement
          }
          
          console.log('🎯 All possible targets:', possibleTargets)
          
          // 选择最深层的目标（最具体的文件夹）
          if (possibleTargets.length > 0) {
            const mostSpecificTarget = possibleTargets.reduce((prev, current) => 
              current.depth > prev.depth ? current : prev
            )
            
            console.log('🎯 Selected most specific target:', {
              path: mostSpecificTarget.path,
              depth: mostSpecificTarget.depth,
              element: mostSpecificTarget.element.className
            })
            console.log('🎯 Attempting to move file:', currentGlobalDragData.filePath, 'to:', mostSpecificTarget.path)
            
            // 执行文件移动
            moveFile(currentGlobalDragData.filePath, mostSpecificTarget.path)
              .then(() => {
                console.log('✅ File moved successfully!')
                // 强制刷新目录树
                const { currentDirectory, loadFileTree } = useStore.getState()
                if (currentDirectory) {
                  setTimeout(() => {
                    loadFileTree(currentDirectory)
                  }, 100) // 短暂延迟确保后端操作完成
                }
              })
              .catch(error => console.error('❌ Failed to move file:', error))
          } else {
            console.log('❌ No valid drop target found')
          }
        } else {
          console.log('📋 Simple click detected, no drag operation performed')
        }
        
        // 清理拖拽状态和样式
        setIsDragging(false)
        setDragStartPos(null)
        setDragStartTime(null)
        setDragPreviewPos(null)
        setGlobalDragData(null)
        ;(window as any).globalDragData = null
        ;(window as any).isRealDragOperation = false
        document.body.style.cursor = 'default'
        document.querySelectorAll('[data-folder-path]').forEach(el => {
          el.classList.remove('bg-green-200', 'border-green-400', 'border-2')
        })
        
        console.log('🏁 Global mouse drag ended')
      }
    }
    
    if (dragStartPos && globalDragData) {
      document.addEventListener('mousemove', handleGlobalMouseMove)
      document.addEventListener('mouseup', handleGlobalMouseUp)
      
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove)
        document.removeEventListener('mouseup', handleGlobalMouseUp)
      }
    }
  }, [dragStartPos, globalDragData])
  
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [isRenaming])
  
  const handleClick = () => {
    // 清理可能残留的拖拽状态，防止点击被误识别为拖拽
    setDragStartPos(null)
    setDragStartTime(null)
    setGlobalDragData(null)
    ;(window as any).globalDragData = null
    ;(window as any).isRealDragOperation = false
    setIsDragging(false)
    
    if (node.is_directory) {
      setIsExpanded(!isExpanded)
    } else {
      onFileClick(node)
    }
  }
  
  const handleRename = async () => {
    if (!newName.trim()) {
      setNewName(node.is_directory ? node.name : node.name.replace('.excalidraw', ''))
      setIsRenaming(false)
      return
    }
    
    const finalName = newName.trim()
    const currentName = node.is_directory ? node.name : node.name.replace('.excalidraw', '')
    
    if (finalName !== currentName) {
      if (node.is_directory) {
        await renameDirectory(node.path, finalName)
      } else {
        await renameFile(node.path, finalName)
      }
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
    
    // Get the name for clear confirmation
    const itemName = node.is_directory ? node.name : node.name.replace('.excalidraw', '')
    const itemType = node.is_directory ? 'folder' : 'file'
    
    try {
      // Use enhanced confirmation dialog
      const confirmed = await showDialog({
        title: `🗑️ Delete ${itemType}`,
        message: node.is_directory 
          ? `⚠️ DANGER: This will permanently delete the folder "${itemName}" and ALL files inside it.

This action cannot be undone!

Are you absolutely sure?`
          : `⚠️ This will permanently delete the file "${itemName}".

This action cannot be undone!

Are you sure?`,
        type: 'warning',
        confirmLabel: `🗑️ Yes, Delete ${itemType}`,
        cancelLabel: '❌ Cancel',
        showCancel: true
      })
      
      console.log('Tauri dialog response:', confirmed, 'for', itemType, ':', itemName)
      
      // Check if user clicked Delete (true) or Cancel (false)
      if (confirmed === true) {
        console.log('✅ User confirmed deletion, proceeding with deletion of:', node.path)
        try {
          if (node.is_directory) {
            await deleteDirectory(node.path)
            console.log('✅ Directory deleted successfully')
          } else {
            await deleteFile(node.path)
            console.log('✅ File deleted successfully')
          }
        } catch (error) {
          console.error('❌ Failed to delete:', error)
          // Use Tauri dialog for error too
          const { message } = await import('@tauri-apps/plugin-dialog')
          await message(`Failed to delete ${itemType}: ${error}`, { title: 'Error', kind: 'error' })
        }
      } else {
        console.log('❌ User cancelled, item NOT deleted:', itemName)
      }
    } catch (error) {
      console.error('Error showing confirmation dialog:', error)
    }
  }
  
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setShowMenu(true)
  }
  
  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(!showMenu)
  }
  
  // 新的鼠标拖拽处理器
  const handleMouseDown = (e: React.MouseEvent) => {
    if (node.is_directory || e.button !== 0) return // 只处理左键点击文件
    
    console.log('🖱️ Mouse down on file:', node.name)
    setDragStartPos({ x: e.clientX, y: e.clientY })
    setDragStartTime(Date.now())
    // 不要立即设置 isDragging = true，只在实际拖拽时才设置
    setGlobalDragData({ filePath: node.path, startNode: node.name })
    
    // 将拖拽数据存储到全局 window 对象
    ;(window as any).globalDragData = { filePath: node.path, startNode: node.name }
    
    e.preventDefault()
  }
  

  
  const handleDragOver = (e: React.DragEvent) => {
    console.log('🎯 handleDragOver called on:', node.name, 'is_directory:', node.is_directory)
    
    if (!node.is_directory) {
      console.log('❌ Drag over non-directory:', node.name)
      return
    }
    
    console.log('📥 Drag over folder:', node.name)
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }
  
  const handleDragLeave = (e: React.DragEvent) => {
    console.log('🚪 handleDragLeave called on:', node.name, 'is_directory:', node.is_directory)
    
    if (!node.is_directory) return
    
    // Only set to false if we're really leaving this element
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      console.log('🚪 Actually leaving folder:', node.name)
      setIsDragOver(false)
    }
  }
  
  const handleDrop = async (e: React.DragEvent) => {
    console.log('🎯 Drop event triggered on:', node.name, 'is_directory:', node.is_directory)
    
    if (!node.is_directory) {
      console.log('❌ Cannot drop on non-directory')
      return
    }
    
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    const sourcePath = e.dataTransfer.getData('text/plain')
    console.log('📦 Source path from dataTransfer:', sourcePath)
    
    if (!sourcePath) {
      console.log('❌ No source path found in dataTransfer')
      return
    }
    
    if (sourcePath === node.path) {
      console.log('❌ Cannot drop file on itself')
      return
    }
    
    // Don't allow dropping a folder into itself
    if (sourcePath.startsWith(node.path + '/')) {
      console.log('❌ Cannot move folder into itself')
      return
    }
    
    console.log('✅ Attempting to move file:', sourcePath, 'into folder:', node.path)
    
    try {
      await moveFile(sourcePath, node.path)
      console.log('✅ File moved successfully!')
    } catch (error) {
      console.error('❌ Failed to move file:', error)
      // Show error message to user
      const { message } = await import('@tauri-apps/plugin-dialog')
      await message(`Failed to move file: ${error}`, { title: 'Error', kind: 'error' })
    }
  }
  
  const isActive = activeFilePath === node.path
  const hasChildren = node.children && node.children.length > 0
  
  return (
    <div className="relative">
      <div
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors group relative',
          'hover:bg-gray-100 hover:text-gray-900',
          isActive && 'bg-blue-100 text-blue-900 border border-blue-200',
          node.modified && 'font-semibold',
          node.is_directory && isDragOver && 'bg-green-200 border-green-400 border-2',
          isDragging && 'opacity-50'
        )}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseDown={handleMouseDown}
        data-folder-path={node.is_directory ? node.path : undefined}
        style={{ 
          paddingLeft: `${12 + depth * 24}px`,
          cursor: !node.is_directory ? 'grab' : 'pointer'
        }}
      >
        {node.is_directory ? (
          hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 flex-shrink-0 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 flex-shrink-0 text-gray-500" />
            )
          ) : (
            <div className="w-4 h-4 flex-shrink-0" />
          )
        ) : (
          <div className="w-4 h-4 flex-shrink-0" />
        )}
        
        {node.is_directory ? (
          isExpanded ? (
            <FolderOpen className={cn(
              "w-4 h-4 flex-shrink-0",
              isActive ? "text-blue-700" : "text-blue-600"
            )} />
          ) : (
            <Folder className={cn(
              "w-4 h-4 flex-shrink-0",
              isActive ? "text-blue-700" : "text-blue-600"
            )} />
          )
        ) : (
          <div className={cn(
            "w-4 h-4 flex-shrink-0 flex items-center justify-center",
          )}>
            {/* 文件图标 */}
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              {/* 文件外框 */}
              <rect 
                x="3" y="2" 
                width="10" height="12" 
                rx="1" 
                fill={isActive ? "#fed7aa" : "#dbeafe"}
                stroke={isActive ? "#f97316" : "#3b82f6"}
                strokeWidth="1"
              />
              {/* 文件折角 */}
              <path
                d="M10 2 L13 2 L13 5 L10 5 Z"
                fill={isActive ? "#f97316" : "#3b82f6"}
                opacity="0.3"
              />
              <path
                d="M10 2 L10 5 L13 5"
                stroke={isActive ? "#f97316" : "#3b82f6"}
                strokeWidth="1"
                fill="none"
              />
              {/* 文件内容线条 */}
              <line x1="5" y1="7" x2="11" y2="7" stroke={isActive ? "#f97316" : "#3b82f6"} strokeWidth="0.8" />
              <line x1="5" y1="9" x2="9" y2="9" stroke={isActive ? "#f97316" : "#3b82f6"} strokeWidth="0.8" />
              <line x1="5" y1="11" x2="10" y2="11" stroke={isActive ? "#f97316" : "#3b82f6"} strokeWidth="0.8" />
            </svg>
          </div>
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
            className="flex-1 text-sm px-1 py-0 border border-blue-500 rounded outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-sm truncate flex-1">
            {node.is_directory ? node.name : node.name.replace('.excalidraw', '')}
          </span>
        )}
        
        {node.modified && (
          <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0" />
        )}
        
        <button
          onClick={handleMenuClick}
          className={cn(
            "opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity",
            isActive ? "hover:bg-blue-200" : "hover:bg-gray-200"
          )}
        >
          <MoreVertical className={cn(
            "w-3 h-3",
            isActive ? "text-blue-700" : "text-gray-600"
          )} />
        </button>
      </div>
      
      {/* Context Menu */}
      {showMenu && (
        <div 
          className="absolute right-0 top-8 z-50 bg-white rounded-md shadow-lg border border-gray-200 py-1 min-w-[150px]"
          onMouseLeave={() => setShowMenu(false)}
        >
          {node.is_directory && (
            <button
              onClick={async (e) => {
                e.stopPropagation()
                setShowMenu(false)
                
                // 创建子文件夹
                try {
                  const defaultFolderName = `New Folder ${Date.now()}`
                  const { createDirectory } = useStore.getState()
                  await createDirectory(node.path, defaultFolderName)
                  console.log('子文件夹创建成功')
                } catch (error) {
                  console.error('创建子文件夹失败:', error)
                }
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <FolderPlus className="w-3 h-3" />
              New Subfolder
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsRenaming(true)
              setShowMenu(false)
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
          >
            <Edit2 className="w-3 h-3" />
            Rename
          </button>
          <button
            onClick={(e) => {
              console.log('Delete button clicked!')
              handleDelete(e)
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600"
          >
            <Trash2 className="w-3 h-3" />
            Delete {node.is_directory ? 'Folder' : 'File'}
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
      
      {/* 拖拽预览元素 */}
      {isDragging && dragPreviewPos && windowGlobalDragData && (
        <div
          className="fixed z-50 pointer-events-none bg-blue-100 border border-blue-300 rounded px-2 py-1 text-sm shadow-lg"
          style={{
            left: dragPreviewPos.x + 10,
            top: dragPreviewPos.y - 10,
            transform: 'rotate(5deg)',
            opacity: 0.9
          }}
        >
          📄 {windowGlobalDragData.startNode}
        </div>
      )}
    </div>
  )
})

export function TreeView({ nodes, onFileClick, activeFilePath }: TreeViewProps) {
  const { currentDirectory, moveFile } = useStore()
  
  if (nodes.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-8">
        No .excalidraw files found
      </div>
    )
  }
  
  // 处理拖拽到根目录
  const handleRootDrop = async (e: React.MouseEvent) => {
    const dragData = (window as any).globalDragData
    if (dragData && currentDirectory) {
      console.log('🏠 Root drop handler triggered')
      
      // 检查是否真正进行了拖拽操作（避免点击被误识别为拖拽）
      const isRealDrag = (window as any).isRealDragOperation
      if (!isRealDrag) {
        console.log('🏠 Root drop cancelled - not a real drag operation')
        return
      }
      
      // 检查是否有其他更具体的目标被处理了
      const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY)
      const hasSpecificTarget = elementUnderMouse?.closest('[data-folder-path]:not([data-folder-path="' + currentDirectory + '"])')
      
      if (hasSpecificTarget) {
        console.log('🏠 Root drop cancelled - specific target found:', hasSpecificTarget)
        return
      }
      
      console.log('🎯 Attempting to move file to root:', dragData.filePath, 'to:', currentDirectory)
      
      try {
        await moveFile(dragData.filePath, currentDirectory)
        console.log('✅ File moved to root successfully!')
      } catch (error) {
        console.error('❌ Failed to move file to root:', error)
      }
    }
  }
  
  return (
    <div 
      className="space-y-1 min-h-full"
      data-folder-path={currentDirectory}
      onMouseUp={handleRootDrop}
    >
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