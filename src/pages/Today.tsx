import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSnackbar } from '../components/Snackbar'
import { currentSubjectId, daysUntil, openHomework, setDone, useHomework, type Homework } from '../lib/homework'
import type { Item } from '../lib/repo'
import { HomeworkRow } from './homework/HomeworkCard'
import { HomeworkSheet, type HomeworkDefaults } from './homework/HomeworkSheet'
import { upcomingExams, useExams, type Exam } from '../lib/exams'
import { ExamRow } from './exams/ExamsPage'
import { ExamSheet } from './exams/ExamSheet'
import { CHANGE_LABEL, useAbsences } from '../lib/changes'
import { formatRange, holidayCountdown } from '../lib/holidays'
import { LinkRow } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { addDays, formatDate, toISODate } from '../lib/dates'
import { periodTitle, sortPeriods } from '../lib/models'
import { formatCountdown, isToday, useNow, useSchedule } from '../lib/schedule'

export function Today() {
  const now = useNow()
  const schedule = useSchedule()
  const open = openHomework(useHomework())
  const [editing, setEditing] = useState<{ hw?: Item<Homework>; defaults?: HomeworkDefaults } | null>(null)
  const snackbar = useSnackbar()
  const exams = useExams()
  const absences = useAbsences()
  const [examOpen, setExamOpen] = useState<Item<Exam> | null>(null)
  if (!schedule.ready) return null
  const nextExams = upcomingExams(exams).filter((e) => daysUntil(e.date) <= 28).slice(0, 5)
  const soon = open.filter((h) => daysUntil(h.dueDate) <= 7)
  const quickAdd = (
    <button
      type="button"
      className="icon-btn"
      aria-label="Hausaufgabe eintragen"
      title="Hausaufgabe eintragen"
      onClick={() => setEditing({ defaults: { subjectId: currentSubjectId(schedule) } })}
    >
      +
    </button>
  )
  const tt = schedule.timetable

  if (!tt) {
    return (
      <div className="page">
        <PageHeader title="Heute" />
        <div className="card empty">
          <p>Willkommen! Richte zuerst deinen Stundenplan ein.</p>
          <Link to="/stundenplan/bearbeiten" className="btn" style={{ textDecoration: 'none' }}>
            Stundenplan einrichten
          </Link>
        </div>
      </div>
    )
  }

  const periods = sortPeriods(tt.periods)
  // Heute, solange noch Stunden kommen – sonst der nächste Schultag
  const todaysLessons = schedule.activeLessonsOn(now)
  const countdown = holidayCountdown(schedule.holidays, now)
  const openAbsences = (absences ?? []).filter((a) => !a.excused).length
  const schoolLeftToday = todaysLessons.some((l) => l.end > now)
  const day = schoolLeftToday ? now : schedule.nextSchoolDay(addDays(now, 1))
  const dayLessons = day ? schedule.lessonsOn(day) : []
  const next = schedule.currentOrNext(now)
  const running = next && now >= next.start

  const heading = !day
    ? 'Kein Unterricht in Sicht'
    : isToday(day)
      ? 'Heute'
      : toISODate(day) === toISODate(addDays(now, 1))
        ? 'Morgen'
        : formatDate(day, { weekday: 'long' })

  return (
    <div className="page">
      <PageHeader title="Heute">{quickAdd}</PageHeader>
      <p className="subtitle">{formatDate(now, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>

      {next && (
        <div className="hero" style={{ borderColor: next.subject.color }}>
          <div className="hero-label">{running ? 'Jetzt' : 'Als Nächstes'}</div>
          <div className="hero-title">
            <span className="color-dot" style={{ background: next.subject.color, width: 14, height: 14 }} />
            {next.subject.name}
          </div>
          <div className="hero-meta">
            {periodTitle(periods, next.period)} · {next.period.start}–{next.period.end}
            {next.room && ` · ${next.room.name}`}
            {next.teacher && ` · ${next.teacher.name}`}
          </div>
          <div className="hero-countdown">
            {running
              ? `noch ${Math.max(1, Math.ceil((next.end.getTime() - now.getTime()) / 60_000))} Min.`
              : isToday(next.start)
                ? formatCountdown(Math.round((next.start.getTime() - now.getTime()) / 60_000))
                : formatDate(next.start, { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
      )}

      {countdown && (
        <Link to="/einstellungen/ferien" className="countdown-card">
          {'current' in countdown && countdown.current ? (
            <>
              <span className="countdown-big">{countdown.daysLeft}</span>
              <span>
                <strong>{countdown.current.name}</strong>
                <span className="sub">{countdown.daysLeft === 0 ? 'Letzter Ferientag' : `noch ${countdown.daysLeft} Tage Ferien`}</span>
              </span>
            </>
          ) : (
            'next' in countdown &&
            countdown.next && (
              <>
                <span className="countdown-big">{countdown.schoolDays}</span>
                <span>
                  <strong>Schultage bis zu den {countdown.next.name}</strong>
                  <span className="sub">
                    Start in {countdown.days} Tagen · {formatRange(countdown.next)}
                  </span>
                </span>
              </>
            )
          )}
        </Link>
      )}

      {day && (
        <>
          <h2 className="section-title">
            {heading}
            {!isToday(day) && heading !== 'Morgen' && `, ${formatDate(day, { day: 'numeric', month: 'long' })}`}
          </h2>
          <div className="list">
            {dayLessons.map((l) => {
              const done = l.end <= now
              return (
                <Link
                  key={l.period.id}
                  to={`/stundenplan?ansicht=tag&datum=${l.date}`}
                  className="row"
                  style={done || l.cancelled ? { opacity: 0.5 } : undefined}
                >
                  <span className="today-time">{l.period.start}</span>
                  <span className="color-bar" style={{ background: l.subject.color }} />
                  <span className="label" style={l.cancelled ? { textDecoration: 'line-through' } : undefined}>
                    {l.subject.name}
                    <span className="sub">{[l.room?.name, l.teacher?.name].filter(Boolean).join(' · ')}</span>
                  </span>
                  {l.change && <span className={`change-pill big ${l.change.kind}`}>{CHANGE_LABEL[l.change.kind]}</span>}
                  {next && l.lesson.id === next.lesson.id && l.date === next.date && <span className="badge accent">{running ? 'jetzt' : 'nächste'}</span>}
                </Link>
              )
            })}
          </div>
        </>
      )}

      <h2 className="section-title">
        Offene Hausaufgaben
        <Link to="/hausaufgaben" className="section-link">
          Alle
        </Link>
      </h2>
      {soon.length === 0 ? (
        <div className="card empty" style={{ padding: 20 }}>
          Keine Hausaufgaben in den nächsten 7 Tagen.
        </div>
      ) : (
        <div className="list">
          {soon.map((h) => (
            <HomeworkRow
              key={h.id}
              hw={h}
              onToggle={async () => {
                await setDone(h, true)
                snackbar.show('Erledigt', { label: 'Rückgängig', run: () => void setDone(h, false) })
              }}
              onOpen={() => setEditing({ hw: h })}
            />
          ))}
        </div>
      )}
      {open.length > soon.length && (
        <p className="section-footer">
          + {open.length - soon.length} weitere später fällig
        </p>
      )}

      <h2 className="section-title">
        Kommende Klausuren
        <Link to="/klausuren" className="section-link">
          Alle
        </Link>
      </h2>
      {nextExams.length === 0 ? (
        <div className="card empty" style={{ padding: 20 }}>
          Keine Klausuren in den nächsten 4 Wochen.
        </div>
      ) : (
        <div className="list">
          {nextExams.map((e) => (
            <ExamRow key={e.id} exam={e} compact onOpen={() => setExamOpen(e)} />
          ))}
        </div>
      )}
      {examOpen && <ExamSheet exam={examOpen} onClose={() => setExamOpen(null)} />}

      <h2 className="section-title">Mehr</h2>
      <div className="list">
        <LinkRow to="/fehlstunden" icon="absence" tone="pink" sub={openAbsences ? `${openAbsences} Entschuldigung${openAbsences > 1 ? 'en' : ''} offen` : 'Alles entschuldigt'}>
          Fehlstunden
        </LinkRow>
        <LinkRow to="/vertretungen" icon="swap" tone="orange" sub="Ausfälle, Vertretungen, Raumänderungen">
          Vertretungen
        </LinkRow>
        <LinkRow to="/einstellungen/ferien" icon="sun" tone="yellow" sub="Ferien, Feiertage, eigene freie Tage">
          Ferien
        </LinkRow>
      </div>

      {editing && <HomeworkSheet homework={editing.hw} defaults={editing.defaults} onClose={() => setEditing(null)} />}
      {snackbar.element}
    </div>
  )
}
