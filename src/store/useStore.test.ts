import { beforeEach, describe, expect, it } from 'vitest'
import { mockInvoke } from '../test/setup'
import { useStore } from './useStore'
import type { OpenTab } from '../types'
import { ask } from '@tauri-apps/plugin-dialog'
import { vi } from 'vitest'

function makeTab(path: string): OpenTab {
  const scene = { elements: [{ id: 'image', type: 'image', fileId: 'file' }], appState: {}, files: {} }
  return { path, name: path, modified: false, sceneVersion: 0, contentHash: 'old',
    cachedContent: JSON.stringify(scene), cachedScene: scene }
}

describe('image resource persistence', () => {
  beforeEach(() => {
    const first = makeTab('a.excalidraw')
    useStore.setState({ openTabs: [first, makeTab('b.excalidraw')], activeFile: first,
      fileContent: first.cachedContent, isDirty: false, files: [], fileTree: [] })
  })

  const withImage = JSON.stringify({ elements: [{ id: 'image', type: 'image', fileId: 'file' }],
    appState: {}, files: { file: { dataURL: 'data:image/png;base64,abc', mimeType: 'image/png' } } })

  it('saves resource-only changes and retains them when switching back to a cached tab', async () => {
    useStore.getState().updateTabContent('a.excalidraw', withImage)
    expect(useStore.getState().isDirty).toBe(true)
    mockInvoke.mockResolvedValue('saved-hash')
    await useStore.getState().saveCurrentFile()
    expect(mockInvoke).toHaveBeenCalledWith('save_file', { filePath: 'a.excalidraw', content: withImage })
    expect(useStore.getState().isDirty).toBe(false)
    useStore.setState({ activeFile: makeTab('b.excalidraw') })
    await useStore.getState().loadFile(makeTab('a.excalidraw'))
    expect(useStore.getState().fileContent).toBe(withImage)
    expect(useStore.getState().openTabs[0].cachedScene.files?.file.dataURL).toContain('abc')
  })

  it('updates only the originating tab when resources arrive in the background', () => {
    const activeContent = useStore.getState().fileContent
    useStore.getState().updateTabContent('b.excalidraw', withImage)
    expect(useStore.getState().fileContent).toBe(activeContent)
    expect(useStore.getState().isDirty).toBe(false)
    expect(useStore.getState().openTabs[1].modified).toBe(true)
    expect(useStore.getState().openTabs[1].cachedContent).toBe(withImage)
  })

  it('does not overwrite newer resources when an earlier save completes', async () => {
    let finish!: (hash: string) => void
    mockInvoke.mockImplementation(() => new Promise<string>(resolve => { finish = resolve }))
    useStore.setState({ isDirty: true })
    const saving = useStore.getState().saveCurrentFile()
    useStore.getState().updateTabContent('a.excalidraw', withImage)
    finish('saved-hash')
    await saving
    expect(useStore.getState().isDirty).toBe(true)
    expect(useStore.getState().openTabs[0].cachedContent).toBe(withImage)
  })

  it('does not reactivate a tab when its save finishes', async () => {
    let finish!: (hash: string) => void
    mockInvoke.mockImplementation(() => new Promise<string>(resolve => { finish = resolve }))
    useStore.setState({ isDirty: true })
    const saving = useStore.getState().saveCurrentFile()
    useStore.setState({ activeFile: makeTab('b.excalidraw'), isDirty: true })
    finish('saved-hash')
    await saving
    expect(useStore.getState().activeFile?.path).toBe('b.excalidraw')
    expect(useStore.getState().isDirty).toBe(true)
  })

  it('persists deleting the last image', async () => {
    const empty = JSON.stringify({ elements: [], appState: {}, files: {} })
    useStore.getState().updateTabContent('a.excalidraw', empty)
    mockInvoke.mockResolvedValue('empty-hash')
    await useStore.getState().saveCurrentFile()
    expect(mockInvoke).toHaveBeenCalledWith('save_file', { filePath: 'a.excalidraw', content: empty })
  })

  it('saves a dirty background tab before closing it', async () => {
    useStore.getState().updateTabContent('b.excalidraw', withImage)
    vi.mocked(ask).mockResolvedValue(true)
    mockInvoke.mockResolvedValue('saved-hash')
    await useStore.getState().closeTab('b.excalidraw')
    expect(ask).toHaveBeenCalled()
    expect(mockInvoke).toHaveBeenCalledWith('save_file', { filePath: 'b.excalidraw', content: withImage })
    expect(useStore.getState().openTabs.map(tab => tab.path)).toEqual(['a.excalidraw'])
    expect(useStore.getState().activeFile?.path).toBe('a.excalidraw')
  })
})
