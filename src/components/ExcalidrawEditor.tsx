import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { ImagePlus, ClipboardPaste } from 'lucide-react'
import { useStore } from '../store/useStore'
import { setGlobalExcalidrawAPI } from '../hooks/useMenuHandler'
import { TIMING } from '../constants'
import type { OpenTab } from '../types'
import { useImageImport } from '../hooks/useImageImport'
import { IMAGE_ACCEPT } from '../lib/imageImport'
import { sameScene, sceneFingerprint } from '../lib/sceneContent'

type ExcalidrawElement = any
type ExcalidrawAppState = any

interface EditorPaneProps {
  tab: OpenTab
  isActive: boolean
  presentationMode: boolean
  theme: 'light' | 'dark'
}

function EditorPane({ tab, isActive, presentationMode, theme }: EditorPaneProps) {
  const [isReady, setIsReady] = useState(false)
  const excalidrawAPIRef = useRef<any>(null)
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { containerRef, importFiles, pasteImage } = useImageImport(api, isActive && isReady && !presentationMode)
  const initialLoadCompleteRef = useRef(false)
  const isUserChangeRef = useRef(false)
  const lastSceneRef = useRef(sceneFingerprint(tab.cachedScene.elements || [], tab.cachedScene.files))
  const hasCenteredInitialContentRef = useRef(false)
  const centerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const centerChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const initialData = useMemo(() => ({
    elements: tab.cachedScene.elements,
    appState: tab.cachedScene.appState,
    files: tab.cachedScene.files,
  }), [])

  const enableChangeTracking = useCallback(() => {
    const api = excalidrawAPIRef.current
    if (api) lastSceneRef.current = sceneFingerprint(api.getSceneElementsIncludingDeleted(), api.getFiles())
    initialLoadCompleteRef.current = true
    isUserChangeRef.current = true
    setIsReady(true)
  }, [])

  const clearCenterTimers = useCallback(() => {
    if (centerTimerRef.current) {
      clearTimeout(centerTimerRef.current)
      centerTimerRef.current = null
    }
    if (centerChangeTimerRef.current) {
      clearTimeout(centerChangeTimerRef.current)
      centerChangeTimerRef.current = null
    }
  }, [])

  const centerInitialContent = useCallback((api = excalidrawAPIRef.current) => {
    if (!isActive || !api || hasCenteredInitialContentRef.current) {
      return
    }

    const elements = tab.cachedScene.elements || []
    if (elements.length === 0) {
      hasCenteredInitialContentRef.current = true
      enableChangeTracking()
      return
    }

    hasCenteredInitialContentRef.current = true
    isUserChangeRef.current = false
    initialLoadCompleteRef.current = false
    clearCenterTimers()

    centerTimerRef.current = setTimeout(() => {
      api.scrollToContent(elements, {
        fitToContent: true,
      })
      api.refresh?.()

      centerChangeTimerRef.current = setTimeout(() => {
        centerChangeTimerRef.current = null
        enableChangeTracking()
      }, TIMING.USER_CHANGE_ENABLE_DELAY)
    }, TIMING.FILE_LOAD_DELAY)
  }, [
    clearCenterTimers,
    enableChangeTracking,
    isActive,
    tab.cachedScene.elements,
  ])

  useEffect(() => {
    centerInitialContent()
  }, [centerInitialContent])

  useEffect(() => {
    if (isActive && excalidrawAPIRef.current) {
      setGlobalExcalidrawAPI(excalidrawAPIRef.current)
    }
  }, [isActive])

  useEffect(() => {
    return () => {
      clearCenterTimers()
    }
  }, [clearCenterTimers])

  const handleChange = useCallback((
    elements: readonly ExcalidrawElement[],
    appState: ExcalidrawAppState,
    files: any
  ) => {
    if (!isUserChangeRef.current || !initialLoadCompleteRef.current) {
      return
    }

    const currentScene = sceneFingerprint(elements || [], files)

    if (sameScene(currentScene, lastSceneRef.current)) {
      return
    }

    lastSceneRef.current = currentScene

    const newContent = JSON.stringify(
      {
        type: 'excalidraw',
        version: 2,
        source: 'ExcaliApp',
        elements,
        appState: {
          gridSize: appState.gridSize,
          viewBackgroundColor: appState.viewBackgroundColor,
          currentItemFontFamily: appState.currentItemFontFamily,
          currentItemFontSize: appState.currentItemFontSize,
          currentItemStrokeColor: appState.currentItemStrokeColor,
          currentItemBackgroundColor: appState.currentItemBackgroundColor,
          currentItemFillStyle: appState.currentItemFillStyle,
          currentItemStrokeWidth: appState.currentItemStrokeWidth,
          currentItemRoughness: appState.currentItemRoughness,
          currentItemOpacity: appState.currentItemOpacity,
          currentItemTextAlign: appState.currentItemTextAlign,
        },
        files,
      },
      null,
      2
    )

    useStore.getState().updateTabContent(tab.path, newContent)
  }, [tab.path])

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 h-full ${isActive ? 'visible z-10' : 'invisible z-0 pointer-events-none'}`}
      aria-hidden={!isActive}
    >
      <Excalidraw
        initialData={initialData}
        excalidrawAPI={(api) => {
          excalidrawAPIRef.current = api
          setApi(api)
          if (isActive) {
            setGlobalExcalidrawAPI(api)
            centerInitialContent(api)
          }
        }}
        onChange={handleChange}
        theme={theme}
        viewModeEnabled={presentationMode}
        renderTopRightUI={() => presentationMode ? null : (
          <div className="flex gap-1">
            <button type="button" className="image-import-button" title="Import image" aria-label="Import image"
              disabled={!isReady} onClick={() => fileInputRef.current?.click()}><ImagePlus size={18} /></button>
            <button type="button" className="image-import-button" title="Paste image" aria-label="Paste image"
              disabled={!isReady} onClick={() => { void pasteImage() }}><ClipboardPaste size={18} /></button>
          </div>
        )}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            saveAsImage: true,
            export: {
              saveFileToDisk: true,
            },
          },
        }}
      />
      <input ref={fileInputRef} type="file" accept={IMAGE_ACCEPT} multiple hidden aria-label="Image files"
        onChange={event => {
          const files = Array.from(event.target.files || [])
          event.target.value = ''
          void importFiles(files)
        }} />
      {!isReady && isActive && (
        <div className="editor-loading absolute inset-0 z-20 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="editor-spinner h-5 w-5 animate-spin rounded-full border-2" />
            <span className="text-sm">Loading canvas...</span>
          </div>
        </div>
      )}
    </div>
  )
}

export function ExcalidrawEditor() {
  const activeFile = useStore(state => state.activeFile)
  const openTabs = useStore(state => state.openTabs)
  const presentationMode = useStore(state => state.presentationMode)
  const preferenceTheme = useStore(state => state.preferences.theme)
  const theme =
    preferenceTheme === 'dark' ||
    (preferenceTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark'
      : 'light'

  if (!activeFile) {
    return (
      <div className="editor-empty fixed inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className="text-lg mb-2">No file selected</p>
          <p className="text-sm">Select a file from the sidebar to start editing</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 relative">
      {openTabs.map((tab) => (
        <EditorPane
          key={`${tab.path}:${tab.sceneVersion}`}
          tab={tab}
          isActive={activeFile.path === tab.path}
          presentationMode={presentationMode}
          theme={theme}
        />
      ))}
    </div>
  )
}
