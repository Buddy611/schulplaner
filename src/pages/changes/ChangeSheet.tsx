import { useState } from 'react'
import { EntitySelect, Field, Segmented, Sheet } from '../../components/ui'
import { CHANGES, type ChangeKind, type LessonChange } from '../../lib/changes'
import { formatDate, parseISODate, toISODate } from '../../lib/dates'
import { C, periodTitle, sortPeriods } from '../../lib/models'
import { newId, put, remove, type Item } from '../../lib/repo'
import { useSchedule } from '../../lib/schedule'
import { quickCreate } from '../settings/MasterData'

/** Ausfall, Vertretung oder Raumänderung für eine einzelne Stunde eintragen */
export function ChangeSheet({
  change,
  date: initialDate,
  periodId: initialPeriod,
  onClose,
}: {
  change?: Item<LessonChange>
  date?: string
  periodId?: string
  onClose: () => void
}) {
  const schedule = useSchedule()
  const { teachers, rooms, subjects } = schedule.lookups
  const [date, setDate] = useState(change?.date ?? initialDate ?? toISODate(new Date()))
  const [periodId, setPeriodId] = useState(change?.periodId ?? initialPeriod)
  const [kind, setKind] = useState<ChangeKind>(change?.kind ?? 'ausfall')
  const [teacherId, setTeacherId] = useState(change?.teacherId)
  const [subjectId, setSubjectId] = useState(change?.subjectId)
  const [roomId, setRoomId] = useState(change?.roomId)
  const [note, setNote] = useState(change?.note ?? '')

  const periods = schedule.timetable ? sortPeriods(schedule.timetable.periods) : []
  // Geplante Stunden an diesem Tag (ohne die Änderung selbst)
  const dayLessons = schedule.lessonsOn(parseISODate(date))
  const selected = dayLessons.find((l) => l.period.id === periodId)
  const plannedSubject = selected ? schedule.lookups.subjectMap.get(selected.lesson.subjectId) : undefined
  const canSave = Boolean(date && periodId && (kind !== 'raum' || roomId))

  async function save() {
    if (!canSave) return
    await put<LessonChange>(CHANGES, change?.id ?? newId(), {
      date,
      periodId: periodId!,
      kind,
      teacherId: kind === 'vertretung' ? teacherId : undefined,
      subjectId: kind === 'vertretung' ? subjectId : undefined,
      roomId: kind === 'ausfall' ? undefined : roomId,
      note: note.trim() || undefined,
      createdAt: change?.createdAt ?? Date.now(),
    })
    onClose()
  }

  async function del() {
    if (change) {
      await remove(change.id)
      onClose()
    }
  }

  return (
    <Sheet title={change ? 'Änderung' : 'Ausfall / Vertretung'} onClose={onClose} onSave={save} saveLabel="Sichern" saveDisabled={!canSave}>
      <div className="list">
        <Field label="Datum">
          <input className="row-input" type="date" value={date} onChange={(e) => (setDate(e.target.value), setPeriodId(undefined))} />
        </Field>
        <div className="row stack">
          <span className="field-label">Stunde</span>
          {dayLessons.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              An diesem Tag ist kein Unterricht.
            </p>
          ) : (
            <div className="chips">
              {dayLessons.map((l) => (
                <button
                  key={l.period.id + l.startSlot}
                  type="button"
                  className={`chip ${periodId === l.period.id ? 'active' : ''}`}
                  onClick={() => setPeriodId(l.period.id)}
                >
                  {periodTitle(periods, l.period)} · {schedule.lookups.subjectMap.get(l.lesson.subjectId)?.short}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <h3 className="section-title">Was ändert sich?</h3>
      <div className="list">
        <div className="row stack">
          <Segmented<ChangeKind>
            value={kind}
            onChange={setKind}
            options={[
              { value: 'ausfall', label: 'Ausfall' },
              { value: 'vertretung', label: 'Vertretung' },
              { value: 'raum', label: 'Raum' },
            ]}
          />
        </div>
        {kind === 'vertretung' && (
          <>
            <Field label="Vertretungslehrer">
              <EntitySelect title="Lehrer" value={teacherId} items={teachers} onChange={setTeacherId} emptyLabel="Unbekannt" onCreate={() => quickCreate(C.teachers)} createLabel="Neuer Lehrer …" />
            </Field>
            <Field label="Fach">
              <EntitySelect title="Fach" value={subjectId} items={subjects} onChange={setSubjectId} emptyLabel={plannedSubject ? `Wie geplant (${plannedSubject.name})` : 'Wie geplant'} />
            </Field>
          </>
        )}
        {kind !== 'ausfall' && (
          <Field label={kind === 'raum' ? 'Neuer Raum' : 'Raum (falls anders)'}>
            <EntitySelect title="Raum" value={roomId} items={rooms} onChange={setRoomId} emptyLabel={kind === 'raum' ? 'Raum wählen …' : 'Wie geplant'} onCreate={() => quickCreate(C.rooms)} createLabel="Neuer Raum …" />
          </Field>
        )}
        <Field label="Notiz">
          <input className="row-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Aufgaben auf Moodle" />
        </Field>
      </div>
      {date && (
        <p className="section-footer">{formatDate(parseISODate(date), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      )}

      {change && (
        <div className="list" style={{ marginTop: 24 }}>
          <button type="button" className="row danger" onClick={del}>
            Änderung entfernen (Stunde wie geplant)
          </button>
        </div>
      )}
    </Sheet>
  )
}
