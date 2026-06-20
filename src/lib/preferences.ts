import { Preferences } from '../types'

/**
 * Convert preferences from Rust snake_case to TypeScript camelCase
 */
export function convertPreferencesFromRust(rustPrefs: any): Preferences {
  return {
    lastDirectory: rustPrefs?.last_directory || rustPrefs?.lastDirectory || null,
    recentDirectories: rustPrefs?.recent_directories || rustPrefs?.recentDirectories || [],
    theme: rustPrefs?.theme || 'system',
    sidebarVisible: rustPrefs?.sidebar_visible !== undefined
      ? rustPrefs.sidebar_visible
      : (rustPrefs?.sidebarVisible !== undefined ? rustPrefs.sidebarVisible : true),
    showDecorations: rustPrefs?.show_decorations !== undefined
      ? rustPrefs.show_decorations
      : (rustPrefs?.showDecorations !== undefined ? rustPrefs.showDecorations : true),
  }
}

/**
 * Convert preferences from TypeScript camelCase to Rust snake_case
 */
export function convertPreferencesToRust(tsPrefs: Preferences): any {
  return {
    last_directory: tsPrefs.lastDirectory || null,
    recent_directories: tsPrefs.recentDirectories || [],
    theme: tsPrefs.theme || 'system',
    sidebar_visible: tsPrefs.sidebarVisible !== undefined ? tsPrefs.sidebarVisible : true,
    show_decorations: tsPrefs.showDecorations !== undefined ? tsPrefs.showDecorations : true,
  }
}