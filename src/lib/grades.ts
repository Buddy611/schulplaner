import { parseISODate, toISODate } from './dates'
import { useCollection, type Item } from './repo'
import type { Settings } from './settings'

export const GRADES = 'grades'

export type GradeKind = 'schriftlich' | 'muendlich' | 'besprechung'
export type GradeSystem = Settings['gradeSystem']

export interface Grade {
  subjectId: string
  kind: GradeKind
  /** bei schriftlich: Klausurtyp (Klausur, Test, …) */
  type?: string
  /** Wert im System, in dem die Note eingetragen wurde */
  value: number
  /** Anzeige wie eingegeben, z. B. "2-" oder "11" */
  label: string
  system: GradeSystem
  /** YYYY-MM-DD */
  date: string
  examId?: string
  note?: string
  createdAt: number
}

export function useGrades() {
  return useCollection<Grade>(GRADES)
}

export const KIND_LABEL: Record<GradeKind, string> = {
  schriftlich: 'Schriftlich',
  muendlich: 'Mündlich',
  besprechung: 'Notenbesprechung',
}

// ---------- Notenskalen ----------

const TENDENCY: Record<Settings['tendency'], number> = { third: 1 / 3, quarter: 0.25, half: 0.5 }

/** Auswahl beim Eintragen: 1+ … 6 bzw. 15 … 0 Punkte */
export function gradeOptions(s: Pick<Settings, 'gradeSystem' | 'tendency'>): { label: string; value: number }[] {
  if (s.gradeSystem === 'punkte') return Array.from({ length: 16 }, (_, i) => ({ label: String(15 - i), value: 15 - i }))
  const d = TENDENCY[s.tendency] ?? 1 / 3
  const out: { label: string; value: number }[] = []
  for (let n = 1; n <= 6; n++) {
    out.push({ label: `${n}+`, value: n - d })
    out.push({ label: `${n}`, value: n })
    if (n < 6) out.push({ label: `${n}-`, value: n + d })
  }
  return out
}

/** Umrechnung zwischen den Systemen (übliche Formel: Note = (17 − Punkte) / 3) */
export function convert(value: number, from: GradeSystem, to: GradeSystem) {
  if (from === to) return value
  return to === 'punkte' ? 17 - 3 * value : (17 - value) / 3
}

export function valueIn(g: Grade, system: GradeSystem) {
  return convert(g.value, g.system, system)
}

export function formatAverage(v: number | null | undefined, system: GradeSystem) {
  if (v == null || Number.isNaN(v)) return '–'
  return v.toLocaleString('de-DE', { minimumFractionDigits: system === 'punkte' ? 1 : 2, maximumFractionDigits: system === 'punkte' ? 1 : 2 })
}

/** Zeugnisnote: kaufmännisch gerundet (die Lehrkraft entscheidet am Ende selbst) */
export function reportGrade(v: number | null, system: GradeSystem) {
  if (v == null) return '–'
  if (system === 'punkte') return `${Math.min(15, Math.max(0, Math.round(v)))} P`
  return String(Math.min(6, Math.max(1, Math.round(v))))
}

/** Liegt der Schnitt unter dem Ziel des Fachs? (in beiden Notensystemen) */
export function belowGoal(total: number | null, goal: { value: number; system: GradeSystem } | undefined, system: GradeSystem) {
  if (total == null || !goal) return false
  const g = convert(goal.value, goal.system, system)
  return system === 'punkte' ? total < g - 1e-9 : total > g + 1e-9
}

export function goalIn(goal: { value: number; system: GradeSystem }, system: GradeSystem) {
  return convert(goal.value, goal.system, system)
}

/** Ist ein Wert besser als ein anderer? (bei Noten kleiner, bei Punkten größer) */
export function better(a: number, b: number, system: GradeSystem) {
  return system === 'punkte' ? a > b : a < b
}

// ---------- Halbjahre ----------

export interface HalfYear {
  key: string
  label: string
  start: string
  end: string
}

/** Halbjahr, in dem ein Datum liegt (Grenzen aus den Einstellungen) */
export function halfYearOf(dateIso: string, s: Pick<Settings, 'schoolYearStart' | 'secondHalfStart'>): HalfYear {
  const d = parseISODate(dateIso)
  const y = d.getFullYear()
  const md = dateIso.slice(5)
  const startY = md >= s.schoolYearStart ? y : y - 1
  const second = md >= s.secondHalfStart && md < s.schoolYearStart
  const yearLabel = `${startY}/${String(startY + 1).slice(2)}`
  if (second) {
    return {
      key: `${startY}-2`,
      label: `${yearLabel} · 2. Halbjahr`,
      start: `${startY + 1}-${s.secondHalfStart}`,
      end: toISODate(new Date(startY + 1, Number(s.schoolYearStart.slice(0, 2)) - 1, Number(s.schoolYearStart.slice(3)) - 1)),
    }
  }
  return {
    key: `${startY}-1`,
    label: `${yearLabel} · 1. Halbjahr`,
    start: `${startY}-${s.schoolYearStart}`,
    end: toISODate(new Date(startY + 1, Number(s.secondHalfStart.slice(0, 2)) - 1, Number(s.secondHalfStart.slice(3)) - 1)),
  }
}

