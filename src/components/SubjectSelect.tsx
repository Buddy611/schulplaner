import type { ComponentProps } from 'react'
import { addDays, formatDate } from '../lib/dates'
import { periodTitle, sortPeriods } from '../lib/models'
import { useSchedule } from '../lib/schedule'
import { EntitySelect, type SelectSuggestions } from './ui'
import { locale, t } from '../lib/i18n'

/**
 * Fach-Auswahl mit den Stunden von heute ganz oben unter "Vorgeschlagen"
 * (an Tagen ohne Unterricht: die Stunden des nächsten Schultags).
 */
export function SubjectSelect(props: Omit<ComponentProps<typeof EntitySelect>, 'items' | 'title' | 'suggested' | 'allHeading'>) {
  const schedule = useSchedule()
  const { subjects } = schedule.lookups
  let suggested: SelectSuggestions | undefined

  if (schedule.ready && schedule.timetable) {
    const now = new Date()
    let day: Date | null = now
    let lessons = schedule.activeLessonsOn(now)
    if (!lessons.length) {
      day = schedule.nextSchoolDay(addDays(now, 1))
      lessons = day ? schedule.activeLessonsOn(day) : []
    }
    if (day && lessons.length) {
      const periods = sortPeriods((schedule.timetableFor(day) ?? schedule.timetable).periods)
      const hhmm = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
      const isToday = day.toDateString() === now.toDateString()
      suggested = {
        heading: t('Vorgeschlagen · {day}', { day: isToday ? t('Heute') : formatDate(day, { weekday: 'long' }) }),
        options: lessons.map((l) => ({
          value: l.subject.id,
          label: l.subject.name,
          color: l.subject.color,
          sub: `${periodTitle(periods, l.period)} · ${hhmm(l.start)}${l.room ? ` · ${l.room.name}` : ''}`,
        })),
      }
    }
  }

  return <EntitySelect {...props} title={t('Fach')} items={subjects} suggested={suggested} allHeading={t('Alle Fächer')} />
}
