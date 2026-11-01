/** Datums- und Zeit-Hilfen. Daten werden als lokales 'YYYY-MM-DD' gespeichert, Zeiten als 'HH:MM'. */
import { lang, locale } from './i18n'

export const DAY_NAMES =
  lang === 'en'
    ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    : ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
export const DAY_SHORT = lang === 'en' ? ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] : ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
/** Schultage Montag (1) bis Freitag (5) */
export const SCHOOL_DAYS = [1, 2, 3, 4, 5]

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function fromMinutes(min: number): string {
  const m = ((min % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

/** Montag der Woche, in der `d` liegt */
export function mondayOf(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7))
  return r
}

/** Kalenderwoche nach ISO 8601 (wie in deutschen Kalendern) */
export function isoWeek(d: Date): number {
  const tp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = tp.getUTCDay() || 7
  tp.setUTCDate(tp.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(tp.getUTCFullYear(), 0, 1))
  return Math.ceil(((tp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

export function formatDate(d: Date, opts: Intl.DateTimeFormatOptions) {
  return d.toLocaleDateString(locale, opts)
}

/** Ganze Wochen zwischen zwei Montagen (gerundet, robust gegen Zeitumstellung) */
export function weeksBetween(a: Date, b: Date): number {
  return Math.round((mondayOf(b).getTime() - mondayOf(a).getTime()) / (7 * 86_400_000))
}
