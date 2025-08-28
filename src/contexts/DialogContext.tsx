import { createContext, useContext, useState, ReactNode, useEffect } from 'react'
import { CustomDialog } from '../components/CustomDialog'
import { dialogService } from '../services/dialogService'

interface DialogOptions {
  title: string
  message: string
  type?: 'info' | 'warning' | 'success'
  confirmLabel?: string
  cancelLabel?: string
  showCancel?: boolean
}

interface DialogContextType {
  showDialog: (options: DialogOptions) => Promise<boolean>
}

const DialogContext = createContext<DialogContextType | null>(null)

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean
    options: DialogOptions
    resolve?: (value: boolean) => void
  }>({
    isOpen: false,
    options: { title: '', message: '' }
  })

  const showDialog = (options: DialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        options,
        resolve
      })
    })
  }

  const handleClose = () => {
    setDialogState(prev => ({ ...prev, isOpen: false }))
    if (dialogState.resolve) {
      // Return null to indicate the user canceled/closed without choosing
      dialogState.resolve(null as any)
    }
  }

  const handleConfirm = () => {
    setDialogState(prev => ({ ...prev, isOpen: false }))
    if (dialogState.resolve) {
      dialogState.resolve(true)
    }
  }

  const handleCancel = () => {
    setDialogState(prev => ({ ...prev, isOpen: false }))
    if (dialogState.resolve) {
      dialogState.resolve(false)
    }
  }

  useEffect(() => {
    // Register the dialog function with the service
    dialogService.setDialogFunction(showDialog)
  }, [])

  return (
    <DialogContext.Provider value={{ showDialog }}>
      {children}
      <CustomDialog
        isOpen={dialogState.isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        {...dialogState.options}
      />
    </DialogContext.Provider>
  )
}

export function useDialog() {
  const context = useContext(DialogContext)
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider')
  }
  return context
}