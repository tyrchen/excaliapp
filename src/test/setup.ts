import '@testing-library/jest-dom'
import { vi, beforeEach } from 'vitest'

// Mock Tauri API for tests
const { mockInvoke, mockListen } = vi.hoisted(() => ({ mockInvoke: vi.fn(), mockListen: vi.fn() }))

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
  isTauri: () => false,
}))

// Mock @tauri-apps/api/event
vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
  emit: vi.fn(),
}))

// Mock @tauri-apps/api/window
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    close: vi.fn(),
    minimize: vi.fn(),
    maximize: vi.fn(),
    isFullscreen: vi.fn(() => Promise.resolve(false)),
    setFullscreen: vi.fn(),
  }),
}))

// Mock @tauri-apps/plugin-dialog
vi.mock('@tauri-apps/plugin-dialog', () => ({
  ask: vi.fn(),
  message: vi.fn(),
}))

// Mock @tauri-apps/plugin-opener
vi.mock('@tauri-apps/plugin-opener', () => ({}))

// Reset mocks before each test
beforeEach(() => {
  mockInvoke.mockReset()
  mockListen.mockReset()
})

// Export mocks for use in tests
export { mockInvoke, mockListen }
