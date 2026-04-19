import { useSyncExternalStore } from 'react'

export const THEMES = ['dark', 'light', 'eye'] as const
export type Theme = (typeof THEMES)[number]
export const DEFAULT_THEME: Theme = 'light'
const STORAGE_KEY = 'hker-theme'

let currentTheme: Theme = DEFAULT_THEME
const listeners = new Set<() => void>()

function init() {
  if (typeof window === 'undefined') return
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && THEMES.includes(stored as Theme)) {
      currentTheme = stored as Theme
    }
  } catch { /* ignore */ }
}
init()

export function setTheme(theme: Theme) {
  currentTheme = theme
  if (typeof window !== 'undefined') {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* ignore */ }
  }
  listeners.forEach(fn => fn())
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => currentTheme,
    () => DEFAULT_THEME,
  )
  return [theme, setTheme]
}
