import { useState } from 'react'
import { Link } from 'react-router-dom'
import { confirmDialog } from '../components/dialogs'
import { PageHeader } from '../components/PageHeader'
import { EntitySelect, Field, Segmented, Sheet } from '../components/ui'
import { WeekGrid, type GridBlock } from '../components/WeekGrid'
import { DAY_NAMES, DAY_SHORT, SCHOOL_DAYS } from '../lib/dates'
import {
  C,
  lessonAppliesToWeek,
  lessonSlots,
  periodTitle,
  slotTime,
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

/** Gleiche Darstellung wie im Stundenplan: getönter Hintergrund + farbiger Rand links */
export function tileStyle(color: string) {
  return { background: `color-mix(in srgb, ${color} 24%, var(--card))`, boxShadow: `inset 4px 0 0 ${color}` }
}

export function TimetableEditor() {
  const settings = useSettings()
  const { timetable } = useActiveTimetable()
  const lessons = useCollection<Lesson>(C.lessons)
  const lookups = useLookups()
  const [week, setWeek] = useState<WeekFilter | null>(null)
  const [cell, setCell] = useState<{ day: number; period: Period; half?: 0 | 1 } | null>(null)

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
  const lessonPeriods = periods.filter((p) => p.kind === 'lesson')
  const currentWeek = weekTypeFor(timetable, new Date())
  const shownWeek: WeekFilter = timetable.abWeeks ? (week ?? currentWeek ?? 'A') : 'all'
  const ttLessons = lessons.filter((l) => l.timetableId === timetable.id)

  /** Stunden eines Tages für die gezeigte Woche (wochen-spezifische haben Vorrang) */
  function lessonsOfDay(day: number) {
    const list = ttLessons
      .filter((l) => l.day === day && (shownWeek === 'all' ? true : lessonAppliesToWeek(l, shownWeek)))
      .map((l) => ({ l, slots: lessonSlots(l, lessonPeriods) }))
      .filter((x): x is { l: Item<Lesson>; slots: { start: number; end: number } } => x.slots !== null)
      .sort((a, b) => Number(Boolean(b.l.week)) - Number(Boolean(a.l.week)))
    const taken: { start: number; end: number }[] = []
    return list.filter(({ slots }) => {
      if (taken.some((t) => slots.start <= t.end && t.start <= slots.end)) return false
      taken.push(slots)
      return true
    })
  }

  const blocks: GridBlock[][] = SCHOOL_DAYS.map((day) =>
    lessonsOfDay(day).flatMap(({ l, slots }) => {
      const subject = lookups.subjectMap.get(l.subjectId)
      if (!subject) return []
      const roomId = l.roomId ?? subject.roomId
      const teacherId = l.teacherId ?? subject.teacherId
      return [
        {
          key: l.id,
          start: slots.start,
          end: slots.end,
          style: tileStyle(subject.color),
          onClick: () => setCell({ day, period: lessonPeriods[Math.floor(slots.start / 2)] }),
          content: (
            <>
              <span className="short">{subject.short}</span>
              <span className="name">{subject.name}</span>
              {roomId && <span className="room">{lookups.roomMap.get(roomId)?.name}</span>}
              {teacherId && <span className="teacher">{lookups.teacherMap.get(teacherId)?.name}</span>}
              {l.week && <span className="room">nur {l.week}-Woche</span>}
            </>
          ),
        },
      ]
    }),
  )

  return (
    <div className="page">
      <PageHeader title="Bearbeiten" back={{ to: '/stundenplan', label: 'Stundenplan' }}>
        <Link to="/einstellungen/zeitraster" className="link-btn">
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

      {lessonPeriods.length === 0 ? (
        <div className="card empty">
          Noch kein Zeitraster. <Link to="/einstellungen/zeitraster">Zeitraster einrichten</Link>
        </div>
      ) : (
        <WeekGrid
          periods={periods}
          heads={SCHOOL_DAYS.map((d) => (
            <div className="tt-head">{DAY_SHORT[d]}</div>
          ))}
          blocks={blocks}
          emptyContent="+"
          onEmpty={(col, i, half) => setCell({ day: SCHOOL_DAYS[col], period: lessonPeriods[i], half })}
        />
      )}

      <p className="hint">Tippe auf ein Feld, um eine Stunde einzutragen. Stunden lassen sich teilen oder über mehrere Stunden ziehen.</p>

      {cell && (
        <LessonSheet
          timetable={timetable}
          day={cell.day}
          period={cell.period}
          lessonPeriods={lessonPeriods}
          periods={periods}
          dayLessons={lessonsOfDay(cell.day)}
          tappedHalf={cell.half}
          week={shownWeek}
          onClose={() => setCell(null)}
        />
      )}
    </div>
  )
}

interface PartState {
  subjectId?: string
  roomId?: string
  teacherId?: string
}

type Mode = 'full' | 'split'

function LessonSheet({
  timetable,
  day,
  period,
  lessonPeriods,
  periods,
  dayLessons,
  tappedHalf,
  week,
  onClose,
}: {
  timetable: Item<Timetable>
  day: number
  period: Period
  lessonPeriods: Period[]
  periods: Period[]
  dayLessons: { l: Item<Lesson>; slots: { start: number; end: number } }[]
  tappedHalf?: 0 | 1
  week: WeekFilter
  onClose: () => void
}) {
  const { subjects, teachers, rooms, subjectMap } = useLookups()
  const idx = lessonPeriods.findIndex((p) => p.id === period.id)
  const slotA = idx * 2
  const slotB = idx * 2 + 1

  // Stunden, die in dieser Stunde beginnen – und ob die 1. Hälfte von einer früheren Stunde belegt ist
  const startingHere = dayLessons.filter(({ slots }) => Math.floor(slots.start / 2) === idx)
  const occupiedA = dayLessons.some(({ slots }) => slots.start < slotA && slots.end >= slotA)
  const full = startingHere.find(({ slots }) => slots.start === slotA && slots.end !== slotA)
  const halfA = startingHere.find(({ slots }) => slots.start === slotA && slots.end === slotA)
  const halfB = startingHere.find(({ slots }) => slots.start === slotB)

  const initialMode: Mode = occupiedA || halfA || halfB || (tappedHalf !== undefined && !full) ? 'split' : 'full'
  const fromLesson = (l?: Item<Lesson>): PartState => {
    if (!l) return {}
    const s = subjectMap.get(l.subjectId)
    return { subjectId: l.subjectId, roomId: l.roomId ?? s?.roomId, teacherId: l.teacherId ?? s?.teacherId }
  }

  const [mode, setMode] = useState<Mode>(initialMode)
  const [main, setMain] = useState<PartState>(fromLesson(full?.l ?? halfA?.l))
  const [second, setSecond] = useState<PartState>(fromLesson(halfB?.l))
  // Dauer bei ganzer Stunde: Anzahl Stunden
  const [length, setLength] = useState(full ? Math.floor(full.slots.end / 2) - idx + 1 : 1)
  // 2. Hälfte geht bis: Platz-Ende
  const [secondEnd, setSecondEnd] = useState<number>(halfB ? halfB.slots.end : slotB)
  const [lessonWeek, setLessonWeek] = useState<WeekFilter>((full ?? halfA ?? halfB)?.l.week ?? 'all')
  const [creatingFor, setCreatingFor] = useState<'main' | 'second' | null>(null)

  const maxLength = Math.min(3, lessonPeriods.length - idx)
  const t = (slot: number, edge: 'start' | 'end') => slotTime(lessonPeriods, slot, edge)
  const title = `${DAY_NAMES[day]}, ${periodTitle(periods, period)}`

  async function save() {
    // Alte Einträge, die in dieser Stunde beginnen, ersetzen
    for (const x of startingHere) await remove(x.l.id)
    const base = { timetableId: timetable.id, day, week: timetable.abWeeks && lessonWeek !== 'all' ? lessonWeek : undefined }
    const write = async (part: PartState, data: Partial<Lesson>) => {
      if (!part.subjectId) return
      const s = subjectMap.get(part.subjectId)
      await put<Lesson>(C.lessons, newId(), {
        ...base,
        periodId: period.id,
        subjectId: part.subjectId,
        roomId: part.roomId !== s?.roomId ? part.roomId : undefined,
        teacherId: part.teacherId !== s?.teacherId ? part.teacherId : undefined,
        ...data,
      } as Lesson)
    }
    if (mode === 'full') {
      await write(main, length > 1 ? { endPeriodId: lessonPeriods[idx + length - 1].id } : {})
    } else {
      if (!occupiedA) await write(main, { endHalf: 0 })
      const endIdx = Math.floor(secondEnd / 2)
      await write(second, {
        startHalf: 1,
        ...(endIdx !== idx ? { endPeriodId: lessonPeriods[endIdx].id } : {}),
        ...(secondEnd % 2 === 0 ? { endHalf: 0 } : {}),
      })
    }
    onClose()
  }

  async function del() {
    if (!(await confirmDialog('Alle Einträge dieser Stunde entfernen?', { confirm: 'Entfernen', danger: true }))) return
    for (const x of startingHere) await remove(x.l.id)
    onClose()
  }

  const fieldProps = { subjects, rooms, teachers, subjectMap }

  return (
    <>
      <Sheet title={title} onClose={onClose} onSave={save} saveLabel="Sichern">
        <div className="list">
          <div className="row stack">
            <Segmented<Mode>
              value={mode}
              onChange={setMode}
              options={[
                { value: 'full', label: 'Ganze Stunde' },
                { value: 'split', label: 'Geteilt (2 Hälften)' },
              ]}
            />
          </div>
        </div>

        {mode === 'full' ? (
          <>
            <h3 className="section-title">
              {t(slotA, 'start')} – {t(slotA + length * 2 - 1, 'end')}
            </h3>
            <div className="list">
              <PartFields {...fieldProps} part={main} setPart={setMain} onCreateSubject={() => setCreatingFor('main')} />
              {maxLength > 1 && (
                <div className="row stack">
                  <span className="field-label">Dauer</span>
                  <div className="chips">
                    {Array.from({ length: maxLength }, (_, i) => i + 1).map((n) => (
                      <button key={n} type="button" className={`chip ${length === n ? 'active' : ''}`} onClick={() => setLength(n)}>
                        {n === 1 ? '1 Stunde' : `${n} Stunden`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <h3 className="section-title">
              1. Hälfte · {t(slotA, 'start')} – {t(slotA, 'end')}
            </h3>
            <div className="list">
              {occupiedA ? (
                <div className="row muted">Durch die vorherige Stunde belegt</div>
              ) : (
                <PartFields {...fieldProps} part={main} setPart={setMain} onCreateSubject={() => setCreatingFor('main')} />
              )}
            </div>
            <h3 className="section-title">
              2. Hälfte · {t(slotB, 'start')} – {t(secondEnd, 'end')}
            </h3>
            <div className="list">
              <PartFields {...fieldProps} part={second} setPart={setSecond} onCreateSubject={() => setCreatingFor('second')} />
              {second.subjectId && idx + 1 < lessonPeriods.length && (
                <div className="row stack">
                  <span className="field-label">Geht bis</span>
                  <div className="chips">
                    {[
                      { slot: slotB, label: 'Ende dieser Stunde' },
                      { slot: slotB + 1, label: 'Mitte nächster Stunde' },
                      { slot: slotB + 2, label: 'Ende nächster Stunde' },
                    ].map((o) => (
                      <button key={o.slot} type="button" className={`chip ${secondEnd === o.slot ? 'active' : ''}`} onClick={() => setSecondEnd(o.slot)}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <p className="section-footer">Zum Beispiel: erste Hälfte ein Fach, zweite Hälfte ein anderes – oder eine Stunde, die mitten im Block beginnt und in die nächste Stunde weiterläuft.</p>
          </>
        )}

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
            {week !== 'all' && <p className="section-footer">Angezeigt wird gerade die {week}-Woche.</p>}
          </>
        )}

        {startingHere.length > 0 && (
          <div className="list" style={{ marginTop: 24 }}>
            <button type="button" className="row danger" onClick={del}>
              Stunde entfernen
            </button>
          </div>
        )}
      </Sheet>
      {creatingFor && (
        <SubjectSheet
          defaultColor={nextSubjectColor(subjects.map((s) => s.color))}
          onClose={() => setCreatingFor(null)}
          onSaved={(id, s: Subject) => {
            const part = { subjectId: id, roomId: s.roomId, teacherId: s.teacherId }
            if (creatingFor === 'second') setSecond(part)
            else setMain(part)
          }}
        />
      )}
    </>
  )
}

/** Fach, Raum und Lehrer für eine (halbe) Stunde – bewusst außerhalb von LessonSheet, damit offene Auswahllisten erhalten bleiben */
function PartFields({
  part,
  setPart,
  onCreateSubject,
  subjects,
  rooms,
  teachers,
  subjectMap,
}: {
  part: PartState
  setPart: (p: PartState) => void
  onCreateSubject: () => void
} & Pick<ReturnType<typeof useLookups>, 'subjects' | 'rooms' | 'teachers' | 'subjectMap'>) {
  return (
    <>
      <Field label="Fach">
        <EntitySelect
          title="Fach"
          value={part.subjectId}
          items={subjects}
          emptyLabel="Kein Unterricht"
          onChange={(id) => {
            const s = id ? subjectMap.get(id) : undefined
            setPart({ subjectId: id, roomId: s?.roomId, teacherId: s?.teacherId })
          }}
          onCreate={async () => {
            onCreateSubject()
            return undefined
          }}
          createLabel="Neues Fach …"
        />
      </Field>
      {part.subjectId && (
        <>
          <Field label="Raum">
            <EntitySelect title="Raum" value={part.roomId} items={rooms} onChange={(roomId) => setPart({ ...part, roomId })} onCreate={() => quickCreate(C.rooms)} createLabel="Neuer Raum …" />
          </Field>
          <Field label="Lehrer">
            <EntitySelect title="Lehrer" value={part.teacherId} items={teachers} onChange={(teacherId) => setPart({ ...part, teacherId })} onCreate={() => quickCreate(C.teachers)} createLabel="Neuer Lehrer …" />
          </Field>
        </>
      )}
    </>
  )
}
