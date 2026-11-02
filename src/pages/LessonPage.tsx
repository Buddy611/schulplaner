import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../components/Icons'
import { StatusPill } from '../components/StatusPill'
import { Chevron, Sheet } from '../components/ui'
import { CHANGE_LABEL, type ChangeKind, type LessonChange } from '../lib/changes'
import { formatDate, parseISODate, toISODate } from '../lib/dates'
import { examsForLesson, useExams, type Exam } from '../lib/exams'
import { formatAverage } from '../lib/grades'
import { compareDue, dayHeading, setDone, useHomework, type Homework } from '../lib/homework'
import { periodTitle, sortPeriods } from '../lib/models'
import { useNotes, type LessonNote } from '../lib/notes'
import type { Item } from '../lib/repo'
import { useSchedule } from '../lib/schedule'
import { useGradeData } from '../lib/useGradeData'
import { ChangeSheet } from './changes/ChangeSheet'
import { ExamSheet, type ExamDefaults } from './exams/ExamSheet'
import { HomeworkRow } from './homework/HomeworkCard'
import { HomeworkSheet, type HomeworkDefaults } from './homework/HomeworkSheet'
import { NoteSheet, type NoteDefaults } from './notes/NoteSheet'
import { locale, t } from '../lib/i18n'

interface MenuItem {
  label: string
  onClick: () => void
}

/** Kleines Auswahlfenster mit ein paar Aktionen */
function MenuSheet({ title, items, onClose }: { title: string; items: MenuItem[]; onClose: () => void }) {
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="list">
        {items.map((i) => (
          <button
            key={i.label}
            type="button"
            className="row"
            onClick={() => {
              onClose()
              i.onClick()
            }}
          >
            {i.label}
          </button>
        ))}
      </div>
    </Sheet>
  )
}

/** Kachel mit Überschrift und großem Wert – als Link (Pfeil) oder mit Menü (…) */
function Tile({ label, value, to, onMenu }: { label: string; value: ReactNode; to?: string; onMenu?: () => void }) {
  const head = (
    <span className="lesson-tile-head">
      <span>{label}</span>
      {to && <Chevron />}
      {onMenu && (
        <span className="lesson-tile-menu">
          <Icon name="more" size={18} />
        </span>
      )}
    </span>
  )
  const body = <span className="lesson-tile-value">{value}</span>
  if (to) {
    return (
      <Link to={to} className="lesson-tile">
        {head}
        {body}
      </Link>
    )
  }
  if (onMenu) {
    return (
      <button type="button" className="lesson-tile" onClick={onMenu}>
        {head}
        {body}
      </button>
    )
  }
  return (
    <div className="lesson-tile">
      {head}
      {body}
    </div>
  )
}

