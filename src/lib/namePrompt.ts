interface NamePromptOptions {
  title: string
  defaultValue: string
  confirmLabel?: string
}

export function promptForName({
  title,
  defaultValue,
  confirmLabel = 'Create',
}: NamePromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'name-prompt-overlay'

    const dialog = document.createElement('form')
    dialog.className = 'name-prompt-dialog'

    const label = document.createElement('label')
    label.className = 'name-prompt-label'
    label.textContent = title

    const input = document.createElement('input')
    input.className = 'name-prompt-input'
    input.type = 'text'
    input.value = defaultValue

    const actions = document.createElement('div')
    actions.className = 'name-prompt-actions'

    const cancelButton = document.createElement('button')
    cancelButton.className = 'name-prompt-button'
    cancelButton.type = 'button'
    cancelButton.textContent = 'Cancel'

    const confirmButton = document.createElement('button')
    confirmButton.className = 'name-prompt-button primary'
    confirmButton.type = 'submit'
    confirmButton.textContent = confirmLabel

    let settled = false

    const cleanup = (value: string | null) => {
      if (settled) {
        return
      }
      settled = true
      document.removeEventListener('keydown', handleKeyDown)
      overlay.remove()
      resolve(value)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cleanup(null)
      }
    }

    dialog.addEventListener('submit', (event) => {
      event.preventDefault()
      const value = input.value.trim()
      cleanup(value || null)
    })

    cancelButton.addEventListener('click', () => cleanup(null))
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        cleanup(null)
      }
    })
    document.addEventListener('keydown', handleKeyDown)

    actions.append(cancelButton, confirmButton)
    dialog.append(label, input, actions)
    overlay.append(dialog)
    document.body.append(overlay)

    input.focus()
    input.select()
  })
}
