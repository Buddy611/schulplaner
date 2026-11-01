import { useEffect, useState } from 'react'
import { useChanges, type LessonChange } from './changes'
import { addDays, parseISODate, toISODate, toMinutes } from './dates'
import { holidayOn, regionKey, useHolidays, type Holiday } from './holidays'
import {
  C,
  lessonAppliesToWeek,
  lessonSlots,
  slotTime,
  sortPeriods,
  timetableForDate,
  useActiveTimetable,
  useLookups,
  weekTypeFor,
  type Lesson,
  type Period,
  type Room,
  type Subject,
  type Teacher,
  type Timetable,
} from './models'
import { useCollection, type Item } from './repo'
import { useSettings } from './settings'
import { t } from './i18n'

/** Eine konkrete Stunde an einem bestimmten Datum */
export interface ScheduledLesson {
  date: string
  period: Period
  lesson: Item<Lesson>
  /** Fach (bei Vertretung in anderem Fach: das Vertretungsfach) */
  subject: Item<Subject>
  room?: Item<Room>
  teacher?: Item<Teacher>
  start: Date
  end: Date
  /** letzte Stunde (bei Stunden über mehrere Stunden) */
  endPeriod: Period
  /** Lage in Halbstunden-Plätzen (siehe lessonSlots) */
  startSlot: number
  endSlot: number
  /** Ausfall / Vertretung / Raumänderung für genau diese Stunde */
  change?: Item<LessonChange>
  cancelled: boolean
}

function at(date: Date, time: string) {
  const d = new Date(date)
  const m = toMinutes(time)
  d.setHours(Math.floor(m / 60), m % 60, 0, 0)
  return d
}

/** Alles, was zur Berechnung des Plans nötig ist – an einer Stelle gebündelt */
export function useSchedule() {
  const settings = useSettings()
  const { timetable, all: allTimetables } = useActiveTimetable()
  const lessons = useCollection<Lesson>(C.lessons)
  const changes = useChanges()
  const holidays = useHolidays(regionKey(settings))
  const lookups = useLookups()
  const ready = timetable !== undefined && lessons !== undefined && changes !== undefined && lookups.loaded

  function holiday(date: Date): Holiday | null {
    return holidayOn(holidays, toISODate(date))
  }

  /** Stundenplan, der an diesem Datum gilt (siehe "gilt ab") */
  function timetableFor(date: Date): Item<Timetable> | null {
    if (!timetable) return null
    return timetableForDate(allTimetables ?? [], timetable, toISODate(date))
  }

  /**
   * Stunden an einem Datum – am Wochenende und in Ferien/an Feiertagen leer.
   * Ausfälle bleiben in der Liste (markiert), damit man sie sieht.
   */
  function lessonsOn(date: Date): ScheduledLesson[] {
    const tt = timetableFor(date)
    if (!tt || !lessons) return []
    const weekday = date.getDay()
    if (weekday === 0 || weekday === 6) return []
    if (holiday(date)) return []
    const week = weekTypeFor(tt, date)
    const iso = toISODate(date)
    const lessonPeriods = sortPeriods(tt.periods).filter((p) => p.kind === 'lesson')
    // Stunden dieses Tages; Wochen-spezifische (A/B) haben Vorrang vor "jede Woche", Überschneidungen fallen weg
    const candidates = lessons
      .filter((l) => l.timetableId === tt.id && l.day === weekday && lessonAppliesToWeek(l, week))
      .map((l) => ({ l, slots: lessonSlots(l, lessonPeriods) }))
      .filter((x): x is { l: Item<Lesson>; slots: { start: number; end: number } } => x.slots !== null)
      .sort((a, b) => Number(Boolean(b.l.week)) - Number(Boolean(a.l.week)))
    const taken: { start: number; end: number }[] = []
    const chosen = candidates.filter(({ slots }) => {
      if (taken.some((tp) => slots.start <= tp.end && tp.start <= slots.end)) return false
      taken.push(slots)
      return true
    })
    chosen.sort((a, b) => a.slots.start - b.slots.start)

    const result: ScheduledLesson[] = []
    for (const { l: lesson, slots } of chosen) {
      const period = lessonPeriods[Math.floor(slots.start / 2)]
      const endPeriod = lessonPeriods[Math.floor(slots.end / 2)]
      const planned = lookups.subjectMap.get(lesson.subjectId)
      if (!planned) continue
      const change = changes?.find((c) => c.date === iso && c.periodId === period.id)
      const subject = (change?.kind === 'vertretung' && change.subjectId && lookups.subjectMap.get(change.subjectId)) || planned
      const roomId = change?.roomId ?? lesson.roomId ?? planned.roomId
      const teacherId = (change?.kind === 'vertretung' && change.teacherId) || lesson.teacherId || planned.teacherId
      result.push({
        date: iso,
        period,
        lesson,
        subject,
        room: roomId ? lookups.roomMap.get(roomId) : undefined,
        teacher: teacherId ? lookups.teacherMap.get(teacherId) : undefined,
        start: at(date, slotTime(lessonPeriods, slots.start, 'start')),
        end: at(date, slotTime(lessonPeriods, slots.end, 'end')),
        endPeriod,
        startSlot: slots.start,
        endSlot: slots.end,
        change,
        cancelled: change?.kind === 'ausfall',
      })
    }
    return result
  }

  /** Stunden, die wirklich stattfinden (ohne Ausfälle) */
  function activeLessonsOn(date: Date) {
    return lessonsOn(date).filter((l) => !l.cancelled)
  }

  /** Erster Tag ab `from` (inklusive), an dem Unterricht stattfindet – max. 90 Tage voraus */
  function nextSchoolDay(from: Date): Date | null {
    for (let i = 0; i < 90; i++) {
      const d = addDays(from, i)
      if (activeLessonsOn(d).length > 0) return d
    }
    return null
  }

  /** Die laufende oder nächste Stunde ab jetzt (Ausfälle übersprungen) */
  function currentOrNext(now: Date): ScheduledLesson | null {
    for (let i = 0; i < 90; i++) {
      const found = activeLessonsOn(addDays(now, i)).find((l) => l.end > now)
      if (found) return found
    }
    return null
  }

  return {
    ready,
    timetable: timetable as Item<Timetable> | null | undefined,
    timetableFor,
    lessonsOn,
    activeLessonsOn,
    nextSchoolDay,
    currentOrNext,
    holiday,
    holidays,
    lookups,
    settings,
  }
}

/** Aktuelle Uhrzeit, die sich regelmäßig aktualisiert (für Countdown/"läuft gerade") */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    const onVisible = () => document.visibilityState === 'visible' && setNow(new Date())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs])
  return now
}

export function formatCountdown(minutes: number): string {
  if (minutes < 1) return t('gleich')
  if (minutes < 60) return t('in {n} Min.', { n: minutes })
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h < 24) return m ? t('in {h} Std. {m} Min.', { h, m }) : t('in {h} Std.', { h })
  const days = Math.round(minutes / 1440)
  return days === 1 ? t('morgen') : t('in {n} Tagen', { n: days })
}

export function isToday(d: Date) {
  return toISODate(d) === toISODate(new Date())
}

export { parseISODate, toISODate }
