import { CaptureUpdateAction, convertToExcalidrawElements } from '@excalidraw/excalidraw'
import type { BinaryFileData, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { readImage, readText } from '@tauri-apps/plugin-clipboard-manager'

export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml'
const MAX_BYTES = 20 * 1024 * 1024
const MAX_PIXELS = 40_000_000
const extensions: Record<string, BinaryFileData['mimeType']> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
}

export function imageMimeType(file: File): BinaryFileData['mimeType'] | null {
  if (IMAGE_ACCEPT.split(',').includes(file.type)) return file.type as BinaryFileData['mimeType']
  return extensions[file.name.split('.').pop()?.toLowerCase() || ''] || null
}

export function normalizeSvg(text: string): string | null {
  if (!text.trimStart().startsWith('<')) return null
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const svg = doc.documentElement
  if (doc.querySelector('parsererror') || svg.localName !== 'svg') return null
  if (svg.namespaceURI && svg.namespaceURI !== 'http://www.w3.org/2000/svg') return null
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const viewBox = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number)
  const hasViewBox = viewBox.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0
  for (const [attribute, index] of [['width', 2], ['height', 3]] as const) {
    const value = svg.getAttribute(attribute)
    if (!value || value.includes('%') || value === 'auto') {
      svg.setAttribute(attribute, String(hasViewBox ? viewBox[index] : 300))
    }
  }
  return new XMLSerializer().serializeToString(svg)
}

export function svgFile(text: string): File | null {
  const svg = normalizeSvg(text)
  return svg ? new File([svg], 'clipboard.svg', { type: 'image/svg+xml' }) : null
}

function dataUrl(blob: Blob): Promise<BinaryFileData['dataURL']> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as BinaryFileData['dataURL'])
    reader.onerror = () => reject(new Error('Could not read image.'))
    reader.readAsDataURL(blob)
  })
}

function dimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const width = image.naturalWidth
      const height = image.naturalHeight
      if (!width || !height || width * height > MAX_PIXELS) {
        reject(new Error('Image dimensions are invalid or exceed 40 megapixels.'))
      } else {
        resolve({ width, height })
      }
    }
    image.onerror = () => reject(new Error('Could not decode image. Check the image or SVG file.'))
    image.src = url
  })
}

export async function insertImage(
  api: ExcalidrawImperativeAPI,
  file: File,
  isCurrent: () => boolean,
) {
  const mimeType = imageMimeType(file)
  if (!mimeType) throw new Error('Unsupported image format.')
  if (file.size > MAX_BYTES) throw new Error('Images must be smaller than 20 MB.')
  let blob: Blob = file
  if (mimeType === 'image/svg+xml') {
    const svg = normalizeSvg(await file.text())
    if (!svg) throw new Error('Invalid SVG file.')
    blob = new Blob([svg], { type: mimeType })
  } else if (file.type !== mimeType) {
    blob = new Blob([file], { type: mimeType })
  }
  const url = await dataUrl(blob)
  const size = await dimensions(url)
  if (!isCurrent()) return
  const state = api.getAppState()
  if (state.viewModeEnabled) return
  const scale = Math.min(1, 1600 / Math.max(size.width, size.height))
  const width = size.width * scale
  const height = size.height * scale
  const id = crypto.randomUUID() as BinaryFileData['id']
  const elements = convertToExcalidrawElements([{
    type: 'image', fileId: id, status: 'saved', width, height,
    x: -state.scrollX + state.width / (2 * state.zoom.value) - width / 2,
    y: -state.scrollY + state.height / (2 * state.zoom.value) - height / 2,
  }])
  // Register the bytes before publishing the element so onChange sees a complete scene.
  api.addFiles([{ id, mimeType, dataURL: url, created: Date.now() }])
  api.updateScene({
    elements: [...api.getSceneElements(), ...elements],
    appState: { selectedElementIds: { [elements[0].id]: true } },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  })
  api.setActiveTool({ type: 'selection' })
}

export async function readNativeClipboardImage(): Promise<File | null> {
  // Prefer SVG text to a raster representation of the same clipboard contents.
  const text = await readText().catch(() => '')
  const svg = svgFile(text)
  if (svg) return svg
  const image = await readImage().catch(() => null)
  if (!image) return null
  try {
    const { width, height } = await image.size()
    if (!width || !height || width * height > MAX_PIXELS) {
      throw new Error('Clipboard image exceeds 40 megapixels or has invalid dimensions.')
    }
    const rgba = await image.rgba()
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not create image canvas.')
    context.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error('Could not encode clipboard image.')), 'image/png')
    })
    return new File([blob], 'clipboard.png', { type: 'image/png' })
  } finally {
    await image.close()
  }
}
