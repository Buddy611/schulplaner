import { useEffect, useState } from 'react'
import { useChanges, type LessonChange } from './changes'
import { addDays, parseISODate, toISODate, toMinutes } from './dates'
import { holidayOn, useHolidays, type Holiday } from './holidays'
import {
  C,
  lessonAppliesToWeek,
  sortPeriods,
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
  const { timetable } = useActiveTimetable()
  const lessons = useCollection<Lesson>(C.lessons)
  const changes = useChanges()
  const holidays = useHolidays(settings.state)
  const lookups = useLookups()
  const ready = timetable !== undefined && lessons !== undefined && changes !== undefined && lookups.loaded

  function holiday(date: Date): Holiday | null {
    return holidayOn(holidays, toISODate(date))
  }

  /**
   * Stunden an einem Datum – am Wochenende und in Ferien/an Feiertagen leer.
   * Ausfälle bleiben in der Liste (markiert), damit man sie sieht.
   */
  function lessonsOn(date: Date): ScheduledLesson[] {
    if (!timetable || !lessons) return []
    const weekday = date.getDay()
    if (weekday === 0 || weekday === 6) return []
    if (holiday(date)) return []
    const week = weekTypeFor(timetable, date)
    const iso = toISODate(date)
    const result: ScheduledLesson[] = []
    for (const period of sortPeriods(timetable.periods)) {
      if (period.kind !== 'lesson') continue
      const candidates = lessons.filter(
        (l) => l.timetableId === timetable.id && l.day === weekday && l.periodId === period.id && lessonAppliesToWeek(l, week),
      )
      const lesson = candidates.find((l) => l.week) ?? candidates[0]
      const planned = lesson && lookups.subjectMap.get(lesson.subjectId)
      if (!lesson || !planned) continue
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
        start: at(date, period.start),
        end: at(date, period.end),
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
  if (minutes < 1) return 'gleich'
  if (minutes < 60) return `in ${minutes} Min.`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h < 24) return m ? `in ${h} Std. ${m} Min.` : `in ${h} Std.`
  const days = Math.round(minutes / 1440)
  return days === 1 ? 'morgen' : `in ${days} Tagen`
}

export function isToday(d: Date) {
  return toISODate(d) === toISODate(new Date())
}

export { parseISODate, toISODate }