/** Detailseite einer einzelnen Stunde (Antippen im Stundenplan oder auf "Heute") */
export function LessonPage() {
  const { date = '', lessonId = '' } = useParams()
  const navigate = useNavigate()
  const schedule = useSchedule()
  const homework = useHomework()
  const exams = useExams() ?? []
  const notes = useNotes() ?? []
  const grades = useGradeData(null)
  const [menu, setMenu] = useState<{ title: string; items: MenuItem[] } | null>(null)
  const [hw, setHw] = useState<{ hw?: Item<Homework>; defaults?: HomeworkDefaults } | null>(null)
  const [note, setNote] = useState<{ note?: Item<LessonNote>; defaults?: NoteDefaults } | null>(null)
  const [exam, setExam] = useState<{ exam?: Item<Exam>; defaults?: ExamDefaults } | null>(null)
  const [change, setChange] = useState<{ change?: Item<LessonChange>; kind?: ChangeKind } | null>(null)

  if (!schedule.ready || !homework || !grades.loaded) return null
  const day = parseISODate(date)
  const l = schedule.lessonsOn(day).find((x) => x.lesson.id === lessonId)

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/stundenplan'))
  const header = (title: string, actions?: ReactNode) => (
    <header className="top-bar">
      <button type="button" className="nav-btn" aria-label={t('Zurück')} onClick={back}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M11 18l-6-6 6-6" />
        </svg>
      </button>
      <h1>{title}</h1>
      <div className="header-actions">
        <StatusPill />
        {actions}
      </div>
    </header>
  )

  if (!l) {
    return (
      <div className="page">
        {header(t('Stunde'))}
        <p className="hint">{t('Diese Stunde gibt es an diesem Tag nicht (mehr).')}</p>
      </div>
    )
  }

  const subject = l.subject
  const periods = sortPeriods((schedule.timetableFor(day) ?? schedule.timetable!).periods)
  const hhmm = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const today = toISODate(new Date())
  const periodNum = periodTitle(periods, l.period).replace(/ Stunde$/, '')
  const endNum = l.endPeriod.id !== l.period.id ? periodTitle(periods, l.endPeriod).replace(/ Stunde$/, '') : null
  const halfLabel = l.endSlot === l.startSlot ? (l.startSlot % 2 ? t('2. Hälfte') : t('1. Hälfte')) : null

  const ofSubject = homework.filter((h) => h.subjectId === subject.id)
  const openCount = ofSubject.filter((h) => !h.done).length
  // Zukünftige oder noch nicht erledigte – wie im bisherigen Planer
  const shown = ofSubject.filter((h) => !h.done || h.dueDate >= today).sort(compareDue)
  const byDay = new Map<string, Item<Homework>[]>()
  for (const h of shown) byDay.set(h.dueDate, [...(byDay.get(h.dueDate) ?? []), h])

  const row = grades.rows.find((r) => r.subject.id === subject.id)
  const average = row?.result.total != null ? formatAverage(row.result.total, grades.settings.gradeSystem) : '–'
  const lessonExams = examsForLesson(exams, l)
  const lessonNotes = notes.filter((n) => n.date === l.date && n.subjectId === subject.id && (!n.periodId || n.periodId === l.period.id || n.periodId === l.endPeriod.id))

  const hwDefaults = { subjectId: subject.id, dueDate: l.date, duePeriodId: l.period.id }
  const thisDay = formatDate(day, { weekday: 'long', day: 'numeric', month: 'short' })
  const changeItems = (kind: ChangeKind, what: string): MenuItem[] => [
    l.change
      ? { label: t('Änderung für diesen Tag bearbeiten'), onClick: () => setChange({ change: l.change }) }
      : { label: t('{what} nur am {day} ändern', { what, day: thisDay }), onClick: () => setChange({ kind }) },
    { label: t('{what} dauerhaft ändern (Stundenplan)', { what }), onClick: () => navigate('/stundenplan/bearbeiten') },
  ]

  return (
    <div className="page">
      {header(
        t('{subject} Stunde', { subject: subject.name }),
        <button
          type="button"
          className="nav-btn"
          aria-label={t('Hinzufügen')}
          onClick={() =>
            setMenu({
              title: t('Hinzufügen'),
              items: [
                { label: t('Hausaufgabe'), onClick: () => setHw({ defaults: hwDefaults }) },
                { label: t('Notiz'), onClick: () => setNote({ defaults: { subjectId: subject.id, date: l.date, periodId: l.period.id } }) },
                { label: t('Klausur / Test'), onClick: () => setExam({ defaults: { subjectId: subject.id, date: l.date, periodId: l.period.id } }) },
                ...(l.change ? [] : [{ label: t('Ausfall / Vertretung'), onClick: () => setChange({}) }]),
              ],
            })
          }
        >
          <Icon name="plus" />
        </button>,
      )}

      <div className="lesson-tiles">
        <Tile label={t('Offene Aufgaben')} value={openCount} to="/hausaufgaben" />
        <Tile label={t('Notendurchschnitt')} value={average} to={`/noten/${subject.id}`} />
      </div>

      <div className="lesson-day-head">
        <h2>{formatDate(day, { weekday: 'long', day: 'numeric', month: 'short' })}</h2>
        <button type="button" className="nav-btn" aria-label={t('Diese Stunde ändern')} onClick={() => setMenu({ title: t('Stunde ändern'), items: changeItems('ausfall', t('Stunde')) })}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15.5 4.5l4 4L9 19H5v-4z" />
          </svg>
        </button>
      </div>

      {l.change && (
        <button type="button" className="day-change lesson-change" onClick={() => setChange({ change: l.change })}>
          <span className="change-pill">{CHANGE_LABEL[l.change.kind]}</span>
          {l.change.note ?? (l.cancelled ? t('Die Stunde fällt aus') : t('Geändert'))}
        </button>
      )}

      <div className={`lesson-tiles three ${l.cancelled ? 'cancelled' : ''}`}>
        <Tile
          label={t('Stunde')}
          value={
            <>
              {endNum ? `${periodNum}–${endNum}` : periodNum}
              <small>
                {hhmm(l.start)} – {hhmm(l.end)}
                {halfLabel && ` · ${halfLabel}`}
              </small>
            </>
          }
        />
        <Tile label={t('Raum')} value={l.room?.name ?? '–'} onMenu={() => setMenu({ title: t('Raum'), items: changeItems('raum', t('Raum')) })} />
        <Tile label={t('Lehrer')} value={l.teacher?.name ?? '–'} onMenu={() => setMenu({ title: t('Lehrer'), items: changeItems('vertretung', t('Lehrer')) })} />
      </div>

      {lessonExams.length > 0 && (
        <div className="list" style={{ marginTop: 8 }}>
          {lessonExams.map((e) => (
            <button key={e.id} type="button" className="row" onClick={() => setExam({ exam: e })}>
              <span className="exam-pill">{t(e.type)}</span>
              <span className="label">{e.topic ?? t('Thema offen')}</span>
              <Chevron />
            </button>
          ))}
        </div>
      )}

      {lessonNotes.length > 0 && (
        <>
          <h2 className="section-title">{t('Notizen')}</h2>
          <div className="list">
            {lessonNotes.map((n) => (
              <button key={n.id} type="button" className="row" onClick={() => setNote({ note: n })}>
                <Icon name="note" size={18} />
                <span className="label">{n.text || t('{n} Anhang', { n: n.attachments.length })}</span>
                <Chevron />
              </button>
            ))}
          </div>
        </>
      )}

      <div className="lesson-section-head">
        <div>
          <h2>{t('Hausaufgaben')}</h2>
          <p className="muted">{t('Zukünftige oder noch nicht erledigte')}</p>
        </div>
        <Link to="/hausaufgaben" className="link-btn">
          {t('Alle anzeigen')}
        </Link>
      </div>
      {shown.length === 0 ? (
        <div className="list">
          <button type="button" className="row" onClick={() => setHw({ defaults: hwDefaults })}>
            <span className="label muted">{t('Keine Hausaufgaben – tippen zum Eintragen')}</span>
          </button>
        </div>
      ) : (
        [...byDay].map(([due, items]) => (
          <div key={due}>
            <h3 className={`section-title ${due < today ? 'overdue' : ''}`}>{dayHeading(due)}</h3>
            <div className="list">
              {items.map((h) => (
                <HomeworkRow key={h.id} hw={h} onToggle={() => void setDone(h, !h.done)} onOpen={() => setHw({ hw: h })} />
              ))}
            </div>
          </div>
        ))
      )}

      {menu && <MenuSheet title={menu.title} items={menu.items} onClose={() => setMenu(null)} />}
      {hw && <HomeworkSheet homework={hw.hw} defaults={hw.defaults} onClose={() => setHw(null)} />}
      {note && <NoteSheet note={note.note} defaults={note.defaults} onClose={() => setNote(null)} />}
      {exam && <ExamSheet exam={exam.exam} defaults={exam.defaults} onClose={() => setExam(null)} />}
      {change && <ChangeSheet change={change.change} kind={change.kind} date={l.date} periodId={l.period.id} onClose={() => setChange(null)} />}
    </div>
  )
}
