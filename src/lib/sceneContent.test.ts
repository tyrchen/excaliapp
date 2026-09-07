import { describe, expect, it } from 'vitest'
import { sameScene, sceneFingerprint } from './sceneContent'

describe('scene resource changes', () => {
  const elements = [{ id: 'image', type: 'image', fileId: 'file' }]
  const file = { id: 'file', mimeType: 'image/png', dataURL: 'data:image/png;base64,abc' }

  it('detects a resource arriving without an element change', () => {
    expect(sameScene(sceneFingerprint(elements, {}), sceneFingerprint(elements, { file }))).toBe(false)
  })

  it('detects replaced bytes for the same file id', () => {
    expect(sameScene(sceneFingerprint(elements, { file }), sceneFingerprint(elements, {
      file: { ...file, dataURL: 'data:image/png;base64,def' },
    }))).toBe(false)
  })

  it('ignores retrieval timestamps and file map ordering', () => {
    expect(sameScene(sceneFingerprint(elements, { file, second: file }), sceneFingerprint(elements, {
      second: file, file: { ...file, lastRetrieved: 123 },
    }))).toBe(true)
  })
})
