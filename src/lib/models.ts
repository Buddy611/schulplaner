import { fromMinutes, mondayOf, toISODate, toMinutes, parseISODate, weeksBetween } from './dates'
import { useCollection, type Item } from './repo'
import { useSettings } from './settings'

export const C = {
  teachers: 'teachers',
  rooms: 'rooms',
  subjects: 'subjects',
  timetables: 'timetables',
  lessons: 'lessons',
} as const

export interface Teacher {
  name: string
  short?: string
}

export interface Room {
  name: string
}

export interface Subject {
  name: string
  short: string
  color: string
  teacherId?: string
  roomId?: string
  /** Anteil schriftlich in Prozent – leer = Standard aus den Noten-Einstellungen */
  writtenWeight?: number
  /** Was man für dieses Fach einpacken muss (Packliste) */
  materials?: string[]
}

/** Ein Abschnitt im Zeitraster: Unterrichtsstunde oder Pause */
export interface Period {
  id: string
  kind: 'lesson' | 'break'
  /** eigener Name, z. B. "Mittagspause"; sonst automatisch "1. Stunde" bzw. "Pause" */
  label?: string
  start: string
  end: string
}

export interface Timetable {
  name: string
  periods: Period[]
  abWeeks: boolean
  /** Montag einer A-Woche (YYYY-MM-DD) – daraus wird jede weitere Woche berechnet */
  abRefMonday?: string
  /** Ab diesem Tag (YYYY-MM-DD) gilt der Plan automatisch – z. B. ab dem 2. Halbjahr */
  validFrom?: string
  createdAt: number
}

/**
 * Welcher Stundenplan gilt an einem Datum? Der mit dem spätesten "gilt ab", das schon erreicht ist.
 * Pläne ohne Datum gelten nur, wenn keiner mit Datum passt (dann der aktive).
 */
export function timetableForDate<T extends Timetable & { id: string }>(all: T[], active: T | null, iso: string): T | null {
  const dated = all.filter((t) => t.validFrom && t.validFrom <= iso).sort((a, b) => b.validFrom!.localeCompare(a.validFrom!))
  if (dated[0]) {
    // Ein aktiver Plan ohne Datum, der neuer angelegt ist, hat Vorrang vor älteren datierten Plänen
    if (active && !active.validFrom && active.createdAt > dated[0].createdAt) return active
    return dated[0]
  }
  if (active && active.validFrom && active.validFrom > iso) {
    // Aktiver Plan gilt erst später → bis dahin der neueste Plan ohne Datum
    return [...all].filter((t) => !t.validFrom).sort((a, b) => b.createdAt - a.createdAt)[0] ?? active
  }
  return active
}

export type WeekType = 'A' | 'B'

export interface Lesson {
  timetableId: string
  /** 1 = Montag … 5 = Freitag */
  day: number
  periodId: string
  subjectId: string
  /** nur gesetzt, wenn abweichend vom Standard des Fachs */
  teacherId?: string
  roomId?: string
  /** nur bei A/B-Wochen: gilt nur in dieser Woche; leer = jede Woche */
  week?: WeekType
  /** 1 = beginnt erst in der Mitte der Stunde (2. Hälfte) */
  startHalf?: 0 | 1
  /** letzte Stunde, wenn die Stunde über mehrere Stunden geht (leer = dieselbe) */
  endPeriodId?: string
  /** 0 = endet in der Mitte der letzten Stunde, 1 (Standard) = am Ende */
  endHalf?: 0 | 1
}

/**
 * Lage einer Stunde in "Halbstunden-Plätzen": Jede Unterrichtsstunde hat zwei Plätze
 * (1. und 2. Hälfte). Pausen zählen nicht mit.
 */
export function lessonSlots(l: Lesson, lessonPeriods: Period[]) {
  const s = lessonPeriods.findIndex((p) => p.id === l.periodId)
  if (s < 0) return null
  const e0 = l.endPeriodId ? lessonPeriods.findIndex((p) => p.id === l.endPeriodId) : s
  const e = e0 < s ? s : e0
  const start = s * 2 + (l.startHalf ?? 0)
  const end = Math.max(start, e * 2 + (l.endHalf ?? 1))
  return { start, end }
}

/** Uhrzeit eines Platzes (Beginn der Hälfte bzw. Ende) */
export function slotTime(lessonPeriods: Period[], slot: number, edge: 'start' | 'end') {
  const p = lessonPeriods[Math.floor(slot / 2)]
  if (!p) return '00:00'
  const a = toMinutes(p.start)
  const b = toMinutes(p.end)
  const mid = Math.round((a + b) / 2)
  const half = slot % 2
  if (edge === 'start') return fromMinutes(half ? mid : a)
  return fromMinutes(half ? b : mid)
}

export const SUBJECT_COLORS = [
  '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#30b0c7',
  '#007aff', '#5856d6', '#af52de', '#ff2d55', '#a2845e', '#8e8e93',
]

