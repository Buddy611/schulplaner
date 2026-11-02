import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { homeworkForLesson, openHomework, setDone, useHomework, type Homework } from '../lib/homework'
import type { Item } from '../lib/repo'
import { HomeworkSheet, type HomeworkDefaults } from './homework/HomeworkSheet'
import { examsForDayOnly, examsForLesson, useExams, type Exam } from '../lib/exams'
import { ExamSheet } from './exams/ExamSheet'
import { CHANGE_LABEL, type LessonChange } from '../lib/changes'
import { ChangeSheet } from './changes/ChangeSheet'
import { Icon } from '../components/Icons'
import { WeekGrid, type GridBlock } from '../components/WeekGrid'
import { useNotes, type LessonNote } from '../lib/notes'
import { NoteSheet, type NoteDefaults } from './notes/NoteSheet'
import { PageHeader } from '../components/PageHeader'
import { Segmented } from '../components/ui'
import { addDays, DAY_SHORT, formatDate, isoWeek, mondayOf, parseISODate, SCHOOL_DAYS, toISODate } from '../lib/dates'
import { periodTitle, sortPeriods, weekTypeFor } from '../lib/models'
import { useNow, useSchedule, type ScheduledLesson } from '../lib/schedule'
import { locale, t } from '../lib/i18n'

type Mode = 'tag' | 'woche' | 'monat'
const MODE_KEY = 'schulplaner-ansicht'

function savedMode(): Mode {
  try {
    const m = localStorage.getItem(MODE_KEY)
    if (m === 'tag' || m === 'woche' || m === 'monat') return m
  } catch {
    // egal
  }
  return 'woche'
}

/** Am Wochenende zeigt "Heute" in Tag/Woche den kommenden Montag */
function defaultDate(mode: Mode) {
  const d = new Date()
  if (mode !== 'monat' && (d.getDay() === 0 || d.getDay() === 6)) return mondayOf(addDays(d, 7))
  return d
}

