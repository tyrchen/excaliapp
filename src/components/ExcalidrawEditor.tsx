import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import { useStore } from '../store/useStore'
import { setGlobalExcalidrawAPI } from '../hooks/useMenuHandler'
import { TIMING } from '../constants'
import type { OpenTab } from '../types'

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
  const initialLoadCompleteRef = useRef(false)
  const isUserChangeRef = useRef(false)
  const lastSavedElementsRef = useRef(JSON.stringify(tab.cachedScene.elements || []))
  const hasCenteredInitialContentRef = useRef(false)
  const centerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const centerChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const initialData = useMemo(() => ({
    elements: tab.cachedScene.elements,
    appState: tab.cachedScene.appState,
    files: tab.cachedScene.files,
  }), [])

  const enableChangeTracking = useCallback(() => {
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

  useEffect(() => {
    const unsubscribe = useStore.subscribe((state, prevState) => {
      const wasSaved =
        prevState.activeFile?.path === tab.path &&
        state.activeFile?.path === tab.path &&
        prevState.isDirty &&
        !state.isDirty

      if (wasSaved && state.fileContent) {
        try {
          const data = JSON.parse(state.fileContent)
          lastSavedElementsRef.current = JSON.stringify(data.elements || [])
        } catch {
          // Ignore parse errors.
        }
      }
    })

    return unsubscribe
  }, [tab.path])

  const handleChange = useCallback((
    elements: readonly ExcalidrawElement[],
    appState: ExcalidrawAppState,
    files: any
  ) => {
    if (!isActive || !isUserChangeRef.current || !initialLoadCompleteRef.current) {
      lastSavedElementsRef.current = JSON.stringify(elements || [])
      return
    }

    const currentElements = JSON.stringify(elements || [])

    if (currentElements === lastSavedElementsRef.current) {
      return
    }

    lastSavedElementsRef.current = currentElements

    const store = useStore.getState()
    if (!store.isDirty) {
      store.setIsDirty(true)
      store.markFileAsModified(tab.path, true)
      store.markTreeNodeAsModified(tab.path, true)
    }

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

    const freshStore = useStore.getState()
    if (freshStore.activeFile?.path === tab.path) {
      freshStore.setFileContent(newContent)
    }
  }, [isActive, tab.path])

  return (
    <div
      className={`absolute inset-0 h-full ${isActive ? 'visible z-10' : 'invisible z-0 pointer-events-none'}`}
      aria-hidden={!isActive}
    >
      <Excalidraw
        initialData={initialData}
        excalidrawAPI={(api) => {
          excalidrawAPIRef.current = api
          if (isActive) {
            setGlobalExcalidrawAPI(api)
            centerInitialContent(api)
          }
        }}
        onChange={handleChange}
        theme={theme}
        viewModeEnabled={presentationMode}
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
