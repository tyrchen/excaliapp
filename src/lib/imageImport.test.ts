import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { imageMimeType, insertImage, normalizeSvg, readNativeClipboardImage } from './imageImport'
import { readImage, readText } from '@tauri-apps/plugin-clipboard-manager'

vi.mock('@excalidraw/excalidraw', () => ({
  CaptureUpdateAction: { IMMEDIATELY: 'IMMEDIATELY' },
  convertToExcalidrawElements: (elements: object[]) => elements.map(element => ({ ...element, id: 'element' })),
}))
vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({ readImage: vi.fn(), readText: vi.fn() }))

describe('image import', () => {
  beforeEach(() => {
    vi.mocked(readText).mockResolvedValue('')
    vi.mocked(readImage).mockResolvedValue(null as never)
  })

  it('accepts XML declarations, comments, self-closing SVG and negative viewBox origins', () => {
    const svg = normalizeSvg('<?xml version="1.0"?><!-- diagram --><svg viewBox="-10 -20 120 80"/>')!
    const root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement
    expect(root.namespaceURI).toBe('http://www.w3.org/2000/svg')
    expect(root.getAttribute('width')).toBe('120')
    expect(root.getAttribute('height')).toBe('80')
  })

  it('rejects malformed SVG and unrelated text or HTML', () => {
    expect(normalizeSvg('<svg><path></svg>')).toBeNull()
    expect(normalizeSvg('<html><svg/></html>')).toBeNull()
    expect(normalizeSvg('ordinary text')).toBeNull()
  })

  it('recognizes image files with missing MIME types', () => {
    expect(imageMimeType(new File([''], 'drawing.SVG'))).toBe('image/svg+xml')
    expect(imageMimeType(new File([''], 'drawing.txt'))).toBeNull()
  })

  it('prefers native SVG text over a raster clipboard representation', async () => {
    vi.mocked(readText).mockResolvedValue('<?xml version="1.0"?><svg width="10" height="20"/>')
    expect((await readNativeClipboardImage())?.type).toBe('image/svg+xml')
    expect(readImage).not.toHaveBeenCalled()
  })

  it('releases the native image even when decoding fails', async () => {
    const close = vi.fn().mockResolvedValue(undefined)
    vi.mocked(readImage).mockResolvedValue({ size: vi.fn().mockRejectedValue(new Error('decode failed')), close } as never)
    await expect(readNativeClipboardImage()).rejects.toThrow('decode failed')
    expect(close).toHaveBeenCalledOnce()
  })

  it('registers bytes before inserting an undoable element at the correct zoomed position', async () => {
    const OriginalImage = globalThis.Image
    class DecodedImage {
      naturalWidth = 100
      naturalHeight = 80
      onload?: () => void
      set src(_value: string) { queueMicrotask(() => this.onload?.()) }
    }
    vi.stubGlobal('Image', DecodedImage)
    const addFiles = vi.fn()
    const updateScene = vi.fn()
    const api = { addFiles, updateScene, setActiveTool: vi.fn(),
      getAppState: () => ({ scrollX: -200, scrollY: -100, width: 1000, height: 800, zoom: { value: 2 } }),
      getSceneElements: () => [{ id: 'existing' }],
    } as unknown as ExcalidrawImperativeAPI
    try {
      await insertImage(api, new File(['png'], 'test.png', { type: 'image/png' }), () => true)
      expect(addFiles.mock.invocationCallOrder[0]).toBeLessThan(updateScene.mock.invocationCallOrder[0])
      expect(updateScene).toHaveBeenCalledWith(expect.objectContaining({
        captureUpdate: 'IMMEDIATELY', elements: [{ id: 'existing' }, expect.objectContaining({ x: 400, y: 260 })],
      }))
      addFiles.mockClear()
      await insertImage(api, new File(['png'], 'test.png', { type: 'image/png' }), () => false)
      expect(addFiles).not.toHaveBeenCalled()
    } finally {
      vi.stubGlobal('Image', OriginalImage)
    }
  })
})