export function SchedulePage() {
  const [params, setParams] = useSearchParams()
  const mode = (params.get('ansicht') as Mode | null) ?? savedMode()
  const date = params.get('datum') ? parseISODate(params.get('datum')!) : defaultDate(mode)
  const schedule = useSchedule()
  const open = openHomework(useHomework())
  const exams = useExams() ?? []
  const [examOpen, setExamOpen] = useState<Item<Exam> | null>(null)

  function go(nextMode: Mode, nextDate?: Date) {
    try {
      localStorage.setItem(MODE_KEY, nextMode)
    } catch {
      // egal
    }
    const p: Record<string, string> = { ansicht: nextMode }
    if (nextDate) p.datum = toISODate(nextDate)
    setParams(p, { replace: true })
  }

  function step(dir: 1 | -1) {
    if (mode === 'tag') {
      let d = addDays(date, dir)
      while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, dir)
      go(mode, d)
    } else if (mode === 'woche') go(mode, addDays(date, 7 * dir))
    else go(mode, new Date(date.getFullYear(), date.getMonth() + dir, 1))
  }

  if (!schedule.ready) return null
  const tt = schedule.timetable

  const week = tt ? weekTypeFor(tt, date) : null
  const label =
    mode === 'tag'
      ? formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })
      : mode === 'woche'
        ? `${t('KW {n}', { n: isoWeek(date) })} · ${formatDate(mondayOf(date), { day: 'numeric', month: 'short' })} – ${formatDate(addDays(mondayOf(date), 4), { day: 'numeric', month: 'short' })}`
        : formatDate(date, { month: 'long', year: 'numeric' })

  return (
    <div className="page">
      <PageHeader title={t('Stundenplan')}>
        <button type="button" className="link-btn no-print" onClick={() => window.print()}>
          PDF
        </button>
        <Link to="/vertretungen" className="nav-btn" aria-label={t('Vertretungen und Ausfälle')} title={t('Vertretungen')}>
          <Icon name="swap" />
        </Link>
        <Link to="/stundenplan/bearbeiten" className="nav-btn" aria-label={t('Stundenplan bearbeiten')} title={t('Bearbeiten')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15.5 4.5l4 4L9 19H5v-4z" />
          </svg>
        </Link>
      </PageHeader>

      {!tt ? (
        <div className="card empty">
          <p>{t('Du hast noch keinen Stundenplan.')}</p>
          <Link to="/stundenplan/bearbeiten" className="btn" style={{ textDecoration: 'none' }}>
            {t('Stundenplan einrichten')}
          </Link>
        </div>
      ) : (
        <>
          <div className="toolbar view-switch">
            <Segmented<Mode>
              value={mode}
              onChange={(m) => go(m, mode === 'monat' && m !== 'monat' ? undefined : date)}
              options={[
                { value: 'tag', label: t('Tag') },
                { value: 'woche', label: t('Woche') },
                { value: 'monat', label: t('Monat') },
              ]}
            />
          </div>
          <div className="date-nav">
            <button type="button" className="nav-btn" aria-label={t('Zurück')} onClick={() => step(-1)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <div className="date-label">
              {label}
              {week && mode !== 'monat' && <span className="badge">{t('{week}-Woche', { week })}</span>}
            </div>
            <button type="button" className="nav-btn" aria-label={t('Weiter')} onClick={() => step(1)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button type="button" className="link-btn" onClick={() => go(mode)}>
              {t('Heute')}
            </button>
          </div>

          {mode === 'woche' && <WeekView date={date} schedule={schedule} open={open} exams={exams} onDay={(d) => go('tag', d)} />}
          {mode === 'tag' && <DayView date={date} schedule={schedule} open={open} exams={exams} onExam={setExamOpen} />}
          {mode === 'monat' && <MonthView date={date} schedule={schedule} open={open} exams={exams} onDay={(d) => go('tag', d)} />}
          {examOpen && <ExamSheet exam={examOpen} onClose={() => setExamOpen(null)} />}
        </>
      )}
    </div>
  )
}

type Schedule = ReturnType<typeof useSchedule>

function lessonTileStyle(l: ScheduledLesson) {
  return {
    background: `color-mix(in srgb, ${l.subject.color} 24%, var(--card))`,
    boxShadow: `inset 4px 0 0 ${l.subject.color}`,
  }
}

function WeekView({
  date,
  schedule,
  open,
  exams,
  onDay,
}: {
  date: Date
  schedule: Schedule
  open: Item<Homework>[]
  exams: Item<Exam>[]
  onDay: (d: Date) => void
}) {
  const navigate = useNavigate()
  const tt = schedule.timetableFor(mondayOf(date)) ?? schedule.timetable!
  const periods = sortPeriods(tt.periods)
  const monday = mondayOf(date)
  const days = SCHOOL_DAYS.map((wd) => addDays(monday, wd - 1))
  const todayIso = toISODate(new Date())

  const blocks: GridBlock[][] = days.map((d) =>
    schedule.lessonsOn(d).map((l) => {
      const hwCount = homeworkForLesson(open, l).length
      const exam = examsForLesson(exams, l)[0]
      return {
        key: l.lesson.id,
        start: l.startSlot,
        end: l.endSlot,
        className: `${exam ? 'has-exam' : ''} ${l.cancelled ? 'cancelled' : ''} ${l.change && !l.cancelled ? 'changed' : ''}`,
        style: lessonTileStyle(l),
        onClick: () => navigate(`/stunde/${l.date}/${l.lesson.id}`),
        content: (
          <>
            {exam && <span className="exam-pill">{t(exam.type)}</span>}
            {l.change && <span className="change-pill">{CHANGE_LABEL[l.change.kind]}</span>}
            {hwCount > 0 && (
              <span className="tt-badge" title={`${hwCount} Hausaufgabe(n)`}>
                {hwCount}
              </span>
            )}
            <span className="short">{l.subject.short}</span>
            <span className="name">{l.subject.name}</span>
            {l.room && <span className="room">{l.room.name}</span>}
            {l.teacher && <span className="teacher">{l.teacher.name}</span>}
          </>
        ),
      }
    }),
  )

  return (
    <WeekGrid
      periods={periods}
      heads={days.map((d) => (
        <button type="button" className="tt-head day-head" onClick={() => onDay(d)}>
          <span>{DAY_SHORT[d.getDay()]}</span>
          <span className={`day-num ${toISODate(d) === todayIso ? 'today' : ''}`}>{d.getDate()}</span>
          {schedule.holiday(d) && <span className="holiday-pill">{schedule.holiday(d)!.name}</span>}
          {examsForDayOnly(exams, toISODate(d)).map((e) => (
            <span key={e.id} className="exam-pill">
              {t(e.type)} {schedule.lookups.subjectMap.get(e.subjectId)?.short}
            </span>
          ))}
        </button>
      ))}
      blocks={blocks}
      emptyClass={(col) => (schedule.holiday(days[col]) ? 'holiday' : '')}
    />
  )
}

function DayView({
  date,
  schedule,
  open,
  exams,
  onExam,
}: {
  date: Date
  schedule: Schedule
  open: Item<Homework>[]
  exams: Item<Exam>[]
  onExam: (e: Item<Exam>) => void
}) {
  const now = useNow()
  const navigate = useNavigate()
  const [editing, setEditing] = useState<{ hw?: Item<Homework>; defaults?: HomeworkDefaults } | null>(null)
  const [changing, setChanging] = useState<{ change?: Item<LessonChange>; periodId: string } | null>(null)
  const [noting, setNoting] = useState<{ note?: Item<LessonNote>; defaults?: NoteDefaults } | null>(null)
  const notes = useNotes()
  const tt = schedule.timetableFor(date) ?? schedule.timetable!
  const periods = sortPeriods(tt.periods)
  const lessons = schedule.lessonsOn(date)
  const lessonPeriods = periods.filter((p) => p.kind === 'lesson')
  const hhmm = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })

  if (lessons.length === 0) {
    const next = schedule.nextSchoolDay(addDays(date, 1))
    const holiday = schedule.holiday(date)
    return (
      <div className={`card empty ${holiday ? 'holiday-card' : ''}`}>
        {holiday ? (
          <p>
            <strong>{holiday.name}</strong> – {t('kein Unterricht.')}
          </p>
        ) : (
          t('Kein Unterricht an diesem Tag.')
        )}
        {next && <p>{t('Nächster Schultag: {day}', { day: formatDate(next, { weekday: 'long', day: 'numeric', month: 'long' }) })}</p>}
      </div>
    )
  }

  // Nur bis zur letzten Stunde des Tages anzeigen
  const lastEnd = lessons.reduce((a, b) => (b.endSlot > a.endSlot ? b : a))
  const lastIndex = periods.findIndex((p) => p.id === lastEnd.endPeriod.id)
  const visible = periods.slice(0, lastIndex + 1)

  return (
    <div className="day-list">
      {examsForDayOnly(exams, toISODate(date)).map((e) => (
        <button key={e.id} type="button" className="day-exam-banner" onClick={() => onExam(e)}>
          <strong>{t(e.type)}</strong> {schedule.lookups.subjectMap.get(e.subjectId)?.name}
          {e.topic && ` · ${e.topic}`}
        </button>
      ))}
      {visible.map((p) => {
        if (p.kind === 'break') {
          return (
            <div key={p.id} className="day-break">
              <span>{p.start}</span>
              {periodTitle(periods, p)}
            </div>
          )
        }
        // Stunden, die in dieser Stunde beginnen (bei geteilten Stunden bis zu zwei)
        const i = lessonPeriods.findIndex((x) => x.id === p.id)
        const starting = lessons.filter((x) => Math.floor(x.startSlot / 2) === i)
        // Ganz von einer früheren, übergreifenden Stunde belegt → nichts extra anzeigen
        if (!starting.length && lessons.some((x) => x.startSlot < i * 2 && x.endSlot >= i * 2 + 1)) return null
        return (starting.length ? starting : [undefined]).map((l) => {
        const running = l && now >= l.start && now < l.end
        const progress = running ? (now.getTime() - l.start.getTime()) / (l.end.getTime() - l.start.getTime()) : 0
        const halfLabel = l && l.endSlot === l.startSlot ? (l.startSlot % 2 ? ` · ${t('2. Hälfte')}` : ` · ${t('1. Hälfte')}`) : ''
        return (
          <div key={p.id + (l?.lesson.id ?? '')} className="day-row">
            <div className="day-time">
              <strong>{l ? hhmm(l.start) : p.start}</strong>
              <span>{l ? hhmm(l.end) : p.end}</span>
            </div>
            {l ? (
              <div className={`day-card ${running ? 'running' : ''} ${l.cancelled ? 'cancelled' : ''}`} style={lessonTileStyle(l)}>
                <button type="button" className="day-card-open" onClick={() => navigate(`/stunde/${l.date}/${l.lesson.id}`)}>
                  <span className="day-card-title">
                    <span className="subject-name">{l.subject.name}</span>
                    <span className="muted">
                      {periodTitle(periods, p)}
                      {l.endPeriod.id !== p.id && ` – ${periodTitle(periods, l.endPeriod)}`}
                      {halfLabel}
                    </span>
                  </span>
                  <span className="day-card-meta">
                    {[l.room?.name, l.teacher?.name].filter(Boolean).join(' · ')}
                  </span>
                </button>
                {l.change && (
                  <button type="button" className="day-change" onClick={() => setChanging({ change: l.change, periodId: p.id })}>
                    <span className="change-pill">{CHANGE_LABEL[l.change.kind]}</span>
                    {l.change.note ?? (l.cancelled ? t('Die Stunde fällt aus') : t('Geändert'))}
                  </button>
                )}
                {examsForLesson(exams, l).map((e) => (
                  <button key={e.id} type="button" className="day-exam" onClick={() => onExam(e)}>
                    <span className="exam-pill">{t(e.type)}</span>
                    {e.topic ?? t('Thema offen')}
                  </button>
                ))}
                {running && (
                  <div className="progress">
                    <div style={{ width: `${progress * 100}%`, background: l.subject.color }} />
                  </div>
                )}
                {homeworkForLesson(open, l).map((h) => (
                  <div key={h.id} className="day-hw">
                    <button
                      type="button"
                      className="hw-check small"
                      style={{ borderColor: l.subject.color }}
                      aria-label={t('Als erledigt markieren')}
                      onClick={() => void setDone(h, true)}
                    />
                    <button type="button" className="day-hw-title" onClick={() => setEditing({ hw: h })}>
                      {h.title}
                    </button>
                  </div>
                ))}
                {(notes ?? [])
                  .filter((n) => n.date === l.date && n.subjectId === l.subject.id && (!n.periodId || n.periodId === l.period.id || n.periodId === l.endPeriod.id))
                  .map((n) => (
                    <button key={n.id} type="button" className="day-note" onClick={() => setNoting({ note: n })}>
                      <Icon name="note" size={16} />
                      <span>{n.text || t('{n} Anhang', { n: n.attachments.length })}</span>
                    </button>
                  ))}
                <div className="day-actions">
                  <button
                    type="button"
                    className="day-hw-add"
                    onClick={() => setEditing({ defaults: { subjectId: l.subject.id, dueDate: l.date, duePeriodId: l.period.id } })}
                  >
                    + {t('Hausaufgabe')}
                  </button>
                  <button
                    type="button"
                    className="day-hw-add"
                    onClick={() => setNoting({ defaults: { subjectId: l.subject.id, date: l.date, periodId: l.period.id } })}
                  >
                    + {t('Notiz')}
                  </button>
                  {!l.change && (
                    <button type="button" className="day-hw-add" onClick={() => setChanging({ periodId: p.id })}>
                      + {t('Ausfall / Vertretung')}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="day-card free">{t('Frei')}</div>
            )}
          </div>
        )
        })
      })}
      {editing && <HomeworkSheet homework={editing.hw} defaults={editing.defaults} onClose={() => setEditing(null)} />}
      {changing && (
        <ChangeSheet change={changing.change} date={toISODate(date)} periodId={changing.periodId} onClose={() => setChanging(null)} />
      )}
      {noting && <NoteSheet note={noting.note} defaults={noting.defaults} onClose={() => setNoting(null)} />}
    </div>
  )
}

function MonthView({
  date,
  schedule,
  open,
  exams,
  onDay,
}: {
  date: Date
  schedule: Schedule
  open: Item<Homework>[]
  exams: Item<Exam>[]
  onDay: (d: Date) => void
}) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const start = mondayOf(first)
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  // 6. Reihe weglassen, wenn sie komplett im nächsten Monat liegt
  const shown = cells[35].getMonth() !== date.getMonth() ? cells.slice(0, 35) : cells
  const todayIso = toISODate(new Date())

  return (
    <div className="month-grid">
      {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
        <div key={wd} className="month-head">
          {DAY_SHORT[wd]}
        </div>
      ))}
      {shown.map((d) => {
        const inMonth = d.getMonth() === date.getMonth()
        const lessons = schedule.activeLessonsOn(d)
        const colors = [...new Set(lessons.map((l) => l.subject.color))]
        const weekend = d.getDay() === 0 || d.getDay() === 6
        const holiday = schedule.holiday(d)
        return (
          <button
            key={toISODate(d)}
            type="button"
            className={`month-cell ${inMonth ? '' : 'other'} ${weekend ? 'weekend' : ''} ${holiday && !weekend ? 'holiday' : ''}`}
            onClick={() => onDay(d)}
            disabled={weekend}
          >
            <span className={`day-num ${toISODate(d) === todayIso ? 'today' : ''}`}>{d.getDate()}</span>
            {holiday && !weekend && <span className="holiday-name">{holiday.name}</span>}
            <span className="month-dots">
              {colors.slice(0, 8).map((c) => (
                <i key={c} style={{ background: c }} />
              ))}
            </span>
            {exams
              .filter((e) => e.date === toISODate(d))
              .map((e) => (
                <span key={e.id} className="exam-pill">
                  {schedule.lookups.subjectMap.get(e.subjectId)?.short} {e.type === 'Klausur' ? t('K|Klausur') : t(e.type)}
                </span>
              ))}
            {(() => {
              const n = open.filter((h) => h.dueDate === toISODate(d)).length
              return n > 0 ? <span className="month-tag">{n} HA</span> : null
            })()}
          </button>
        )
      })}
    </div>
  )
}
