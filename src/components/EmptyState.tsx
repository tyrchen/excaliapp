import { FolderOpen, File } from 'lucide-react'
import { useStore } from '../store/useStore'
import { invoke } from '@tauri-apps/api/core'

export function EmptyState() {
  const { currentDirectory } = useStore()
  
  const handleSelectDirectory = async () => {
    const dir = await invoke<string | null>('select_directory')
    if (dir) {
      await useStore.getState().loadDirectory(dir)
    }
  }

  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center max-w-md mx-auto px-6">
        {/* 图标 */}
        <div className="mb-8">
          <div className="relative w-24 h-24 mx-auto">
            {/* 背景圆形 */}
            <div className="absolute inset-0 bg-blue-100 rounded-full"></div>
            <div className="absolute inset-2 bg-blue-200 rounded-full"></div>
            
            {/* 主图标 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-12 h-12 text-blue-600" viewBox="0 0 24 24" fill="none">
                {/* 画板 */}
                <rect x="3" y="4" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
                {/* 画笔 */}
                <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                {/* 装饰线条 */}
                <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1" opacity="0.3"/>
              </svg>
            </div>
            
            {/* 装饰点 */}
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-400 rounded-full"></div>
            <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-green-400 rounded-full"></div>
          </div>
        </div>
        
        {/* 文字内容 */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">
            Welcome to OwnExcaliDesk
          </h2>
          
          {!currentDirectory ? (
            <>
              <p className="text-gray-600 leading-relaxed">
                Start by selecting a directory to browse your Excalidraw files, 
                or create new drawings right away.
              </p>
              <button
                onClick={handleSelectDirectory}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
              >
                <FolderOpen className="w-4 h-4" />
                Select Directory
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-600 leading-relaxed">
                No Excalidraw files found in the current directory.
                Create your first drawing to get started!
              </p>
              <div className="flex items-center justify-center gap-3 text-sm text-gray-500">
                <File className="w-4 h-4" />
                <span>Use the "New File" button in the sidebar</span>
              </div>
            </>
          )}
        </div>
        
        {/* 提示信息 */}
        <div className="mt-8 text-xs text-gray-500 bg-white/50 backdrop-blur-sm rounded-lg p-3">
          <p>💡 <strong>Tip:</strong> You can drag files between folders to organize your drawings</p>
        </div>
        
        {/* 开发者信息 */}
        <div className="mt-6 pt-4 border-t border-gray-200/50">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mb-1">
            <span>👨‍💻 柏玄 (Yangkai.Shen)</span>
          </div>
          <div className="text-xs text-gray-400 text-center mb-1">
            版本: v0.2.0 | 构建时间: 2025-08-28
          </div>
        </div>
      </div>
    </div>
  )
}