/** Vorheriges / nächstes Halbjahr */
export function shiftHalfYear(h: HalfYear, dir: 1 | -1, s: Pick<Settings, 'schoolYearStart' | 'secondHalfStart'>): HalfYear {
  const ref = dir === 1 ? parseISODate(h.end) : parseISODate(h.start)
  ref.setDate(ref.getDate() + dir)
  return halfYearOf(toISODate(ref), s)
}

// ---------- Berechnung ----------

export interface Part {
  label: string
  value: number
  weight: number
  grade: Item<Grade>
  /** Note vor der letzten Notenbesprechung – durch den Zwischenstand ersetzt */
  replaced?: boolean
}

export interface SubjectResult {
  written: number | null
  oral: number | null
  total: number | null
  writtenParts: Part[]
  oralParts: Part[]
  /** letzte Notenbesprechung (Zwischenstand), falls vorhanden */
  besprechung?: Item<Grade>
  /** Anteil schriftlich (0–1), der tatsächlich verwendet wurde */
  writtenShare: number
  explanation: string[]
}

/** Zählt eine Note schriftlich oder mündlich? (pro Klausurtyp einstellbar) */
export function bucketOf(g: Grade, settings: Settings): 'schriftlich' | 'muendlich' | 'besprechung' {
  if (g.kind === 'besprechung') return 'besprechung'
  if (g.kind === 'muendlich') return 'muendlich'
  return settings.typeCategory?.[g.type ?? ''] ?? 'schriftlich'
}

function weighted(parts: Part[]) {
  const active = parts.filter((p) => !p.replaced)
  const w = active.reduce((s, p) => s + p.weight, 0)
  return w > 0 ? active.reduce((s, p) => s + p.value * p.weight, 0) / w : null
}

function fmt(v: number, system: GradeSystem) {
  return formatAverage(v, system)
}

function fmtW(w: number) {
  return w.toLocaleString('de-DE', { maximumFractionDigits: 2 })
}

const before = (a: Grade, b: Grade) => a.date < b.date || (a.date === b.date && a.createdAt < b.createdAt)

/**
 * Note eines Fachs in einem Halbjahr:
 * - Schriftlich/mündlich: gewichteter Schnitt; welcher Klausurtyp wohin zählt, ist einstellbar.
 * - Notenbesprechung = Zwischenstand: Sie ersetzt ALLE Noten davor (schriftlich und mündlich).
 *   Spätere Noten werden normal berechnet und mit der Besprechung verrechnet,
 *   wobei die Besprechung so viel zählt wie N Noten.
 */
