import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { absenceUnits, useAbsences } from '../lib/changes'
import { addDays, formatDate, isoWeek, mondayOf, parseISODate, toISODate } from '../lib/dates'
import { useExams } from '../lib/exams'
import { useGrades } from '../lib/grades'
import { openHomework, useHomework } from '../lib/homework'
import { useLookups } from '../lib/models'
import { useSchedule } from '../lib/schedule'
import { isDue, useVocabSets } from '../lib/study'

/**
 * Wochenrückblick: was diese Woche geschafft wurde und was nächste Woche ansteht.
 * Freitags und am Wochenende erscheint auf "Heute" ein Hinweis darauf.
 */
export function WeeklyReview() {
  const [offset, setOffset] = useState(0)
  const monday = addDays(mondayOf(new Date()), offset * 7)
  const sunday = addDays(monday, 6)
  const from = toISODate(monday)
  const to = toISODate(sunday)
  const nextFrom = toISODate(addDays(monday, 7))
  const nextTo = toISODate(addDays(monday, 13))

  const homework = useHomework()
  const exams = useExams()
  const grades = useGrades()
  const absences = useAbsences()
  const vocab = useVocabSets()
  const schedule = useSchedule()
  const { subjectMap } = useLookups()
  if (!homework || !exams || !grades || !absences || !schedule.ready) return null

  const inWeek = (iso: string) => iso >= from && iso <= to
  const doneHw = homework.filter((h) => h.done && h.doneAt && inWeek(toISODate(new Date(h.doneAt))))
  const newGrades = grades.filter((g) => inWeek(g.date)).sort((a, b) => a.date.localeCompare(b.date))
  const weekExams = exams.filter((e) => inWeek(e.date))
  const missed = absences.filter((a) => inWeek(a.date)).reduce((s, a) => s + absenceUnits(a), 0)
  const nextExams = exams.filter((e) => e.date >= nextFrom && e.date <= nextTo).sort((a, b) => a.date.localeCompare(b.date))
  const nextHw = openHomework(homework).filter((h) => h.dueDate <= nextTo)
  const dueVocab = (vocab ?? []).reduce((s, v) => s + v.cards.filter((c) => isDue(c, nextTo)).length, 0)
  const lessonsThisWeek = Array.from({ length: 5 }, (_, i) => schedule.activeLessonsOn(addDays(monday, i)).length).reduce((a, b) => a + b, 0)
  const nextHoliday = schedule.holidays.find((h) => h.kind === 'ferien' && h.start >= nextFrom && h.start <= nextTo)
  const name = (id: string) => subjectMap.get(id)?.name ?? 'Fach'
  const short = (iso: string) => formatDate(parseISODate(iso), { weekday: 'short', day: 'numeric', month: 'numeric' })

  return (
    <div className="page">
      <PageHeader title="Wochenrückblick" back={{ to: '/', label: 'Heute' }} />
      <div className="date-nav">
        <button type="button" className="nav-btn" aria-label="Vorherige Woche" onClick={() => setOffset(offset - 1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="date-label">
          KW {isoWeek(monday)} · {formatDate(monday, { day: 'numeric', month: 'short' })} – {formatDate(sunday, { day: 'numeric', month: 'short' })}
        </div>
        <button type="button" className="nav-btn" aria-label="Nächste Woche" onClick={() => setOffset(offset + 1)} disabled={offset >= 0}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="stat-row three">
        <div className="stat">
          <span className="stat-value">{doneHw.length}</span>
          <span className="stat-label">Hausaufgaben erledigt</span>
        </div>
        <div className="stat">
          <span className="stat-value">{lessonsThisWeek}</span>
          <span className="stat-label">Stunden Unterricht</span>
        </div>
        <div className={`stat ${missed ? 'warn' : ''}`}>
          <span className="stat-value">{missed}</span>
          <span className="stat-label">Fehlstunden</span>
        </div>
      </div>

      <h2 className="section-title">Diese Woche</h2>
      <div className="list">
        {newGrades.map((g) => (
          <Link key={g.id} to={`/noten/${g.subjectId}`} className="row">
            <span className="label">
              Neue Note in {name(g.subjectId)}
              <span className="sub">
                {g.kind === 'schriftlich' ? g.type : g.kind === 'besprechung' ? 'Notenbesprechung' : 'mündlich'} · {short(g.date)}
              </span>
            </span>
            <span className="grade-chip">{g.label}</span>
          </Link>
        ))}
        {weekExams.map((e) => (
          <div key={e.id} className="row">
            <span className="label">
              {name(e.subjectId)}-{e.type} geschrieben
              <span className="sub">{short(e.date)}</span>
            </span>
          </div>
        ))}
        {!newGrades.length && !weekExams.length && <div className="row muted">Keine Noten oder Klausuren diese Woche.</div>}
      </div>

      <h2 className="section-title">{offset === 0 ? 'Nächste Woche' : 'Die Woche danach'}</h2>
      <div className="list">
        {nextHoliday && (
          <div className="row">
            <span className="label">
              {nextHoliday.name} beginnen
              <span className="sub">{short(nextHoliday.start)}</span>
            </span>
          </div>
        )}
        {nextExams.map((e) => (
          <Link key={e.id} to="/klausuren" className="row">
            <span className="label">
              {name(e.subjectId)}-{e.type}
              <span className="sub">
                {short(e.date)}
                {e.topic && ` · ${e.topic}`}
              </span>
            </span>
          </Link>
        ))}
        {nextHw.length > 0 && (
          <Link to="/hausaufgaben" className="row">
            <span className="label">
              {nextHw.length} offene Hausaufgabe{nextHw.length > 1 ? 'n' : ''}
              <span className="sub">{[...new Set(nextHw.map((h) => name(h.subjectId)))].join(', ')}</span>
            </span>
          </Link>
        )}
        {dueVocab > 0 && (
          <Link to="/lernen" className="row">
            <span className="label">
              {dueVocab} Vokabeln zum Wiederholen
              <span className="sub">Ein paar Minuten am Tag reichen</span>
            </span>
          </Link>
        )}
        {!nextHoliday && !nextExams.length && !nextHw.length && !dueVocab && <div className="row muted">Nichts Besonderes – entspannte Woche!</div>}
      </div>
    </div>
  )
}
