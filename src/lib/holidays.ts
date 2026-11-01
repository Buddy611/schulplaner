import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, parseISODate, toISODate } from './dates'
import { db, getMeta, setMeta } from './db'
import { useCollection } from './repo'
import { lang, locale, t } from './i18n'

/**
 * Ferien & Feiertage kommen von der kostenlosen OpenHolidays API (openholidaysapi.org)
 * für das in den Einstellungen gewählte Land und Bundesland bzw. die Region. Sie werden für zwei Schuljahre
 * im Voraus geladen und nur auf dem Gerät gespeichert (funktionieren also offline).
 * Eigene freie Tage (z. B. Studientag) werden dagegen synchronisiert.
 */

export interface Holiday {
  start: string
  end: string
  name: string
  /** deutscher und englischer Name (für die Erkennung der Sommer-/Winterferien) */
  nameDe?: string
  nameEn?: string
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
  /** Region, siehe regionKey */
  state: string
  from: string
  to: string
  fetchedAt: number
  /** Sprache der Namen (fehlt = Deutsch) */
  lang?: string
  items: Holiday[]
}

interface ApiEntry {
  startDate: string
  endDate: string
  name: { language: string; text: string }[]
  nationwide?: boolean
}

/**
 * Region als ein Text: für Deutschland nur das Bundesland-Kürzel (z. B. "NI", wie bisher gespeichert),
 * für andere Länder "AT|AT-BL" bzw. "AT|" für das ganze Land. Leer = noch nichts gewählt.
 */
export function regionKey(s: { country?: string; state: string }) {
  return !s.country || s.country === 'DE' ? s.state : `${s.country}|${s.state}`
}

function parseRegion(key: string) {
  if (key.includes('|')) {
    const [country, sub] = key.split('|')
    return { country, sub: sub || undefined }
  }
  return { country: 'DE', sub: `DE-${key}` }
}

const API = 'https://openholidaysapi.org'

async function fetchKind(kind: 'SchoolHolidays' | 'PublicHolidays', key: string, from: string, to: string): Promise<Holiday[]> {
  const { country, sub } = parseRegion(key)
  const url = `${API}/${kind}?countryIsoCode=${country}${sub ? `&subdivisionCode=${encodeURIComponent(sub)}` : ''}&validFrom=${from}&validTo=${to}`
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(t('Ferien konnten nicht geladen werden ({status})', { status: res.status }))
  // Ganzes Land ohne Region: nur, was überall gilt
  const data = ((await res.json()) as ApiEntry[]).filter((e) => sub || e.nationwide !== false)
  return data.map((e) => ({
    start: e.startDate,
    end: e.endDate,
    name: e.name.find((n) => n.language === lang.toUpperCase())?.text ?? e.name.find((n) => n.language === 'DE')?.text ?? e.name[0]?.text ?? t('Frei'),
    nameDe: e.name.find((n) => n.language === 'DE')?.text,
    nameEn: e.name.find((n) => n.language === 'EN')?.text,
    kind: kind === 'SchoolHolidays' ? 'ferien' : 'feiertag',
  }))
}

/** Lädt die Ferien neu, wenn nötig (andere Region, älter als 7 Tage oder Zeitraum läuft aus) */
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
    (cached.lang ?? 'de') === lang &&
    cached.from <= today &&
    cached.to >= toISODate(addDays(now, 180)) &&
    Date.now() - cached.fetchedAt < REFRESH_MS
  if (fresh && !force) return
  const [school, pub] = await Promise.all([fetchKind('SchoolHolidays', state, from, to), fetchKind('PublicHolidays', state, from, to)])
  await setMeta(META_KEY, { state, from, to, fetchedAt: Date.now(), lang, items: [...school, ...pub] } satisfies Cached)
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
  const fmt = (d: Date, year: boolean) => d.toLocaleDateString(locale, { day: 'numeric', month: 'numeric', ...(year ? { year: 'numeric' } : {}) })
  return h.start === h.end ? fmt(s, true) : `${fmt(s, false)} – ${fmt(e, true)}`
}

/**
 * Halbjahre aus den Ferien ableiten (als "MM-TT"):
 * - Schuljahr beginnt am Tag nach den letzten Sommerferien
 * - 2. Halbjahr beginnt nach Ferien, die zwischen Mitte Januar und Ende Februar beginnen
 *   (Halbjahres-/Winterferien); gibt es keine, gilt der 1. Februar.
 * Gibt null zurück, wenn (noch) keine Ferien geladen sind.
 */
export function deriveHalfYears(holidays: Holiday[], ref = new Date()) {
  const ferien = holidays.filter((h) => h.kind === 'ferien')
  if (!ferien.length) return null
  const iso = toISODate(ref)
  const dayAfter = (d: string) => toISODate(addDays(parseISODate(d), 1))
  const isSummer = (h: Holiday) => /sommer|summer/i.test(`${h.nameDe ?? ''} ${h.nameEn ?? ''} ${h.name}`)
  const summers = ferien.filter(isSummer).sort((a, b) => a.start.localeCompare(b.start))
  const lastSummer = [...summers].reverse().find((h) => h.end < iso) ?? summers[0]
  const schoolYearStart = lastSummer ? dayAfter(lastSummer.end).slice(5) : '08-01'
  const winter = ferien.find((h) => {
    const md = h.start.slice(5)
    return md >= '01-15' && md <= '02-28' && !isSummer(h)
  })
  const secondHalfStart = winter ? dayAfter(winter.end).slice(5) : '02-01'
  return { schoolYearStart, secondHalfStart }
}

export async function clearHolidayCache() {
  await db.meta.delete(META_KEY)
}

export interface Place {
  code: string
  name: string
}

const nameOf = (names: { language: string; text: string }[]) =>
  names.find((n) => n.language === lang.toUpperCase())?.text ?? names.find((n) => n.language === 'EN')?.text ?? names[0]?.text ?? ''

/** Gespeicherte Liste (Länder bzw. Regionen) – damit die Auswahl auch offline klappt */
async function cachedList(key: string, url: string): Promise<Place[]> {
  const metaKey = `places:${lang}:${key}`
  const cached = await getMeta<Place[]>(metaKey)
  if (cached?.length || !navigator.onLine) return cached ?? []
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(t('Ferien konnten nicht geladen werden ({status})', { status: res.status }))
  const list = ((await res.json()) as { isoCode?: string; code?: string; name: { language: string; text: string }[] }[])
    .map((x) => ({ code: (x.isoCode ?? x.code)!, name: nameOf(x.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, lang))
  await setMeta(metaKey, list)
  return list
}

/** Länder, für die es Ferien-Daten gibt */
export function fetchCountries() {
  return cachedList('countries', `${API}/Countries?languageIsoCode=${lang.toUpperCase()}`)
}

/** Bundesländer bzw. Regionen eines Landes (oberste Ebene) */
export function fetchRegions(country: string) {
  return cachedList(`regions:${country}`, `${API}/Subdivisions?countryIsoCode=${country}&languageIsoCode=${lang.toUpperCase()}`)
}
