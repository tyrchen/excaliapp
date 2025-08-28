interface DialogOptions {
  title: string
  message: string
  type?: 'info' | 'warning' | 'success'
  confirmLabel?: string
  cancelLabel?: string
  showCancel?: boolean
}

type DialogFunction = (options: DialogOptions) => Promise<boolean>

class DialogService {
  private dialogFn: DialogFunction | null = null

  setDialogFunction(fn: DialogFunction) {
    this.dialogFn = fn
  }

  async showDialog(options: DialogOptions): Promise<boolean> {
    if (!this.dialogFn) {
      // Fallback to native dialog if custom dialog is not available
      const { ask } = await import('@tauri-apps/plugin-dialog')
      return await ask(options.message, {
        title: options.title,
        kind: options.type === 'success' ? 'info' : (options.type || 'info'),
        okLabel: options.confirmLabel,
        cancelLabel: options.cancelLabel
      }) === true
    }
    
    return this.dialogFn(options)
  }
}

export const dialogService = new DialogService()