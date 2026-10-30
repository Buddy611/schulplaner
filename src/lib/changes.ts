import { useCollection } from './repo'

/** Ausfall, Vertretung oder Raumänderung für eine Stunde an einem bestimmten Datum */
export const CHANGES = 'changes'

export type ChangeKind = 'ausfall' | 'vertretung' | 'raum'

export interface LessonChange {
  date: string
  periodId: string
  kind: ChangeKind
  /** Vertretung: anderer Lehrer */
  teacherId?: string
  /** Vertretung in anderem Fach (optional) */
  subjectId?: string
  /** Raumänderung (auch bei Vertretung möglich) */
  roomId?: string
  note?: string
  createdAt: number
}

export const CHANGE_LABEL: Record<ChangeKind, string> = {
  ausfall: 'Ausfall',
  vertretung: 'Vertretung',
  raum: 'Raumänderung',
}

export function useChanges() {
  return useCollection<LessonChange>(CHANGES)
}

// ---------- Fehlstunden ----------

export const ABSENCES = 'absences'

export interface Absence {
  date: string
  /** Versäumte Stunden mit Fach (zum Zeitpunkt des Eintrags festgehalten) */
  lessons: { periodId: string; subjectId?: string; units: number }[]
  reason: string
  excused: boolean
  note?: string
  createdAt: number
}

export function useAbsences() {
  return useCollection<Absence>(ABSENCES)
}

/** Fehlstunden zählen nach Dauer: 45 Min. = 1 Stunde, 80–90 Min. = 2 */
export function unitsFor(minutes: number) {
  return Math.max(1, Math.round(minutes / 45))
}

export function absenceUnits(a: Absence) {
  return a.lessons.reduce((s, l) => s + l.units, 0)
}
