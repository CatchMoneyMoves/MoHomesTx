import { useState, useEffect, useCallback } from 'react'

const KEY = 'mh_theme'

// Light/dark theme. The `dark` class on <html> flips the CSS variables in index.css.
// index.html applies the saved theme before first paint so there's no flash.
export function useTheme() {
  const [theme, setTheme] = useState(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  )

  useEffect(() => {
    const dark = theme === 'dark'
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem(KEY, theme)
    } catch (e) {}
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', dark ? '#000000' : '#0077c0')
  }, [theme])

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])

  return { theme, toggle }
}
