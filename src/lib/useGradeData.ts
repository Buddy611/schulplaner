import { toISODate } from './dates'
import { computeSubject, halfYearOf, useGrades, type Grade, type GradeSystem, type HalfYear, type SubjectResult } from './grades'
import { useLookups, type Subject } from './models'
import type { Item } from './repo'
import { type Settings } from './settings'
import { useHalfYearSettings } from './useHalfYears'

export interface SubjectRow {
  subject: Item<Subject>
  writtenPercent: number
  result: SubjectResult
  grades: Item<Grade>[]
}

/**
 * System, in dem ein Halbjahr angezeigt wird: das, in dem dort (überwiegend)
 * eingetragen wurde. So bleiben alte Halbjahre in Noten, neue in Punkten.
 */
function systemFor(grades: Grade[], fallback: GradeSystem): GradeSystem {
  if (grades.length === 0) return fallback
  const punkte = grades.filter((g) => g.system === 'punkte').length
  return punkte * 2 > grades.length ? 'punkte' : punkte * 2 < grades.length ? 'noten' : fallback
}

/** Noten eines Halbjahres, je Fach berechnet, plus Gesamtschnitt */
export function useGradeData(half: HalfYear | null) {
  const baseSettings = useHalfYearSettings()
  const all = useGrades()
  const { subjects, subjectMap } = useLookups()
  const current = half ?? halfYearOf(toISODate(new Date()), baseSettings)

  const inHalf = (all ?? []).filter((g) => g.date >= current.start && g.date <= current.end)
  const system = systemFor(inHalf, baseSettings.gradeSystem)
  const settings: Settings = { ...baseSettings, gradeSystem: system }

  const rows: SubjectRow[] = subjects.map((subject) => {
    const grades = inHalf.filter((g) => g.subjectId === subject.id)
    const writtenPercent = subject.writtenWeight ?? settings.writtenWeight
    return { subject, writtenPercent, grades, result: computeSubject(grades, settings, writtenPercent) }
  })
  const withTotal = rows.filter((r) => r.result.total != null)
  const average = withTotal.length ? withTotal.reduce((s, r) => s + r.result.total!, 0) / withTotal.length : null

  return {
    loaded: Boolean(all),
    /** Einstellungen mit dem Notensystem dieses Halbjahres */
    settings,
    /** System für neue Einträge (laut Einstellungen) */
    entrySystem: baseSettings.gradeSystem,
    half: current,
    rows,
    withTotal,
    average,
    subjectMap,
    allGrades: all ?? [],
  }
}
