import { useCallback, useEffect, useState } from 'react'
import { getTheme, getThemeCssVars, themes } from './tablicaTokens'

const STORAGE_KEY = 'magzic_tablica_theme'
const DEFAULT_THEME = 'baltic'

function applyCssVars(theme) {
  const vars = getThemeCssVars(theme)
  const root = document.documentElement
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value)
}

/** Hook 4 motywów Tablice (Baltic Deep / Midnight Slate / Coastal Fog / Sunset Coast).
 *  Aplikuje CSS variables (--tb-*) globalnie na <html>, persystuje wybór w localStorage. */
export function useTablicaTheme() {
  const [themeKey, setThemeKey] = useState(() => localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME)

  useEffect(() => {
    applyCssVars(getTheme(themeKey))
  }, [themeKey])

  const setTheme = useCallback(key => {
    if (!themes[key]) return
    localStorage.setItem(STORAGE_KEY, key)
    setThemeKey(key)
  }, [])

  return { themeKey, theme: getTheme(themeKey), setTheme, themes }
}
