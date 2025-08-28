import { useEffect } from 'react'
import { X, AlertTriangle, Info, CheckCircle } from 'lucide-react'

interface CustomDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  onCancel?: () => void
  title: string
  message: string
  type?: 'info' | 'warning' | 'success'
  confirmLabel?: string
  cancelLabel?: string
  showCancel?: boolean
}

export function CustomDialog({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  title,
  message,
  type = 'info',
  confirmLabel = '确认',
  cancelLabel = '取消',
  showCancel = true
}: CustomDialogProps) {
  
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        e.stopPropagation()
        // ESC should behave like X button - just close the dialog without choosing
        onClose()
      }
    }
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-orange-500" />
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-500" />
      default:
        return <Info className="w-6 h-6 text-blue-500" />
    }
  }

  const getIconBgColor = () => {
    switch (type) {
      case 'warning':
        return 'bg-orange-100'
      case 'success':
        return 'bg-green-100'
      default:
        return 'bg-blue-100'
    }
  }

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    }
    onClose()
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      // Only close the dialog, cancel the operation
      onClose()
    }
  }

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={handleOverlayClick}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md mx-4 animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${getIconBgColor()}`}>
              {getIcon()}
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              {title}
            </h3>
          </div>
          <button
            onClick={() => onClose()}
            className="p-1 rounded-md hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        {/* Content */}
        <div className="px-6 pb-6">
          <p className="text-gray-600 leading-relaxed whitespace-pre-line">
            {message}
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-gray-100">
          {showCancel && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// Hook for easier usage
export function useCustomDialog() {
  return {
    confirm: (options: Omit<CustomDialogProps, 'isOpen' | 'onClose'>) => {
      return new Promise<boolean>((resolve) => {
        const dialog = document.createElement('div')
        dialog.id = 'custom-dialog-root'
        document.body.appendChild(dialog)

        const cleanup = () => {
          document.body.removeChild(dialog)
        }

        const handleConfirm = () => {
          cleanup()
          resolve(true)
        }

        const handleCancel = () => {
          cleanup()
          resolve(false)
        }

        // This would need React portal implementation in a real app
        // For now, we'll keep using the Tauri dialogs but with better styling
      })
    }
  }
}