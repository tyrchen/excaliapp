import { X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { cn } from '../lib/utils'

export function TabBar() {
  const openTabs = useStore(state => state.openTabs)
  const activeFile = useStore(state => state.activeFile)
  const loadFile = useStore(state => state.loadFile)
  const closeTab = useStore(state => state.closeTab)
  const presentationMode = useStore(state => state.presentationMode)

  if (openTabs.length === 0) return null

  return (
    <div
      className={cn(
        'tab-bar flex items-center border-b overflow-x-auto shrink-0',
        presentationMode && 'presentation'
      )}
    >
      {openTabs.map((tab) => {
        const isActive = activeFile?.path === tab.path
        const isModified = tab.modified

        return (
          <div
            key={tab.path}
            className={cn(
              'tab-item group flex items-center gap-1.5 px-3 py-1.5 text-sm border-r border-t-2 border-t-transparent cursor-pointer select-none min-w-0 max-w-[180px]',
              isActive && 'active'
            )}
            onClick={() => loadFile(tab)}
          >
            <span className="truncate">
              {tab.name.replace('.excalidraw', '')}
            </span>
            {isModified && (
              <span className="modified-dot w-2 h-2 rounded-full shrink-0" />
            )}
            {!presentationMode && (
              <button
                className="tab-close opacity-0 group-hover:opacity-100 p-0.5 rounded shrink-0 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.path)
                }}
                title="Close tab"
                aria-label={`Close ${tab.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
