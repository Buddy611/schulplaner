import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, parseISODate, toISODate } from './dates'
import { db, getMeta, setMeta } from './db'
import { useCollection } from './repo'

/**
 * Ferien & Feiertage kommen von der kostenlosen OpenHolidays API (openholidaysapi.org)
 * für das in den Einstellungen gewählte Bundesland. Sie werden für zwei Schuljahre
 * im Voraus geladen und nur auf dem Gerät gespeichert (funktionieren also offline).
 * Eigene freie Tage (z. B. Studientag) werden dagegen synchronisiert.
 */

export interface Holiday {
  start: string
  end: string
  name: string
  kind: 'ferien' | 'feiertag' | 'frei'
}

/** Eigener freier Tag / Zeitraum (synchronisiert) */
export interface FreeDay {
  start: string
  end: string
  name: string
  createdAt: number
}

export const FREE_DAYS = 'freeDays'
const META_KEY = 'holidays'
const REFRESH_MS = 7 * 86_400_000

interface Cached {
  state: string
  from: string
  to: string
  fetchedAt: number
  items: Holiday[]
}

interface ApiEntry {
  startDate: string
  endDate: string
  name: { language: string; text: string }[]
}

async function fetchKind(kind: 'SchoolHolidays' | 'PublicHolidays', state: string, from: string, to: string): Promise<Holiday[]> {
  const url =
    `https://openholidaysapi.org/${kind}?countryIsoCode=DE&subdivisionCode=DE-${state}` +
    `&languageIsoCode=DE&validFrom=${from}&validTo=${to}`
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`Ferien konnten nicht geladen werden (${res.status})`)
  const data = (await res.json()) as ApiEntry[]
  return data.map((e) => ({
    start: e.startDate,
    end: e.endDate,
    name: e.name.find((n) => n.language === 'DE')?.text ?? e.name[0]?.text ?? 'Frei',
    kind: kind === 'SchoolHolidays' ? 'ferien' : 'feiertag',
  }))
}

/** Lädt die Ferien neu, wenn nötig (anderes Bundesland, älter als 7 Tage oder Zeitraum läuft aus) */
export async function ensureHolidays(state: string, force = false) {
  if (!state || !navigator.onLine) return
  const cached = await getMeta<Cached>(META_KEY)
  const today = toISODate(new Date())
  // Vom 1. August des laufenden Schuljahres an zwei Schuljahre im Voraus
  const now = new Date()
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
  const from = `${startYear}-08-01`
  const to = `${startYear + 2}-07-31`
  const fresh =
    cached &&
    cached.state === state &&
    cached.from <= today &&
    cached.to >= toISODate(addDays(now, 180)) &&
    Date.now() - cached.fetchedAt < REFRESH_MS
  if (fresh && !force) return
  const [school, pub] = await Promise.all([fetchKind('SchoolHolidays', state, from, to), fetchKind('PublicHolidays', state, from, to)])
  await setMeta(META_KEY, { state, from, to, fetchedAt: Date.now(), items: [...school, ...pub] } satisfies Cached)
}

export function useHolidayCache() {
  return useLiveQuery(() => getMeta<Cached>(META_KEY), [])
}

/** Alle freien Tage: Ferien, Feiertage und eigene freie Tage */
export function useHolidays(state: string): Holiday[] {
  const cached = useHolidayCache()
  const own = useCollection<FreeDay>(FREE_DAYS)
  const api = cached && cached.state === state ? cached.items : []
  return [...api, ...(own ?? []).map((f) => ({ start: f.start, end: f.end, name: f.name, kind: 'frei' as const }))].sort((a, b) =>
    a.start.localeCompare(b.start),
  )
}

export function holidayOn(holidays: Holiday[], iso: string) {
  return holidays.find((h) => h.start <= iso && iso <= h.end) ?? null
}

/** Feriencountdown: aktuelle oder nächste Ferien + verbleibende Schultage */
export function holidayCountdown(holidays: Holiday[], today = new Date()) {
  const iso = toISODate(today)
  const current = holidays.find((h) => h.kind === 'ferien' && h.start <= iso && iso <= h.end)
  if (current) {
    const daysLeft = Math.round((parseISODate(current.end).getTime() - parseISODate(iso).getTime()) / 86_400_000)
    return { current, daysLeft }
  }
  const next = holidays.find((h) => h.kind === 'ferien' && h.start > iso)
  if (!next) return null
  let schoolDays = 0
  for (let d = new Date(today); toISODate(d) < next.start; d = addDays(d, 1)) {
    const wd = d.getDay()
    if (wd !== 0 && wd !== 6 && !holidayOn(holidays, toISODate(d))) schoolDays++
  }
  const days = Math.round((parseISODate(next.start).getTime() - parseISODate(iso).getTime()) / 86_400_000)
  return { next, days, schoolDays }
}

/** Ein Ferienzeitraum lesbar, z. B. "26.10. – 6.11.2026" */
export function formatRange(h: { start: string; end: string }) {
  const s = parseISODate(h.start)
  const e = parseISODate(h.end)
  const fmt = (d: Date, year: boolean) => d.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', ...(year ? { year: 'numeric' } : {}) })
  return h.start === h.end ? fmt(s, true) : `${fmt(s, false)} – ${fmt(e, true)}`
}

export async function clearHolidayCache() {
  await db.meta.delete(META_KEY)
}
