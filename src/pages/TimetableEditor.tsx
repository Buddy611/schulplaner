import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { EntitySelect, Field, Segmented, Sheet } from '../components/ui'
import { DAY_NAMES, DAY_SHORT, SCHOOL_DAYS, toMinutes } from '../lib/dates'
import {
  C,
  lessonAppliesToWeek,
  periodTitle,
  sortPeriods,
  useActiveTimetable,
  useLookups,
  weekTypeFor,
  type Lesson,
  type Period,
  type Subject,
  type Timetable,
  type WeekType,
} from '../lib/models'
import { newId, put, remove, useCollection, type Item } from '../lib/repo'
import { useSettings } from '../lib/settings'
import { quickCreate } from './settings/MasterData'
import { nextSubjectColor, SubjectSheet } from './settings/Subjects'
import { createTimetable } from './settings/Timetables'

type WeekFilter = WeekType | 'all'

export function TimetableEditor() {
  const settings = useSettings()
  const { timetable } = useActiveTimetable()
  const lessons = useCollection<Lesson>(C.lessons)
  const lookups = useLookups()
  const [week, setWeek] = useState<WeekFilter | null>(null)
  const [cell, setCell] = useState<{ day: number; period: Period } | null>(null)

  if (timetable === undefined || !lessons) return null

  if (!timetable) {
    return (
      <div className="page">
        <PageHeader title="Bearbeiten" back={{ to: '/stundenplan', label: 'Stundenplan' }} />
        <div className="card empty">
          <p>Du hast noch keinen Stundenplan.</p>
          <button type="button" className="btn" onClick={() => createTimetable(settings, 'Mein Stundenplan')}>
            Stundenplan anlegen
          </button>
        </div>
      </div>
    )
  }

  const periods = sortPeriods(timetable.periods)
  const currentWeek = weekTypeFor(timetable, new Date())
  const shownWeek: WeekFilter = timetable.abWeeks ? (week ?? currentWeek ?? 'A') : 'all'
  const ttLessons = lessons.filter((l) => l.timetableId === timetable.id)

  function lessonAt(day: number, periodId: string) {
    const here = ttLessons.filter((l) => l.day === day && l.periodId === periodId)
    if (shownWeek === 'all') return here.find((l) => !l.week) ?? here[0]
    return here.find((l) => l.week === shownWeek) ?? here.find((l) => lessonAppliesToWeek(l, shownWeek))
  }

  return (
    <div className="page">
      <PageHeader title="Bearbeiten" back={{ to: '/stundenplan', label: 'Stundenplan' }}>
        <Link to="/einstellungen/zeitraster" className="link-btn" style={{ textDecoration: 'none' }}>
          Zeiten
        </Link>
      </PageHeader>
      <p className="subtitle">{timetable.name}</p>

      {timetable.abWeeks && (
        <div className="toolbar">
          <Segmented<WeekFilter>
            value={shownWeek}
            onChange={setWeek}
            options={[
              { value: 'A', label: `A-Woche${currentWeek === 'A' ? ' (jetzt)' : ''}` },
              { value: 'B', label: `B-Woche${currentWeek === 'B' ? ' (jetzt)' : ''}` },
            ]}
          />
        </div>
      )}

      {periods.length === 0 ? (
        <div className="card empty">
          Noch kein Zeitraster. <Link to="/einstellungen/zeitraster">Zeitraster einrichten</Link>
        </div>
      ) : (
        <div className="tt-grid">
          <div />
          {SCHOOL_DAYS.map((d) => (
            <div key={d} className="tt-head">
              {DAY_SHORT[d]}
            </div>
          ))}
          {periods.map((p) =>
            p.kind === 'break' ? (
              <BreakRow key={p.id} period={p} periods={periods} />
            ) : (
              <LessonRow
                key={p.id}
                period={p}
                periods={periods}
                lessonAt={lessonAt}
                lookups={lookups}
                onTap={(day) => setCell({ day, period: p })}
              />
            ),
          )}
        </div>
      )}

      <p className="hint">Tippe auf ein Feld, um eine Stunde einzutragen oder zu ändern.</p>

      {cell && (
        <LessonSheet
          timetable={timetable}
          day={cell.day}
          period={cell.period}
          periods={periods}
          lesson={lessonAt(cell.day, cell.period.id)}
          week={shownWeek}
          onClose={() => setCell(null)}
        />
      )}
    </div>
  )
}

function BreakRow({ period, periods }: { period: Period; periods: Period[] }) {
  return (
    <>
      <div className="tt-break-time">{period.start}</div>
      <div className="tt-break">{periodTitle(periods, period)}</div>
    </>
  )
}

