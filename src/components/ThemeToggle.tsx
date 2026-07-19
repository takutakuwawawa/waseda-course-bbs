import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

function initialTheme(): Theme {
  const stored = window.localStorage.getItem('minerva-community-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('minerva-community-theme', theme)
  }, [theme])

  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const Icon = theme === 'dark' ? Sun : Moon

  return (
    <button
      type="button"
      className="icon-button"
      onClick={() => setTheme(nextTheme)}
      aria-label={`${nextTheme === 'dark' ? 'ダーク' : 'ライト'}モードに切り替える`}
      title={`${nextTheme === 'dark' ? 'ダーク' : 'ライト'}モード`}
    >
      <Icon size={18} strokeWidth={1.8} />
    </button>
  )
}
