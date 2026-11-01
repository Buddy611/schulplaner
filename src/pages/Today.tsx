import { Fragment, useState, type ReactNode } from 'react'
import { DEFAULT_NAV_LAYOUT, DEFAULT_TODAY_LAYOUT, isSeparator, NAV_ITEMS, resolveLayout } from '../lib/layout'
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
import { belowGoal, formatAverage, goalLabel } from '../lib/grades'
import { Icon, IconBubble } from '../components/Icons'
import { isDue, useVocabSets } from '../lib/study'
import { PageHeader } from '../components/PageHeader'
import { addDays, formatDate, toISODate } from '../lib/dates'
import { periodTitle, sortPeriods } from '../lib/models'
import { formatCountdown, isToday, useNow, useSchedule } from '../lib/schedule'
import { t } from '../lib/i18n'

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
      aria-label={t('Hausaufgabe eintragen')}
      title={t('Hausaufgabe eintragen')}
      onClick={() => setEditing({ defaults: { subjectId: currentSubjectId(schedule) } })}
    >
      +
    </button>
  )
  const tt = schedule.timetable

  if (!tt) {
    return (
      <div className="page">
        <PageHeader title={t('Heute')} />
        <div className="card empty">
          <p>{t('Willkommen! Richte zuerst deinen Stundenplan ein.')}</p>
          <Link to="/stundenplan/bearbeiten" className="btn" style={{ textDecoration: 'none' }}>
            {t('Stundenplan einrichten')}
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

  const isTomorrow = Boolean(day && toISODate(day) === toISODate(addDays(now, 1)))
  const heading = !day
    ? t('Kein Unterricht in Sicht')
    : isToday(day)
      ? t('Heute')
      : isTomorrow
        ? t('Morgen')
        : formatDate(day, { weekday: 'long' })

  const visibleNav = resolveLayout(settings.navLayout, DEFAULT_NAV_LAYOUT)
    .filter((x) => x.visible && !isSeparator(x.id))
    .map((x) => NAV_ITEMS.find((n) => n.id === x.id)!)
  const moreItems = visibleNav.slice(5).filter((n) => n.id !== 'heute')
  const moreSub: Record<string, string> = {
    stundenplan: t('Tag, Woche, Monat'),
    hausaufgaben: t('{n} offen', { n: open.length }),
    klausuren: t('Kommende und vergangene Klausuren'),
    noten: t('Durchschnitt, Zielnoten, Zeugnis-Vorschau'),
    lernen: dueVocab ? t('{n} Vokabeln fällig · Lernzettel', { n: dueVocab }) : t('Vokabeltrainer und Lernzettel'),
    notizen: t('Notizen und Tafelbilder zu den Stunden'),
    suche: t('Alles durchsuchen'),
    rueckblick: t('Diese Woche und was als Nächstes kommt'),
    fehlstunden: openAbsences ? (openAbsences > 1 ? t('{n} Entschuldigungen offen', { n: openAbsences }) : t('1 Entschuldigung offen')) : t('Alles entschuldigt'),
    vertretungen: t('Ausfälle, Vertretungen, Raumänderungen'),
  }

  // Abschnitte der Startseite – Reihenfolge und Sichtbarkeit unter Einstellungen → Startseite & Navigation
  const sections: Record<string, ReactNode> = {
    excuses: openAbsences > 0 && (
      <Link to="/fehlstunden" className="review-card excuse-card">
        <IconBubble name="absence" tone="red" />
        <span>
          <strong>
            {openAbsences > 1 ? t('{n} Entschuldigungen noch nicht abgegeben', { n: openAbsences }) : t('1 Entschuldigung noch nicht abgegeben')}
          </strong>
          <span className="sub">{t('Antippen, um sie abzuhaken, sobald du sie abgegeben hast')}</span>
        </span>
      </Link>
    ),
    goals: warnings.length > 0 && (
      <>
        <h2 className="section-title overdue">{t('Unter deinem Ziel')}</h2>
        <div className="list">
          {warnings.map(({ subject, result }) => (
            <Link key={subject.id} to={`/noten/${subject.id}`} className="row">
              <span className="color-bar" style={{ background: subject.color }} />
              <span className="label">
                {subject.name}
                <span className="sub">{t('Ziel {goal} · im Zielnoten-Rechner siehst du, was du brauchst', { goal: goalLabel(subject.goal!, gradeData.settings.gradeSystem) })}</span>
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
          <div className="hero-label">{running ? t('Jetzt') : t('Als Nächstes')}</div>
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
              ? t('noch {n} Min.', { n: Math.max(1, Math.ceil((next.end.getTime() - now.getTime()) / 60_000)) })
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
            <strong>{t('Dein Wochenrückblick')}</strong>
            <span className="sub">{t('Was du geschafft hast und was nächste Woche ansteht')}</span>
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
                <span className="sub">{countdown.daysLeft === 0 ? t('Letzter Ferientag') : t('noch {n} Tage Ferien', { n: countdown.daysLeft })}</span>
              </span>
            </>
          ) : (
            'next' in countdown &&
            countdown.next && (
              <>
                <span className="countdown-big">{countdown.schoolDays}</span>
                <span>
                  <strong>{t('Schultage bis zu den {name}', { name: countdown.next.name })}</strong>
                  <span className="sub">
                    {t('Start in {n} Tagen', { n: countdown.days })} · {formatRange(countdown.next)}
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
            {!isToday(day) && !isTomorrow && `, ${formatDate(day, { day: 'numeric', month: 'long' })}`}
          </h2>
          <div className="list">
            {dayLessons.map((l) => {
              const done = l.end <= now
              return (
                <Link
                  key={l.period.id + l.startSlot}
                  to={`/stunde/${l.date}/${l.lesson.id}`}
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
                  {next && l.lesson.id === next.lesson.id && l.date === next.date && <span className="badge accent">{running ? t('jetzt') : t('nächste')}</span>}
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
          <h2 className="section-title">{t('Einpacken für {day}', { day: isToday(day) ? t('heute') : isTomorrow ? t('morgen') : formatDate(day, { weekday: 'long' }) })}</h2>
          <PackingList key={toISODate(day)} schedule={schedule} day={day} />
        </>
      )}
</>,
    homework: <>
<h2 className="section-title">
        {t('Offene Hausaufgaben')}
        <Link to="/hausaufgaben" className="section-link">
          {t('Alle')}
        </Link>
      </h2>
      {soon.length === 0 ? (
        <div className="card empty" style={{ padding: 20 }}>
          {t('Keine Hausaufgaben in den nächsten 7 Tagen.')}
        </div>
      ) : (
        <div className="list">
          {soon.map((h) => (
            <HomeworkRow
              key={h.id}
              hw={h}
              onToggle={async () => {
                await setDone(h, true)
                snackbar.show(t('Erledigt'), { label: t('Rückgängig'), run: () => void setDone(h, false) })
              }}
              onOpen={() => setEditing({ hw: h })}
            />
          ))}
        </div>
      )}
      {open.length > soon.length && (
        <p className="section-footer">
          {t('+ {n} weitere später fällig', { n: open.length - soon.length })}
        </p>
      )}
</>,
    exams: <>
<h2 className="section-title">
        {t('Kommende Klausuren')}
        <Link to="/klausuren" className="section-link">
          {t('Alle')}
        </Link>
      </h2>
      {nextExams.length === 0 ? (
        <div className="card empty" style={{ padding: 20 }}>
          {t('Keine Klausuren in den nächsten 4 Wochen.')}
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
<h2 className="section-title">{t('Mehr')}</h2>
      <div className="list">
        {/* Alles, was nicht in der Leiste unten steht – damit es auf dem Handy erreichbar bleibt */}
        {moreItems.map((n) => (
          <LinkRow key={n.id} to={n.to} icon={n.icon} tone={MORE_TONES[n.id] ?? 'blue'} sub={moreSub[n.id] ?? ''}>
            {n.label}
          </LinkRow>
        ))}
        <LinkRow to="/einstellungen/ferien" icon="sun" tone="yellow" sub={t('Ferien, Feiertage, eigene freie Tage')}>
          {t('Ferien')}
        </LinkRow>
      </div>
</>,
  }
  const layout = resolveLayout(settings.todayLayout, DEFAULT_TODAY_LAYOUT).filter((x) => x.visible)

  return (
    <div className="page">
      <PageHeader title={t('Heute')}>
        <Link to="/suche" className="nav-btn" aria-label={t('Suchen')}>
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