function LessonRow({
  period,
  periods,
  lessonAt,
  lookups,
  onTap,
}: {
  period: Period
  periods: Period[]
  lessonAt: (day: number, periodId: string) => Item<Lesson> | undefined
  lookups: ReturnType<typeof useLookups>
  onTap: (day: number) => void
}) {
  // Höhe der Zeile passend zur Länge der Stunde
  const minutes = toMinutes(period.end) - toMinutes(period.start)
  return (
    <>
      <div className="tt-time" style={{ height: `calc(var(--tt-px-per-min) * ${minutes})` }}>
        <span>{period.start}</span>
        <strong>{periodTitle(periods, period).replace('. Stunde', '.')}</strong>
        <span>{period.end}</span>
      </div>
      {SCHOOL_DAYS.map((day) => {
        const lesson = lessonAt(day, period.id)
        const subject = lesson && lookups.subjectMap.get(lesson.subjectId)
        if (!lesson || !subject) {
          return (
            <button key={day} type="button" className="tt-cell empty" aria-label={`${DAY_NAMES[day]} eintragen`} onClick={() => onTap(day)}>
              +
            </button>
          )
        }
        const roomId = lesson.roomId ?? subject.roomId
        const teacherId = lesson.teacherId ?? subject.teacherId
        return (
          <button
            key={day}
            type="button"
            className="tt-cell filled"
            style={{
              background: `color-mix(in srgb, ${subject.color} 24%, var(--card))`,
              boxShadow: `inset 4px 0 0 ${subject.color}`,
            }}
            onClick={() => onTap(day)}
          >
            <span className="short">{subject.short}</span>
            <span className="name">{subject.name}</span>
            {roomId && <span className="room">{lookups.roomMap.get(roomId)?.name}</span>}
            {teacherId && <span className="teacher">{lookups.teacherMap.get(teacherId)?.name}</span>}
            {lesson.week && <span className="room">nur {lesson.week}-Woche</span>}
          </button>
        )
      })}
    </>
  )
}

function LessonSheet({
  timetable,
  day,
  period,
  periods,
  lesson,
  week,
  onClose,
}: {
  timetable: Item<Timetable>
  day: number
  period: Period
  periods: Period[]
  lesson?: Item<Lesson>
  week: WeekFilter
  onClose: () => void
}) {
  const { subjects, teachers, rooms, subjectMap } = useLookups()
  const [subjectId, setSubjectId] = useState(lesson?.subjectId)
  const subject: Subject | undefined = subjectId ? subjectMap.get(subjectId) : undefined
  // Raum/Lehrer: eigener Wert der Stunde, sonst Standard des Fachs
  const [roomId, setRoomId] = useState(lesson?.roomId ?? subject?.roomId)
  const [teacherId, setTeacherId] = useState(lesson?.teacherId ?? subject?.teacherId)
  const [lessonWeek, setLessonWeek] = useState<WeekFilter>(lesson ? (lesson.week ?? 'all') : 'all')
  const [creatingSubject, setCreatingSubject] = useState(false)

  function chooseSubject(id: string | undefined) {
    setSubjectId(id)
    const s = id ? subjectMap.get(id) : undefined
    setRoomId(s?.roomId)
    setTeacherId(s?.teacherId)
  }

  async function save() {
    if (!subjectId) {
      if (lesson) await remove(lesson.id)
      onClose()
      return
    }
    const s = subjectMap.get(subjectId)
    await put<Lesson>(C.lessons, lesson?.id ?? newId(), {
      timetableId: timetable.id,
      day,
      periodId: period.id,
      subjectId,
      // Nur speichern, wenn abweichend vom Fach – so wirken spätere Änderungen am Fach weiter
      roomId: roomId !== s?.roomId ? roomId : undefined,
      teacherId: teacherId !== s?.teacherId ? teacherId : undefined,
      week: timetable.abWeeks && lessonWeek !== 'all' ? lessonWeek : undefined,
    })
    onClose()
  }

  async function del() {
    if (lesson) await remove(lesson.id)
    onClose()
  }

  const title = `${DAY_NAMES[day]}, ${periodTitle(periods, period)}`

  return (
    <>
      <Sheet title={title} onClose={onClose} onSave={save}>
        <p className="section-footer" style={{ textAlign: 'center', marginBottom: 12 }}>
          {period.start} – {period.end}
          {timetable.abWeeks && week !== 'all' && ` · angezeigt: ${week}-Woche`}
        </p>
        <div className="list">
          <Field label="Fach">
            <EntitySelect
              title="Fach"
              value={subjectId}
              items={subjects}
              onChange={chooseSubject}
              emptyLabel="Kein Unterricht"
              onCreate={async () => {
                setCreatingSubject(true)
                return undefined
              }}
              createLabel="Neues Fach …"
            />
          </Field>
          <Field label="Raum">
            <EntitySelect title="Raum" value={roomId} items={rooms} onChange={setRoomId} onCreate={() => quickCreate(C.rooms)} createLabel="Neuer Raum …" />
          </Field>
          <Field label="Lehrer">
            <EntitySelect title="Lehrer" value={teacherId} items={teachers} onChange={setTeacherId} onCreate={() => quickCreate(C.teachers)} createLabel="Neuer Lehrer …" />
          </Field>
        </div>
        {subject && <p className="section-footer">Raum und Lehrer sind vom Fach vorausgefüllt und hier nur für diese Stunde änderbar.</p>}

        {timetable.abWeeks && (
          <>
            <h3 className="section-title">Findet statt</h3>
            <div className="list">
              <div className="row stack">
                <Segmented<WeekFilter>
                  value={lessonWeek}
                  onChange={setLessonWeek}
                  options={[
                    { value: 'all', label: 'Jede Woche' },
                    { value: 'A', label: 'Nur A' },
                    { value: 'B', label: 'Nur B' },
                  ]}
                />
              </div>
            </div>
          </>
        )}

        {lesson && (
          <div className="list" style={{ marginTop: 24 }}>
            <button type="button" className="row danger" onClick={del}>
              Stunde entfernen
            </button>
          </div>
        )}
      </Sheet>
      {creatingSubject && (
        <SubjectSheet
          defaultColor={nextSubjectColor(subjects.map((s) => s.color))}
          onClose={() => setCreatingSubject(false)}
          onSaved={(id, s) => {
            setSubjectId(id)
            setRoomId(s.roomId)
            setTeacherId(s.teacherId)
          }}
        />
      )}
    </>
  )
}
