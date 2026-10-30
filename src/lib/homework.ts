import { addDays, formatDate, parseISODate, toISODate } from './dates'
import type { Attachment } from './files'
import { removeFiles } from './files'
import { useCollection, type Item, put, remove } from './repo'
import type { ScheduledLesson, useSchedule } from './schedule'

export const HOMEWORK = 'homework'

export interface Homework {
  subjectId: string
  /** Was zu tun ist */
  title: string
  notes?: string
  /** Fälligkeitstag YYYY-MM-DD */
  dueDate: string
  /** Stunde an diesem Tag, falls über "Nächste Stunde" gewählt */
  duePeriodId?: string
  done: boolean
  doneAt?: number
  attachments: Attachment[]
  createdAt: number
}

export function useHomework() {
  return useCollection<Homework>(HOMEWORK)
}

export function openHomework(list: Item<Homework>[] | undefined) {
  return (list ?? []).filter((h) => !h.done).sort(compareDue)
}

export function compareDue(a: Homework, b: Homework) {
  return a.dueDate.localeCompare(b.dueDate) || a.createdAt - b.createdAt
}

/** Die nächsten `count` Stunden eines Fachs nach `from` (Ferien/Ausfälle berücksichtigt der Plan) */
export function nextLessonsOfSubject(
  schedule: ReturnType<typeof useSchedule>,
  subjectId: string,
  from: Date,
  count = 2,
): ScheduledLesson[] {
  const result: ScheduledLesson[] = []
  for (let i = 0; i < 120 && result.length < count; i++) {
    const day = addDays(from, i)
    for (const l of schedule.activeLessonsOn(day)) {
      if (l.subject.id !== subjectId || l.start <= from) continue
      result.push(l)
      if (result.length >= count) break
    }
  }
  return result
}

/**
 * Schnell-Eintrag: Fach der laufenden Stunde – oder der Stunde, die vor
 * höchstens 15 Minuten geendet hat (Hausaufgaben kommen oft am Stundenende).
 */
export function currentSubjectId(schedule: ReturnType<typeof useSchedule>, now = new Date()) {
  const grace = 15 * 60_000
  const lesson = schedule.activeLessonsOn(now).find((l) => l.start <= now && now.getTime() < l.end.getTime() + grace)
  return lesson?.subject.id
}

/** Offene Hausaufgaben, die zu einer konkreten Stunde gehören */
export function homeworkForLesson(open: Item<Homework>[], l: ScheduledLesson) {
  return open.filter(
    (h) => h.dueDate === l.date && h.subjectId === l.subject.id && (!h.duePeriodId || h.duePeriodId === l.period.id),
  )
}

/** Tage bis zum Fälligkeitsdatum (0 = heute, negativ = überfällig) */
export function daysUntil(dueDate: string, now = new Date()) {
  const today = parseISODate(toISODate(now))
  return Math.round((parseISODate(dueDate).getTime() - today.getTime()) / 86_400_000)
}

export function dueLabel(dueDate: string) {
  const d = daysUntil(dueDate)
  if (d < -1) return `Seit ${-d} Tagen überfällig`
  if (d === -1) return 'Seit gestern überfällig'
  if (d === 0) return 'Heute fällig'
  if (d === 1) return 'Morgen fällig'
  return `In ${d} Tagen fällig`
}

export function dayHeading(dueDate: string) {
  return formatDate(parseISODate(dueDate), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export async function setDone(h: Item<Homework>, done: boolean) {
  const { id, ...data } = h
  await put<Homework>(HOMEWORK, id, { ...data, done, doneAt: done ? Date.now() : undefined })
}

export async function deleteHomework(h: Item<Homework>) {
  await removeFiles(h.attachments ?? [])
  await remove(h.id)
}