/** Typische Schulfächer zum schnellen Anlegen (Namen später frei änderbar) */
export const STANDARD_SUBJECTS: Omit<Subject, 'teacherId' | 'roomId'>[] = [
  { name: 'Deutsch', short: 'De', color: '#e53935' },
  { name: 'Mathematik', short: 'Ma', color: '#3949ab' },
  { name: 'Englisch', short: 'En', color: '#fb8c00' },
  { name: 'Französisch', short: 'Fr', color: '#1e88e5' },
  { name: 'Latein', short: 'La', color: '#fdd835' },
  { name: 'Spanisch', short: 'Sn', color: '#f4511e' },
  { name: 'Biologie', short: 'Bi', color: '#7cb342' },
  { name: 'Chemie', short: 'Ch', color: '#43a047' },
  { name: 'Physik', short: 'Ph', color: '#757575' },
  { name: 'Informatik', short: 'If', color: '#00897b' },
  { name: 'Geschichte', short: 'Ge', color: '#29b6f6' },
  { name: 'Erdkunde', short: 'Ek', color: '#8d6e63' },
  { name: 'Politik', short: 'Po', color: '#ad1457' },
  { name: 'Wirtschaft', short: 'Wi', color: '#6a1b9a' },
  { name: 'Ev. Religion', short: 'eRe', color: '#c0ca33' },
  { name: 'Kath. Religion', short: 'kRe', color: '#afb42b' },
  { name: 'Ethik', short: 'Et', color: '#9e9d24' },
  { name: 'Philosophie', short: 'Phi', color: '#5d4037' },
  { name: 'Kunst', short: 'Ku', color: '#d81b60' },
  { name: 'Musik', short: 'Mu', color: '#00838f' },
  { name: 'Darstellendes Spiel', short: 'DS', color: '#6d4c41' },
  { name: 'Sport', short: 'Sp', color: '#f06292' },
]

/** Beispiel-Zeitraster für einen neuen Stundenplan – frei änderbar */
export function templatePeriods(): Period[] {
  const p = (kind: Period['kind'], start: string, end: string, label?: string): Period => ({
    id: crypto.randomUUID(),
    kind,
    start,
    end,
    ...(label ? { label } : {}),
  })
  return [
    p('lesson', '08:00', '08:45'),
    p('lesson', '08:45', '09:30'),
    p('break', '09:30', '09:50'),
    p('lesson', '09:50', '10:35'),
    p('lesson', '10:35', '11:20'),
    p('break', '11:20', '11:40'),
    p('lesson', '11:40', '12:25'),
    p('lesson', '12:25', '13:10'),
  ]
}

export function sortPeriods(periods: Period[]): Period[] {
  return [...periods].sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
}

/** Nummer der Stunde (1, 2, 3 …), Pausen zählen nicht mit */
export function lessonNumber(periods: Period[], periodId: string): number {
  let n = 0
  for (const p of sortPeriods(periods)) {
    if (p.kind === 'lesson') n++
    if (p.id === periodId) return n
  }
  return 0
}

export function periodTitle(periods: Period[], period: Period): string {
  if (period.label) return period.label
  return period.kind === 'lesson' ? `${lessonNumber(periods, period.id)}. Stunde` : 'Pause'
}

/** A- oder B-Woche für ein Datum (null, wenn der Stundenplan keine A/B-Wochen hat) */
export function weekTypeFor(tt: Timetable, date: Date): WeekType | null {
  if (!tt.abWeeks) return null
  const ref = tt.abRefMonday ? parseISODate(tt.abRefMonday) : mondayOf(new Date())
  return Math.abs(weeksBetween(ref, date)) % 2 === 0 ? 'A' : 'B'
}

/** Setzt den Bezug so, dass die Woche von `date` die gewünschte Woche ist */
export function abRefFor(date: Date, current: WeekType): string {
  const monday = mondayOf(date)
  if (current === 'B') monday.setDate(monday.getDate() - 7)
  return toISODate(monday)
}

export function lessonAppliesToWeek(lesson: Lesson, week: WeekType | null) {
  return !lesson.week || !week || lesson.week === week
}

export function byName<T extends { name: string }>(a: T, b: T) {
  return a.name.localeCompare(b.name, 'de')
}

/** Aktiver Stundenplan (laut Einstellungen, sonst der älteste) */
export function useActiveTimetable(): { timetable: Item<Timetable> | null | undefined; all: Item<Timetable>[] | undefined } {
  const settings = useSettings()
  const all = useCollection<Timetable>(C.timetables)
  if (!all) return { timetable: undefined, all }
  const sorted = [...all].sort((a, b) => a.createdAt - b.createdAt)
  const timetable = sorted.find((t) => t.id === settings.activeTimetableId) ?? sorted[0] ?? null
  return { timetable, all: sorted }
}

/** Nachschlage-Tabellen für Fächer, Lehrer und Räume */
export function useLookups() {
  const subjects = useCollection<Subject>(C.subjects)
  const teachers = useCollection<Teacher>(C.teachers)
  const rooms = useCollection<Room>(C.rooms)
  return {
    subjects: [...(subjects ?? [])].sort(byName),
    teachers: [...(teachers ?? [])].sort(byName),
    rooms: [...(rooms ?? [])].sort(byName),
    subjectMap: new Map((subjects ?? []).map((s) => [s.id, s])),
    teacherMap: new Map((teachers ?? []).map((t) => [t.id, t])),
    roomMap: new Map((rooms ?? []).map((r) => [r.id, r])),
    loaded: Boolean(subjects && teachers && rooms),
  }
}
