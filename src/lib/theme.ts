import { useEffect } from 'react'
import { argbFromHex, hexFromArgb, Hct, MaterialDynamicColors, SchemeTonalSpot } from '@material/material-color-utilities'
import type { Settings } from './settings'

const TEXT_SCALE = { small: 0.92, normal: 1, large: 1.1, xlarge: 1.22 }
/** Eckenrundung von Karten-Gruppen (Material 3: groß und weich) */
const RADIUS = { square: 8, normal: 20, round: 28 }
const CACHE_KEY = 'schulplaner-theme'
const colors = new MaterialDynamicColors()

/**
 * Material You: Aus der gewählten Akzentfarbe wird – wie bei Android – ein komplettes
 * Farbschema (hell oder dunkel) berechnet und als CSS-Variablen gesetzt.
 */
function materialTokens(seed: string, dark: boolean): Record<string, string> {
  let argb: number
  try {
    argb = argbFromHex(seed)
  } catch {
    argb = argbFromHex('#4285f4')
  }
  const s = new SchemeTonalSpot(Hct.fromInt(argb), dark, 0)
  const c = (dc: ReturnType<MaterialDynamicColors['primary']>) => hexFromArgb(dc.getArgb(s))
  return {
    '--bg': c(dark ? colors.surface() : colors.surfaceContainer()),
    '--card': c(dark ? colors.surfaceContainerHigh() : colors.surfaceContainerLowest()),
    '--card-pressed': c(colors.surfaceContainerHighest()),
    '--surface-high': c(colors.surfaceContainerHigh()),
    '--text': c(colors.onSurface()),
    '--text-2': c(colors.onSurfaceVariant()),
    '--separator': c(colors.outlineVariant()),
    '--outline': c(colors.outline()),
    '--fill': c(colors.surfaceContainerHighest()),
    '--bar': c(dark ? colors.surfaceContainer() : colors.surfaceContainer()),
    '--accent': c(colors.primary()),
    '--on-accent': c(colors.onPrimary()),
    '--accent-container': c(colors.primaryContainer()),
    '--on-accent-container': c(colors.onPrimaryContainer()),
    '--sec-container': c(colors.secondaryContainer()),
    '--on-sec-container': c(colors.onSecondaryContainer()),
    '--red': c(colors.error()),
  }
}

/** Setzt Hell/Dunkel, Farbschema, Schriftgröße und Eckenrundung auf der Seite. */
export function applyTheme(s: Pick<Settings, 'theme' | 'accent' | 'textSize' | 'corners'>) {
  const root = document.documentElement
  const dark = s.theme === 'dark' || (s.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  root.dataset.theme = dark ? 'dark' : 'light'
  const tokens = materialTokens(s.accent, dark)
  for (const [k, v] of Object.entries(tokens)) root.style.setProperty(k, v)
  root.style.setProperty('--text-scale', String(TEXT_SCALE[s.textSize] ?? 1))
  root.style.setProperty('--radius', `${RADIUS[s.corners] ?? 20}px`)
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', tokens['--bg']))
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(s))
  } catch {
    // egal
  }
}

/** Beim Start sofort das zuletzt benutzte Design setzen (verhindert Aufflackern). */
export function applyCachedTheme() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    applyTheme(raw ? JSON.parse(raw) : { theme: 'system', accent: '#4285f4', textSize: 'normal', corners: 'normal' })
  } catch {
    // egal
  }
}

export function useApplyTheme(s: Settings) {
  useEffect(() => {
    applyTheme(s)
    if (s.theme !== 'system') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme(s)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [s.theme, s.accent, s.textSize, s.corners]) // eslint-disable-line react-hooks/exhaustive-deps
}
