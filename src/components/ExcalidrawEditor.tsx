import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
// Type definitions for Excalidraw elements and state
type ExcalidrawElement = any
type ExcalidrawAppState = any
import { useStore } from '../store/useStore'
import { setGlobalExcalidrawAPI } from '../hooks/useMenuHandler'
import { TIMING } from '../constants'
import { EmptyState } from './EmptyState'

export function ExcalidrawEditor() {
  const activeFile = useStore(state => state.activeFile)
  const fileContent = useStore(state => state.fileContent)
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const lastSavedContentRef = useRef<string>('')
  const lastSavedElementsRef = useRef<string>('')
  const isUserChangeRef = useRef(true)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousFilePathRef = useRef<string | null>(null)
  const initialLoadCompleteRef = useRef(false)


  // Parse initial data from fileContent
  const initialData = useMemo(() => {
    if (!fileContent || !activeFile) return null
    
    // Check if we're switching files
    if (activeFile.path !== previousFilePathRef.current) {
      previousFilePathRef.current = activeFile.path
      setIsLoading(true)
      // Disable user change detection during initial load
      isUserChangeRef.current = false
      initialLoadCompleteRef.current = false
    }
    
    try {
      const data = JSON.parse(fileContent)
      // Store this as our baseline for change detection
      lastSavedContentRef.current = fileContent
      lastSavedElementsRef.current = JSON.stringify(data.elements || [])
      
      
      return {
        elements: data.elements || [],
        appState: {
          ...data.appState,
          zoom: { value: 1 },
          scrollX: 0,
          scrollY: 0,
        },
        files: data.files,
      }
    } catch (error) {
      setIsLoading(false)
      return null
    }
  }, [activeFile?.path]) // Only re-parse when switching files, not on content changes

  // Center content and re-enable user change detection after initial load
  useEffect(() => {
    if (excalidrawAPI && initialData && isLoading && activeFile) {
      // Store the current file path to check later
      const currentFilePath = activeFile.path
      
      // Give Excalidraw time to process the initial data
      const timer = setTimeout(() => {
        // Center the content if there are elements
        if (initialData.elements && initialData.elements.length > 0) {
          excalidrawAPI.scrollToContent(initialData.elements, {
            fitToContent: true,
          })
        }
        
        // Hide loading and enable user change detection
        setTimeout(() => {
          setIsLoading(false)
          initialLoadCompleteRef.current = true
          
          // Wait a bit more before enabling user change detection
          // to ensure all initial onChange events have fired
          setTimeout(() => {
            isUserChangeRef.current = true
          }, TIMING.USER_CHANGE_ENABLE_DELAY)
          
          // Only mark file as clean if we're still on the same file
          const store = useStore.getState()
          if (store.activeFile?.path === currentFilePath) {
            store.setIsDirty(false)
            store.markFileAsModified(currentFilePath, false)
            store.markTreeNodeAsModified(currentFilePath, false)
          }
        }, TIMING.LOADING_HIDE_DELAY)
      }, TIMING.FILE_LOAD_DELAY)
      
      return () => clearTimeout(timer)
    }
  }, [excalidrawAPI, initialData, isLoading, activeFile?.path])


  // Handle changes with debouncing
  const handleChange = useCallback((
    elements: readonly ExcalidrawElement[],
    appState: ExcalidrawAppState,
    files: any
  ) => {
    // Skip if no active file
    if (!activeFile) {
      return
    }

    // Skip if this is not a user change (initial load or programmatic update)
    if (!isUserChangeRef.current || !initialLoadCompleteRef.current) {
      // Still update our baseline during initial load
      const currentElements = JSON.stringify(elements || [])
      lastSavedElementsRef.current = currentElements
      return
    }

    // Compare only elements to detect actual changes
    const currentElements = JSON.stringify(elements || [])
    
    // If elements haven't changed from our saved baseline, skip
    if (currentElements === lastSavedElementsRef.current) {
      return
    }

    // Update our baseline
    lastSavedElementsRef.current = currentElements

    // Immediately mark as dirty so file switch detection works
    const store = useStore.getState()
    if (!store.isDirty) {
      store.setIsDirty(true)
      store.markFileAsModified(activeFile.path, true)
      store.markTreeNodeAsModified(activeFile.path, true)
    }

    // Build the new content
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

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Debounce only the content update to avoid rapid re-renders
    debounceTimerRef.current = setTimeout(() => {
      const freshStore = useStore.getState()
      
      // Only update content if we're still on the same file
      if (freshStore.activeFile?.path === activeFile.path) {
        freshStore.setFileContent(newContent)
      }
    }, TIMING.DEBOUNCE_SAVE) // Debounce save operations
  }, [activeFile])

  // Handle save - update our reference
  useEffect(() => {
    const unsubscribe = useStore.subscribe((state, prevState) => {
      // When file is saved (isDirty becomes false)
      if (prevState.isDirty && !state.isDirty && state.fileContent) {
        lastSavedContentRef.current = state.fileContent
        try {
          const data = JSON.parse(state.fileContent)
          lastSavedElementsRef.current = JSON.stringify(data.elements || [])
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      // When switching files (activeFile changes)
      if (state.activeFile?.path !== prevState.activeFile?.path) {
        // Disable user change detection for file switch
        isUserChangeRef.current = false
      }
    })

    return unsubscribe
  }, [])

  // Cleanup debounce timer on unmount or file change
  useEffect(() => {
    return () => {
      // If there's a pending content update, flush it immediately before cleanup
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [activeFile?.path])


  if (!activeFile) {
    return <EmptyState />
  }

  // Use key prop to force remount when switching files
  return (
    <div className="flex-1 h-full relative" key={activeFile.path}>
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-solid border-blue-600 border-r-transparent mb-2"></div>
            <p className="text-sm text-gray-600">Loading...</p>
          </div>
        </div>
      )}
      
      {/* Excalidraw component */}
      <div className={`h-full ${isLoading ? 'invisible' : 'visible'}`}>
        <Excalidraw
          initialData={initialData}
          excalidrawAPI={(api) => {
            setExcalidrawAPI(api)
            setGlobalExcalidrawAPI(api)
          }}
          onChange={handleChange}
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
      </div>
    </div>
  )
}