import type { CachedExcalidrawScene } from '../types'

export function sceneFingerprint(elements: CachedExcalidrawScene['elements'], files: CachedExcalidrawScene['files']) {
  // Retrieval timestamps change while viewing a scene; image bytes and versions are persistent data.
  return {
    elements: JSON.stringify(elements),
    files: Object.entries(files || {}).sort(([a], [b]) => a.localeCompare(b))
      .map(([id, file]) => [id, file.mimeType, file.dataURL, file.version]),
  }
}

export function sameScene(a: ReturnType<typeof sceneFingerprint>, b: ReturnType<typeof sceneFingerprint>) {
  // Compare byte strings directly instead of serializing megabytes on every pointer event.
  return a.elements === b.elements && a.files.length === b.files.length &&
    a.files.every((file, index) => file.every((value, field) => value === b.files[index][field]))
}
