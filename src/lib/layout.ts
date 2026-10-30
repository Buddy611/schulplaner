import type { IconName } from '../components/Icons'

/** Eintrag einer anpassbaren Liste: Reihenfolge + sichtbar ja/nein */
export interface LayoutItem {
  id: string
  visible: boolean
}

/** Abschnitte der Startseite "Heute" */
export const TODAY_SECTIONS: { id: string; label: string; sub: string }[] = [
  { id: 'next', label: 'Als Nächstes', sub: 'Laufende bzw. nächste Stunde mit Countdown' },
  { id: 'review', label: 'Wochenrückblick-Hinweis', sub: 'Freitags und am Wochenende' },
  { id: 'holidays', label: 'Feriencountdown', sub: 'Schultage bis zu den nächsten Ferien' },
  { id: 'day', label: 'Tagesplan', sub: 'Alle Stunden von heute bzw. dem nächsten Schultag' },
  { id: 'packing', label: 'Packliste', sub: 'Was in die Tasche muss' },
  { id: 'homework', label: 'Offene Hausaufgaben', sub: 'Die nächsten 7 Tage' },
  { id: 'exams', label: 'Kommende Klausuren', sub: 'Die nächsten 4 Wochen' },
  { id: 'more', label: 'Mehr', sub: 'Lernen, Notizen, Fehlstunden, Vertretungen …' },
]

/** Navigation: Leiste unten (die ersten 5 sichtbaren) bzw. Seitenleiste auf dem iPad */
export const NAV_ITEMS: { id: string; label: string; short?: string; to: string; icon: IconName }[] = [
  { id: 'heute', label: 'Heute', to: '/', icon: 'home' },
  { id: 'stundenplan', label: 'Stundenplan', short: 'Plan', to: '/stundenplan', icon: 'calendar' },
  { id: 'hausaufgaben', label: 'Hausaufgaben', short: 'Aufgaben', to: '/hausaufgaben', icon: 'list' },
  { id: 'klausuren', label: 'Klausuren', to: '/klausuren', icon: 'exam' },
  { id: 'noten', label: 'Noten', to: '/noten', icon: 'grade' },
  { id: 'lernen', label: 'Lernen', to: '/lernen', icon: 'translate' },
  { id: 'notizen', label: 'Notizen', to: '/notizen', icon: 'note' },
  { id: 'suche', label: 'Suche', to: '/suche', icon: 'search' },
  { id: 'rueckblick', label: 'Wochenrückblick', short: 'Rückblick', to: '/rueckblick', icon: 'chart' },
  { id: 'fehlstunden', label: 'Fehlstunden', to: '/fehlstunden', icon: 'absence' },
  { id: 'vertretungen', label: 'Vertretungen', to: '/vertretungen', icon: 'swap' },
]

export const DEFAULT_TODAY_LAYOUT: LayoutItem[] = TODAY_SECTIONS.map((s) => ({ id: s.id, visible: true }))
export const DEFAULT_NAV_LAYOUT: LayoutItem[] = NAV_ITEMS.map((n) => ({ id: n.id, visible: true }))

/** Gespeicherte Reihenfolge mit den bekannten Einträgen abgleichen (neue Einträge hinten anhängen) */
export function resolveLayout(saved: LayoutItem[] | undefined, defaults: LayoutItem[]): LayoutItem[] {
  const known = new Set(defaults.map((d) => d.id))
  const list = (saved ?? []).filter((x) => known.has(x.id))
  for (const d of defaults) if (!list.some((x) => x.id === d.id)) list.push(d)
  return list
}