export function computeSubject(grades: Item<Grade>[], settings: Settings, writtenPercent: number): SubjectResult {
  const sys = settings.gradeSystem
  const sorted = [...grades].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
  const besprechung = [...sorted].reverse().find((g) => g.kind === 'besprechung')
  const replaced = (g: Grade) => Boolean(besprechung && g !== besprechung && before(g, besprechung))

  const toPart = (g: Item<Grade>): Part => ({
    label: `${g.kind === 'muendlich' ? 'Mündlich' : g.type ?? 'Schriftlich'} ${g.label}`,
    value: valueIn(g, sys),
    weight: g.kind === 'muendlich' ? 1 : settings.typeWeights[g.type ?? ''] ?? 1,
    grade: g,
    replaced: replaced(g),
  })
  const writtenParts = sorted.filter((g) => bucketOf(g, settings) === 'schriftlich').map(toPart)
  const oralParts = sorted.filter((g) => bucketOf(g, settings) === 'muendlich').map(toPart)

  const written = weighted(writtenParts)
  const oral = weighted(oralParts)
  let share = writtenPercent / 100
  let since: number | null = null
  if (written != null && oral != null) since = share * written + (1 - share) * oral
  else if (written != null) (since = written), (share = 1)
  else if (oral != null) (since = oral), (share = 0)

  // Mit Zwischenstand verrechnen
  let total = since
  const n = settings.besprechungWeight
  const later = [...writtenParts, ...oralParts].filter((p) => !p.replaced)
  const m = later.reduce((s, p) => s + p.weight, 0)
  const bValue = besprechung ? valueIn(besprechung, sys) : null
  if (bValue != null) total = since == null ? bValue : (n * bValue + m * since) / (n + m)

  // Erklärung in Worten
  const explanation: string[] = []
  const formula = (parts: Part[]) =>
    parts
      .filter((p) => !p.replaced)
      .map((p) => (p.weight === 1 ? fmt(p.value, sys) : `${fmt(p.value, sys)} × ${fmtW(p.weight)}`))
      .join(' + ')
  const sumW = (parts: Part[]) => parts.filter((p) => !p.replaced).reduce((s, p) => s + p.weight, 0)
  if (besprechung) {
    const count = sorted.filter((g) => replaced(g)).length
    explanation.push(
      `Zwischenstand aus der Notenbesprechung vom ${parseISODate(besprechung.date).toLocaleDateString('de-DE')}: ${fmt(bValue!, sys)}` +
        (count ? ` – ersetzt ${count} frühere Note${count > 1 ? 'n' : ''}.` : '.'),
    )
  }
  const prefix = besprechung ? 'Seitdem ' : ''
  if (written != null) explanation.push(`${prefix}schriftlich: (${formula(writtenParts)}) ÷ ${fmtW(sumW(writtenParts))} = ${fmt(written, sys)}`.replace(/^s/, (c) => (prefix ? c : c.toUpperCase())))
  if (oral != null) explanation.push(`${prefix}mündlich: (${formula(oralParts)}) ÷ ${fmtW(sumW(oralParts))} = ${fmt(oral, sys)}`.replace(/^m/, (c) => (prefix ? c : c.toUpperCase())))
  if (written != null && oral != null) {
    explanation.push(`${besprechung ? 'Seitdem zusammen' : 'Gesamt'}: ${Math.round(share * 100)} % × ${fmt(written, sys)} + ${Math.round((1 - share) * 100)} % × ${fmt(oral, sys)} = ${fmt(since!, sys)}`)
  } else if (since != null && !besprechung) {
    explanation.push(`Gesamt: Es gibt bisher nur ${written != null ? 'schriftliche' : 'mündliche'} Noten, daher zählen nur diese.`)
  }
  if (besprechung && since != null) {
    explanation.push(`Gesamt: (${fmt(bValue!, sys)} × ${fmtW(n)} + ${fmt(since, sys)} × ${fmtW(m)}) ÷ ${fmtW(n + m)} = ${fmt(total!, sys)} – der Zwischenstand zählt wie ${fmtW(n)} Noten.`)
  } else if (besprechung) {
    explanation.push(`Seit der Besprechung gibt es noch keine neuen Noten, daher gilt der Zwischenstand.`)
  }

  return { written, oral, total, writtenParts, oralParts, besprechung, writtenShare: share, explanation }
}

/**
 * Zielnoten-Rechner: Welche Note braucht man in der nächsten Arbeit vom Typ `type`
 * (oder mündlich), damit das Fach auf `target` kommt? Wird schrittweise ausprobiert,
 * damit alle Regeln (Zwischenstand, Gewichte, schriftlich/mündlich) genau stimmen.
 * Ergebnis: benötigter Wert, oder 'unreachable' / 'safe'.
 */
export function requiredGrade(
  grades: Item<Grade>[],
  settings: Settings,
  writtenPercent: number,
  type: string | null,
  target: number,
): number | 'unreachable' | 'safe' {
  const sys = settings.gradeSystem
  const [best, worst] = sys === 'punkte' ? [15, 0] : [1, 6]
  const fake = (value: number): Item<Grade> => ({
    id: '__ziel',
    subjectId: '',
    kind: type ? 'schriftlich' : 'muendlich',
    type: type ?? undefined,
    value,
    label: '',
    system: sys,
    date: '9999-12-31',
    createdAt: Number.MAX_SAFE_INTEGER,
  })
  const totalWith = (v: number) => computeSubject([...grades, fake(v)], settings, writtenPercent).total!
  const reaches = (v: number) => (sys === 'punkte' ? totalWith(v) >= target - 1e-9 : totalWith(v) <= target + 1e-9)
  if (!reaches(best)) return 'unreachable'
  if (reaches(worst)) return 'safe'
  // Binäre Suche zwischen bester und schlechtester Note
  let lo = best
  let hi = worst
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (reaches(mid)) lo = mid
    else hi = mid
  }
  return lo
}

/** Laufender Gesamtschnitt nach jeder neuen Note (für das Verlaufsdiagramm) */
export function history(grades: Item<Grade>[], settings: Settings, writtenPercent: number) {
  const sorted = [...grades].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
  return sorted.map((g, i) => ({
    date: g.date,
    value: valueIn(g, settings.gradeSystem),
    average: computeSubject(sorted.slice(0, i + 1), settings, writtenPercent).total!,
    grade: g,
  }))
}
