import { act, fireEvent, render, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { useImageImport } from './useImageImport'
import { insertImage, readNativeClipboardImage } from '../lib/imageImport'

vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true }))
vi.mock('../lib/imageImport', () => ({
  insertImage: vi.fn(), readNativeClipboardImage: vi.fn(),
  imageMimeType: (file: File) => file.type.startsWith('image/') ? file.type : null,
  svgFile: () => null,
}))

const api = { updateScene: vi.fn() } as unknown as ExcalidrawImperativeAPI
const file = new File(['png'], 'clipboard.png', { type: 'image/png' })
function Harness({ enabled = true }: { enabled?: boolean }) {
  const { containerRef, pasteImage } = useImageImport(api, enabled)
  return <div ref={containerRef}><div className="excalidraw" tabIndex={0} data-testid="canvas" /><input aria-label="Text input" />
    <button onClick={() => { void pasteImage() }}>Paste image</button></div>
}

describe('desktop image paste routing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(insertImage).mockReset().mockResolvedValue(undefined)
    vi.mocked(readNativeClipboardImage).mockReset().mockResolvedValue(file)
    vi.mocked(api.updateScene).mockClear()
  })
  afterEach(() => { cleanup(); vi.useRealTimers() })

  async function paste(target: HTMLElement, files: File[] = [], text = '') {
    await act(async () => {
      fireEvent.paste(target, { clipboardData: { files, getData: (type: string) => type === 'text/plain' ? text : '' } })
    })
  }

  it('imports event bytes once without also reading the native clipboard', async () => {
    const view = render(<Harness />)
    const canvas = view.getByTestId('canvas')
    canvas.focus()
    fireEvent.keyDown(canvas, { key: 'v', ctrlKey: true })
    await paste(canvas, [file])
    await act(() => vi.advanceTimersByTimeAsync(500))
    expect(insertImage).toHaveBeenCalledOnce()
    expect(readNativeClipboardImage).not.toHaveBeenCalled()
  })

  it('falls back for empty events and supports an explicit command when no event arrives', async () => {
    const view = render(<Harness />)
    const canvas = view.getByTestId('canvas')
    canvas.focus()
    await paste(canvas)
    expect(readNativeClipboardImage).toHaveBeenCalledOnce()
    expect(insertImage).toHaveBeenCalledOnce()
    fireEvent.keyDown(canvas, { key: 'v', ctrlKey: true })
    await act(() => vi.advanceTimersByTimeAsync(500))
    expect(insertImage).toHaveBeenCalledTimes(1)
    await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Paste image' })) })
    expect(insertImage).toHaveBeenCalledTimes(2)
  })

  it('leaves ordinary text, text inputs and paste-as-text to Excalidraw', async () => {
    const view = render(<Harness />)
    const canvas = view.getByTestId('canvas')
    canvas.focus()
    fireEvent.keyDown(canvas, { key: 'v', ctrlKey: true })
    await paste(canvas, [], 'ordinary text')
    await act(() => vi.advanceTimersByTimeAsync(500))
    fireEvent.keyDown(canvas, { key: 'v', ctrlKey: true, shiftKey: true })
    await paste(canvas, [file])
    const input = view.getByRole('textbox')
    input.focus()
    await paste(input, [file])
    expect(insertImage).not.toHaveBeenCalled()
    expect(readNativeClipboardImage).not.toHaveBeenCalled()
  })

  it('invalidates an async import when switching tabs or entering presentation mode', async () => {
    let resolve!: (file: File) => void
    vi.mocked(readNativeClipboardImage).mockReturnValue(new Promise(done => { resolve = done }))
    const view = render(<Harness />)
    const canvas = view.getByTestId('canvas')
    canvas.focus()
    await paste(canvas)
    view.rerender(<Harness enabled={false} />)
    await act(async () => { resolve(file) })
    expect(insertImage).not.toHaveBeenCalled()
  })

  it('does not duplicate a paste event arriving after 250 ms', async () => {
    const view = render(<Harness />)
    const canvas = view.getByTestId('canvas')
    canvas.focus()
    fireEvent.keyDown(canvas, { key: 'v', ctrlKey: true })
    await act(() => vi.advanceTimersByTimeAsync(500))
    await paste(canvas, [file])
    expect(insertImage).toHaveBeenCalledTimes(1)
    expect(readNativeClipboardImage).not.toHaveBeenCalled()
  })

  it('queues two intentional pastes while the first image is decoding', async () => {
    let finish!: () => void
    vi.mocked(insertImage).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
    const view = render(<Harness />)
    const canvas = view.getByTestId('canvas')
    canvas.focus()
    const second = new File(['second'], 'second.png', { type: 'image/png' })
    await paste(canvas, [file])
    await paste(canvas, [second])
    expect(insertImage).toHaveBeenCalledTimes(1)
    await act(async () => { finish() })
    expect(insertImage).toHaveBeenCalledTimes(2)
    expect(vi.mocked(insertImage).mock.calls[1][1]).toBe(second)
  })

  it('reads each clipboard command immediately instead of reading newer content when dequeued', async () => {
    let finish!: () => void
    vi.mocked(insertImage).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
    const view = render(<Harness />)
    const button = view.getByRole('button', { name: 'Paste image' })
    await act(async () => { fireEvent.click(button) })
    const second = new File(['second'], 'second.png', { type: 'image/png' })
    vi.mocked(readNativeClipboardImage).mockResolvedValueOnce(second)
    await act(async () => { fireEvent.click(button) })
    expect(readNativeClipboardImage).toHaveBeenCalledTimes(2)
    expect(insertImage).toHaveBeenCalledTimes(1)
    await act(async () => { finish() })
    expect(vi.mocked(insertImage).mock.calls[1][1]).toBe(second)
  })

  it('continues queued imports after a decode failure', async () => {
    vi.mocked(insertImage).mockRejectedValueOnce(new Error('Invalid image'))
    const view = render(<Harness />)
    const canvas = view.getByTestId('canvas')
    canvas.focus()
    await paste(canvas, [file])
    await paste(canvas, [file])
    expect(insertImage).toHaveBeenCalledTimes(2)
    expect(api.updateScene).toHaveBeenCalledWith({ appState: { errorMessage: 'Invalid image' } })
  })

  it('handles a queued clipboard read rejection without losing later requests', async () => {
    let finish!: () => void
    vi.mocked(insertImage).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
    const view = render(<Harness />)
    const button = view.getByRole('button', { name: 'Paste image' })
    await act(async () => { fireEvent.click(button) })
    vi.mocked(readNativeClipboardImage).mockRejectedValueOnce(new Error('Clipboard denied'))
    await act(async () => { fireEvent.click(button) })
    await act(async () => { fireEvent.click(button) })
    await act(async () => { finish() })
    expect(insertImage).toHaveBeenCalledTimes(2)
    expect(api.updateScene).toHaveBeenCalledWith({ appState: { errorMessage: 'Clipboard denied' } })
  })

  it('cancels queued work across tab changes without blocking the newly active generation', async () => {
    let finish!: () => void
    vi.mocked(insertImage).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
    const view = render(<Harness />)
    const canvas = view.getByTestId('canvas')
    canvas.focus()
    await paste(canvas, [file])
    await paste(canvas, [file])
    view.rerender(<Harness enabled={false} />)
    view.rerender(<Harness enabled />)
    canvas.focus()
    await paste(canvas, [file])
    expect(insertImage).toHaveBeenCalledTimes(2)
    expect(vi.mocked(insertImage).mock.calls[0][2]()).toBe(false)
    await act(async () => { finish() })
    expect(insertImage).toHaveBeenCalledTimes(2)
  })
})
