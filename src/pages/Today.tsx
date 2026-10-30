import { Fragment, useState, type ReactNode } from 'react'
import { DEFAULT_NAV_LAYOUT, DEFAULT_TODAY_LAYOUT, NAV_ITEMS, resolveLayout } from '../lib/layout'
import type { Tone } from '../components/Icons'

const MORE_TONES: Record<string, Tone> = {
  stundenplan: 'blue',
  hausaufgaben: 'cyan',
  klausuren: 'teal',
  noten: 'green',
  lernen: 'indigo',
  notizen: 'blue',
  suche: 'cyan',
  rueckblick: 'purple',
  fehlstunden: 'pink',
  vertretungen: 'orange',
}
import { useSettings } from '../lib/settings'
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
import { PackingList } from './PackingList'
import { useGradeData } from '../lib/useGradeData'
import { belowGoal, formatAverage, goalIn } from '../lib/grades'
import { Icon, IconBubble } from '../components/Icons'
import { isDue, useVocabSets } from '../lib/study'
import { PageHeader } from '../components/PageHeader'
import { addDays, formatDate, toISODate } from '../lib/dates'
import { periodTitle, sortPeriods } from '../lib/models'
import { formatCountdown, isToday, useNow, useSchedule } from '../lib/schedule'

export function Today() {
  const now = useNow()
  const settings = useSettings()
  const gradeData = useGradeData(null)
  const warnings = gradeData.rows.filter((r) => belowGoal(r.result.total, r.subject.goal, gradeData.settings.gradeSystem))
  const schedule = useSchedule()
  const open = openHomework(useHomework())
  const [editing, setEditing] = useState<{ hw?: Item<Homework>; defaults?: HomeworkDefaults } | null>(null)
  const snackbar = useSnackbar()
  const exams = useExams()
  const absences = useAbsences()
  const vocab = useVocabSets()
  const dueVocab = (vocab ?? []).reduce((s, v) => s + v.cards.filter((c) => isDue(c)).length, 0)
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

  const visibleNav = resolveLayout(settings.navLayout, DEFAULT_NAV_LAYOUT)
    .filter((x) => x.visible)
    .map((x) => NAV_ITEMS.find((n) => n.id === x.id)!)
  const moreItems = visibleNav.slice(5).filter((n) => n.id !== 'heute')
  const moreSub: Record<string, string> = {
    stundenplan: 'Tag, Woche, Monat',
    hausaufgaben: `${open.length} offen`,
    klausuren: 'Kommende und vergangene Klausuren',
    noten: 'Durchschnitt, Zielnoten, Zeugnis-Vorschau',
    lernen: dueVocab ? `${dueVocab} Vokabeln fällig · Lernzettel` : 'Vokabeltrainer und Lernzettel',
    notizen: 'Notizen und Tafelbilder zu den Stunden',
    suche: 'Alles durchsuchen',
    rueckblick: 'Diese Woche und was als Nächstes kommt',
    fehlstunden: openAbsences ? `${openAbsences} Entschuldigung${openAbsences > 1 ? 'en' : ''} offen` : 'Alles entschuldigt',
    vertretungen: 'Ausfälle, Vertretungen, Raumänderungen',
  }

  // Abschnitte der Startseite – Reihenfolge und Sichtbarkeit unter Einstellungen → Startseite & Navigation
  const sections: Record<string, ReactNode> = {
    excuses: openAbsences > 0 && (
      <Link to="/fehlstunden" className="review-card excuse-card">
        <IconBubble name="absence" tone="red" />
        <span>
          <strong>
            {openAbsences} Entschuldigung{openAbsences > 1 ? 'en' : ''} noch nicht abgegeben
          </strong>
          <span className="sub">Antippen, um sie abzuhaken, sobald du sie abgegeben hast</span>
        </span>
      </Link>
    ),
    goals: warnings.length > 0 && (
      <>
        <h2 className="section-title overdue">Unter deinem Ziel</h2>
        <div className="list">
          {warnings.map(({ subject, result }) => (
            <Link key={subject.id} to={`/noten/${subject.id}`} className="row">
              <span className="color-bar" style={{ background: subject.color }} />
              <span className="label">
                {subject.name}
                <span className="sub">Ziel {formatAverage(goalIn(subject.goal!, gradeData.settings.gradeSystem), gradeData.settings.gradeSystem)} · im Zielnoten-Rechner siehst du, was du brauchst</span>
              </span>
              <span className="grade-chip warn">{formatAverage(result.total, gradeData.settings.gradeSystem)}</span>
            </Link>
          ))}
        </div>
      </>
    ),
    next: <>
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
</>,
    review: <>
{(now.getDay() === 5 || now.getDay() === 6 || now.getDay() === 0) && (
        <Link to="/rueckblick" className="review-card">
          <IconBubble name="chart" tone="purple" />
          <span>
            <strong>Dein Wochenrückblick</strong>
            <span className="sub">Was du geschafft hast und was nächste Woche ansteht</span>
          </span>
        </Link>
      )}
</>,
    holidays: <>
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
</>,
    day: <>
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
                  key={l.period.id + l.startSlot}
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
</>,
    packing: <>
{day && (
        <>
          <h2 className="section-title">Einpacken für {isToday(day) ? 'heute' : heading === 'Morgen' ? 'morgen' : formatDate(day, { weekday: 'long' })}</h2>
          <PackingList key={toISODate(day)} schedule={schedule} day={day} />
        </>
      )}
</>,
    homework: <>
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
</>,
    exams: <>
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
</>,
    more: <>
<h2 className="section-title">Mehr</h2>
      <div className="list">
        {/* Alles, was nicht in der Leiste unten steht – damit es auf dem Handy erreichbar bleibt */}
        {moreItems.map((n) => (
          <LinkRow key={n.id} to={n.to} icon={n.icon} tone={MORE_TONES[n.id] ?? 'blue'} sub={moreSub[n.id] ?? ''}>
            {n.label}
          </LinkRow>
        ))}
        <LinkRow to="/einstellungen/ferien" icon="sun" tone="yellow" sub="Ferien, Feiertage, eigene freie Tage">
          Ferien
        </LinkRow>
      </div>
</>,
  }
  const layout = resolveLayout(settings.todayLayout, DEFAULT_TODAY_LAYOUT).filter((x) => x.visible)

  return (
    <div className="page">
      <PageHeader title="Heute">
        <Link to="/suche" className="nav-btn" aria-label="Suchen">
          <Icon name="search" />
        </Link>
        {quickAdd}
      </PageHeader>
      <p className="subtitle">{formatDate(now, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>

      {layout.map((x) => (
        <Fragment key={x.id}>{sections[x.id]}</Fragment>
      ))}

      {editing && <HomeworkSheet homework={editing.hw} defaults={editing.defaults} onClose={() => setEditing(null)} />}
      {snackbar.element}
    </div>
  )
}
