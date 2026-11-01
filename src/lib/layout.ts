import type { IconName } from '../components/Icons'
import { t } from './i18n'

/** Eintrag einer anpassbaren Liste: Reihenfolge + sichtbar ja/nein */
export interface LayoutItem {
  id: string
  visible: boolean
}

/** Abschnitte der Startseite "Heute" */
export const TODAY_SECTIONS: { id: string; label: string; sub: string }[] = [
  { id: 'next', label: t('Als Nächstes'), sub: t('Laufende bzw. nächste Stunde mit Countdown') },
  { id: 'review', label: t('Wochenrückblick-Hinweis'), sub: t('Freitags und am Wochenende') },
  { id: 'holidays', label: t('Feriencountdown'), sub: t('Schultage bis zu den nächsten Ferien') },
  { id: 'day', label: t('Tagesplan'), sub: t('Alle Stunden von heute bzw. dem nächsten Schultag') },
  { id: 'packing', label: t('Packliste'), sub: t('Was in die Tasche muss') },
  { id: 'excuses', label: t('Offene Entschuldigungen'), sub: t('Erinnerung, solange welche fehlen') },
  { id: 'goals', label: t('Noten-Warnungen'), sub: t('Fächer, die unter dein Ziel gerutscht sind') },
  { id: 'homework', label: t('Offene Hausaufgaben'), sub: t('Die nächsten 7 Tage') },
  { id: 'exams', label: t('Kommende Klausuren'), sub: t('Die nächsten 4 Wochen') },
  { id: 'more', label: t('Mehr'), sub: t('Lernen, Notizen, Fehlstunden, Vertretungen …') },
]

/** Navigation: Leiste unten (die ersten 5 sichtbaren) bzw. Seitenleiste auf dem iPad */
export const NAV_ITEMS: { id: string; label: string; short?: string; to: string; icon: IconName }[] = [
  { id: 'heute', label: t('Heute'), to: '/', icon: 'home' },
  { id: 'stundenplan', label: t('Stundenplan'), short: t('Plan'), to: '/stundenplan', icon: 'calendar' },
  { id: 'hausaufgaben', label: t('Hausaufgaben'), short: t('Aufgaben'), to: '/hausaufgaben', icon: 'list' },
  { id: 'klausuren', label: t('Klausuren'), to: '/klausuren', icon: 'exam' },
  { id: 'noten', label: t('Noten'), to: '/noten', icon: 'grade' },
  { id: 'lernen', label: t('Lernen'), to: '/lernen', icon: 'translate' },
  { id: 'notizen', label: t('Notizen'), to: '/notizen', icon: 'note' },
  { id: 'suche', label: t('Suche'), to: '/suche', icon: 'search' },
  { id: 'rueckblick', label: t('Wochenrückblick'), short: t('Rückblick'), to: '/rueckblick', icon: 'chart' },
  { id: 'fehlstunden', label: t('Fehlstunden'), to: '/fehlstunden', icon: 'absence' },
  { id: 'vertretungen', label: t('Vertretungen'), to: '/vertretungen', icon: 'swap' },
]

export const DEFAULT_TODAY_LAYOUT: LayoutItem[] = TODAY_SECTIONS.map((s) => ({ id: s.id, visible: true }))

/** Trennstriche in der Seitenleiste: eigene Einträge mit diesem Präfix (beliebig viele) */
const SEPARATOR = 'trenner-'
export const isSeparator = (id: string) => id.startsWith(SEPARATOR)
export const newSeparator = (): LayoutItem => ({ id: SEPARATOR + Math.random().toString(36).slice(2, 8), visible: true })

// Standard: Strich zwischen den Hauptbereichen (bis Noten) und dem Rest
export const DEFAULT_NAV_LAYOUT: LayoutItem[] = NAV_ITEMS.flatMap((n) => {
  const item = { id: n.id, visible: true }
  return n.id === 'noten' ? [item, { id: SEPARATOR + 'standard', visible: true }] : [item]
})

/** Gespeicherte Reihenfolge mit den bekannten Einträgen abgleichen (neue Einträge hinten anhängen) */
export function resolveLayout(saved: LayoutItem[] | undefined, defaults: LayoutItem[]): LayoutItem[] {
  if (!saved) return defaults
  const known = new Set(defaults.map((d) => d.id))
  const list = saved.filter((x) => known.has(x.id) || isSeparator(x.id))
  for (const d of defaults) if (!isSeparator(d.id) && !list.some((x) => x.id === d.id)) list.push(d)
  return list
}
