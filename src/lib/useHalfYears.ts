import { deriveHalfYears, regionKey, useHolidays } from './holidays'
import { useSettings, type Settings } from './settings'

/**
 * Einstellungen mit den tatsächlich geltenden Halbjahres-Grenzen:
 * automatisch aus den Ferien (wenn eingeschaltet und Ferien geladen sind), sonst die eigenen Werte.
 */
export function useHalfYearSettings(): Settings & { halfYearSource: 'ferien' | 'eigene' } {
  const settings = useSettings()
  const holidays = useHolidays(regionKey(settings))
  const derived = settings.halfYearAuto ? deriveHalfYears(holidays) : null
  if (!derived) return { ...settings, halfYearSource: 'eigene' }
  return { ...settings, ...derived, halfYearSource: 'ferien' }
}
