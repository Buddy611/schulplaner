import { useEffect } from 'react'
import { en } from './i18n-en'

/**
 * Sprache der App. Texte stehen im Code auf Deutsch und laufen durch t():
 * Bei Englisch wird die Übersetzung aus i18n-en.ts genommen, fehlt sie, bleibt es Deutsch.
 * Die Sprache wird beim Start festgelegt – beim Umschalten lädt die App einmal neu.
 */
export type LanguagePref = 'auto' | 'de' | 'en'
export type Language = 'de' | 'en'

const KEY = 'schulplaner-language'

function readPref(): LanguagePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'de' || v === 'en' || v === 'auto') return v
  } catch {
    // egal
  }
  return 'auto'
}

export function resolve(pref: LanguagePref): Language {
  if (pref !== 'auto') return pref
  const langs = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]
  return langs.some((l) => l?.toLowerCase().startsWith('de')) || !langs.length ? 'de' : 'en'
}

export const lang: Language = resolve(readPref())
if (typeof document !== 'undefined') document.documentElement.lang = lang

const missing = new Set<string>()

/**
 * Text in der aktuellen Sprache; {name}-Platzhalter werden durch vars ersetzt.
 * Ein Zusatz nach "|" unterscheidet gleiche deutsche Wörter mit verschiedener Übersetzung
 * (z. B. "Deutsch|Vokabel") und wird im Deutschen weggelassen.
 */
export function t(text: string, vars?: Record<string, string | number>): string {
  let s = text.replace(/\|.*$/, '')
  if (lang === 'en') {
    const hit = en[text]
    if (hit != null) s = hit
    else if (import.meta.env.DEV && !missing.has(text)) {
      missing.add(text)
      console.warn('[i18n] Übersetzung fehlt:', text)
    }
  }
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
  return s
}

/** Sprachcode für Datums- und Zahlenformate */
export const locale = lang === 'en' ? 'en-GB' : 'de-DE'

/** Einstellung "Sprache" übernehmen (auch, wenn sie von einem anderen Gerät synchronisiert wurde) */
export function useLanguagePref(pref: LanguagePref | undefined) {
  useEffect(() => {
    if (!pref) return
    try {
      if (localStorage.getItem(KEY) === pref) return
      localStorage.setItem(KEY, pref)
    } catch {
      return
    }
    if (resolve(pref) !== lang) location.reload()
  }, [pref])
}
