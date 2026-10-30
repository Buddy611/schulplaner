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
  /** ältere mündliche Note, die durch eine Notenbesprechung ersetzt wurde */
  replaced?: boolean
}

export interface SubjectResult {
  written: number | null
  oral: number | null
  total: number | null
  writtenParts: Part[]
  oralParts: Part[]
  /** Anteil schriftlich (0–1), der tatsächlich verwendet wurde */
  writtenShare: number
  explanation: string[]
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

/**
 * Note eines Fachs in einem Halbjahr:
 * - Schriftlich: gewichteter Schnitt nach Klausurtyp.
 * - Mündlich: Die neueste Notenbesprechung ersetzt alle älteren mündlichen Noten.
 *   Spätere Einzelnoten zählen zusätzlich; die Besprechung zählt wie N Einzelnoten.
 * - Gesamt: Anteil schriftlich/mündlich laut Fach bzw. Standard.
 */
export function computeSubject(grades: Item<Grade>[], settings: Settings, writtenPercent: number): SubjectResult {
  const sys = settings.gradeSystem
  const sorted = [...grades].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)

  const writtenParts: Part[] = sorted
    .filter((g) => g.kind === 'schriftlich')
    .map((g) => ({
      label: `${g.type ?? 'Schriftlich'} ${g.label}`,
      value: valueIn(g, sys),
      weight: settings.typeWeights[g.type ?? ''] ?? 1,
      grade: g,
    }))

  const oralAll = sorted.filter((g) => g.kind !== 'schriftlich')
  const lastBesprechung = [...oralAll].reverse().find((g) => g.kind === 'besprechung')
  const oralParts: Part[] = oralAll.map((g) => {
    const replaced = Boolean(
      lastBesprechung &&
        g.id !== lastBesprechung.id &&
        (g.date < lastBesprechung.date || (g.date === lastBesprechung.date && g.createdAt < lastBesprechung.createdAt)),
    )
    return {
      label: `${g.kind === 'besprechung' ? 'Besprechung' : 'Mündlich'} ${g.label}`,
      value: valueIn(g, sys),
      weight: g.id === lastBesprechung?.id ? settings.besprechungWeight : 1,
      grade: g,
      replaced,
    }
  })

  const written = weighted(writtenParts)
  const oral = weighted(oralParts)
  let share = writtenPercent / 100
  let total: number | null = null
  if (written != null && oral != null) total = share * written + (1 - share) * oral
  else if (written != null) (total = written), (share = 1)
  else if (oral != null) (total = oral), (share = 0)

  // Erklärung in Worten
  const explanation: string[] = []
  const formula = (parts: Part[]) =>
    parts
      .filter((p) => !p.replaced)
      .map((p) => (p.weight === 1 ? fmt(p.value, sys) : `${fmt(p.value, sys)} × ${fmtW(p.weight)}`))
      .join(' + ')
  const sumW = (parts: Part[]) => parts.filter((p) => !p.replaced).reduce((s, p) => s + p.weight, 0)
  if (written != null) explanation.push(`Schriftlich: (${formula(writtenParts)}) ÷ ${fmtW(sumW(writtenParts))} = ${fmt(written, sys)}`)
  if (lastBesprechung) {
    const replacedCount = oralParts.filter((p) => p.replaced).length
    explanation.push(
      `Die Notenbesprechung vom ${parseISODate(lastBesprechung.date).toLocaleDateString('de-DE')} ist der aktuelle mündliche Stand` +
        (replacedCount ? ` und ersetzt ${replacedCount} ältere mündliche Note${replacedCount > 1 ? 'n' : ''}` : '') +
        `. Sie zählt wie ${fmtW(settings.besprechungWeight)} Einzelnoten.`,
    )
  }
  if (oral != null) explanation.push(`Mündlich: (${formula(oralParts)}) ÷ ${fmtW(sumW(oralParts))} = ${fmt(oral, sys)}`)
  if (written != null && oral != null) {
    explanation.push(
      `Gesamt: ${Math.round(share * 100)} % × ${fmt(written, sys)} + ${Math.round((1 - share) * 100)} % × ${fmt(oral, sys)} = ${fmt(total!, sys)}`,
    )
  } else if (total != null) {
    explanation.push(`Gesamt: Es gibt bisher nur ${written != null ? 'schriftliche' : 'mündliche'} Noten, daher zählen nur diese.`)
  }

  return { written, oral, total, writtenParts, oralParts, writtenShare: share, explanation }
}

/**
 * Zielnoten-Rechner: Welche Note braucht man in der nächsten schriftlichen Arbeit
 * (Typ mit Gewicht `typeWeight`), damit das Fach auf `target` kommt?
 */
export function requiredWrittenGrade(r: SubjectResult, target: number, typeWeight: number, writtenPercent: number) {
  const W = r.writtenParts.reduce((s, p) => s + p.weight, 0)
  const S = r.writtenParts.reduce((s, p) => s + p.value * p.weight, 0)
  const share = r.oral != null ? writtenPercent / 100 : 1
  const neededWritten = r.oral != null ? (target - (1 - share) * r.oral) / share : target
  return (neededWritten * (W + typeWeight) - S) / typeWeight
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
