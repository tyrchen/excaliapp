import { useCallback, useEffect, useRef } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { imageMimeType, insertImage, readNativeClipboardImage, svgFile } from '../lib/imageImport'

function isTextInput(target: Element | null) {
  return !!target?.closest('input, textarea, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')
}

export function useImageImport(api: ExcalidrawImperativeAPI | null, enabled: boolean) {
  const containerRef = useRef<HTMLDivElement>(null)
  const generation = useRef(0)
  const queue = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    generation.current++
    queue.current = Promise.resolve()
    return () => { generation.current++ }
  }, [api, enabled])

  const run = useCallback((getFiles: () => Promise<File[]>, reportEmpty = false) => {
    if (!api || !enabled) return Promise.resolve()
    const token = generation.current
    const isCurrent = () => token === generation.current
    // Read now, while this action owns clipboard permission/content; serialize only insertion.
    const prepared = getFiles().then(
      files => ({ files, error: null }),
      error => ({ files: null, error }),
    )
    const task = queue.current.then(async () => {
      if (!isCurrent()) return
      try {
        const result = await prepared
        if (!isCurrent()) return
        if (!result.files) throw result.error
        if (!result.files.length && reportEmpty) throw new Error('No image or SVG found on the clipboard.')
        for (const file of result.files) {
          if (!isCurrent()) return
          await insertImage(api, file, isCurrent)
        }
        if (result.files.length && isCurrent()) containerRef.current?.querySelector<HTMLElement>('.excalidraw')?.focus()
      } catch (error) {
        if (isCurrent()) api.updateScene({ appState: { errorMessage: error instanceof Error ? error.message : 'Image import failed.' } })
      }
    })
    queue.current = task.catch(() => {})
    return task
  }, [api, enabled])

  const importFiles = useCallback((files: File[]) => run(async () => files), [run])
  const pasteImage = useCallback((reportEmpty = true) => run(async () => {
    if (isTauri()) {
      const file = await readNativeClipboardImage()
      return file ? [file] : []
    }
    const items = await navigator.clipboard.read()
    for (const item of items) {
      const type = item.types.find(type => type.startsWith('image/'))
      if (type) return [new File([await item.getType(type)], 'clipboard', { type })]
      if (item.types.includes('text/plain')) {
        const svg = svgFile(await (await item.getType('text/plain')).text())
        if (svg) return [svg]
      }
    }
    return []
  }, reportEmpty), [run])

  useEffect(() => {
    if (!enabled || !api) return
    let plainPaste = false
    const hasCanvasFocus = () => {
      const target = document.activeElement
      return containerRef.current?.contains(target) && !isTextInput(target)
    }
    const onPaste = (event: ClipboardEvent) => {
      if (!hasCanvasFocus() || plainPaste) return
      const data = event.clipboardData
      const files = Array.from(data?.files || []).filter(file => imageMimeType(file))
      const text = data?.getData('text/plain') || ''
      if (!files.length) {
        const svg = svgFile(text)
        if (svg) files.push(svg)
      }
      if (files.length) {
        event.preventDefault()
        event.stopImmediatePropagation()
        void importFiles(files)
      } else if (isTauri() && !text && !data?.getData('text/html')) {
        event.preventDefault()
        event.stopImmediatePropagation()
        void pasteImage(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'v') return
      plainPaste = event.shiftKey
    }
    const onKeyUp = () => { plainPaste = false }
    window.addEventListener('paste', onPaste, true)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    return () => {
      window.removeEventListener('paste', onPaste, true)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
    }
  }, [api, enabled, importFiles, pasteImage])

  return { containerRef, importFiles, pasteImage }
}
