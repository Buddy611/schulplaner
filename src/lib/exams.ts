import { addDays, mondayOf, parseISODate, toISODate } from './dates'
import type { Attachment } from './files'
import { removeFiles } from './files'
import { daysUntil } from './homework'
import { remove, useCollection, type Item } from './repo'
import type { ScheduledLesson } from './schedule'
import { locale, t } from './i18n'

export const EXAMS = 'exams'

/** Ein Thema im Lernplan, abhakbar */
export interface StudyTopic {
  id: string
  text: string
  done: boolean
}

export interface Exam {
  subjectId: string
  /** z. B. Klausur, Test, Sprechprüfung */
  type: string
  /** YYYY-MM-DD */
  date: string
  /** Stunde an diesem Tag – leer = allgemein für den Tag */
  periodId?: string
  /** eigene Uhrzeit statt Stunde (HH:MM) */
  startTime?: string
  endTime?: string
  roomId?: string
  topic?: string
  notes?: string
  studyTopics: StudyTopic[]
  attachments: Attachment[]
  createdAt: number
}

export function useExams() {
  return useCollection<Exam>(EXAMS)
}

export function sortExams(list: Item<Exam>[] | undefined) {
  return [...(list ?? [])].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
}

export function upcomingExams(list: Item<Exam>[] | undefined) {
  return sortExams(list).filter((e) => daysUntil(e.date) >= 0)
}

/** Klausuren, die genau in dieser Stunde stattfinden */
export function examsForLesson(exams: Item<Exam>[], l: ScheduledLesson) {
  return exams.filter((e) => e.date === l.date && e.periodId === l.period.id)
}

/** Klausuren an einem Tag ohne feste Stunde */
export function examsForDayOnly(exams: Item<Exam>[], date: string) {
  return exams.filter((e) => e.date === date && !e.periodId)
}

export function examCountdown(date: string) {
  const d = daysUntil(date)
  if (d < 0) return t('vorbei')
  if (d === 0) return t('heute')
  if (d === 1) return t('morgen')
  return t('in {n} Tagen', { n: d })
}

/** Überschrift "KW 46: 09.11.2026 – 15.11.2026" wie im bisherigen Planer */
export function weekKey(date: string) {
  return toISODate(mondayOf(parseISODate(date)))
}

export function weekRange(mondayIso: string) {
  const m = parseISODate(mondayIso)
  const fmt = (d: Date) => d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  return `${fmt(m)} – ${fmt(addDays(m, 6))}`
}

export function studyProgress(e: Exam) {
  const total = e.studyTopics?.length ?? 0
  const done = e.studyTopics?.filter((tp) => tp.done).length ?? 0
  return { total, done }
}

export async function deleteExam(e: Item<Exam>) {
  await removeFiles(e.attachments ?? [])
  await remove(e.id)
}
