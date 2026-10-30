import { confirmDialog } from '../../components/dialogs'
import { useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { Field, Segmented, Sheet, Switch } from '../../components/ui'
import { db } from '../../lib/db'
import { fromMinutes, toMinutes } from '../../lib/dates'
import { C, periodTitle, sortPeriods, useActiveTimetable, type Lesson, type Period, type Timetable } from '../../lib/models'
import { put, remove, type Item } from '../../lib/repo'

function duration(p: Period) {
  return toMinutes(p.end) - toMinutes(p.start)
}

async function savePeriods(tt: Item<Timetable>, periods: Period[]) {
  const { id, ...data } = tt
  await put<Timetable>(C.timetables, id, { ...data, periods: sortPeriods(periods) })
}

export function TimeGridPage() {
  const { timetable } = useActiveTimetable()
  const [editing, setEditing] = useState<Period | 'lesson' | 'break' | null>(null)

  if (timetable === undefined) return null
  const back = { to: '/einstellungen', label: 'Einstellungen' }
  if (!timetable) {
    return (
      <div className="page">
        <PageHeader title="Zeitraster" back={back} />
        <p className="hint">Lege zuerst unter „Stundenpläne“ einen Stundenplan an.</p>
      </div>
    )
  }

  const periods = sortPeriods(timetable.periods)

  return (
    <div className="page">
      <PageHeader title="Zeitraster" back={back} />
      <p className="subtitle">für „{timetable.name}“</p>

      {periods.length > 0 && (
        <div className="list">
          {periods.map((p) => (
            <button key={p.id} type="button" className="row" onClick={() => setEditing(p)}>
              <span className="label" style={p.kind === 'break' ? { color: 'var(--text-2)' } : undefined}>
                {periodTitle(periods, p)}
                <span className="sub">{duration(p)} Min.</span>
              </span>
              <span className="value" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {p.start} – {p.end}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="btn-row">
        <button type="button" className="btn secondary" onClick={() => setEditing('lesson')}>
          + Stunde
        </button>
        <button type="button" className="btn secondary" onClick={() => setEditing('break')}>
          + Pause
        </button>
      </div>
      <p className="hint">Neue Einträge beginnen automatisch am Ende des letzten. Tippe auf einen Eintrag, um Zeiten zu ändern.</p>

      {editing && (
        <PeriodSheet
          timetable={timetable}
          periods={periods}
          period={typeof editing === 'string' ? undefined : editing}
          newKind={typeof editing === 'string' ? editing : undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function PeriodSheet({
  timetable,
  periods,
  period,
  newKind,
  onClose,
}: {
  timetable: Item<Timetable>
  periods: Period[]
  period?: Period
  newKind?: Period['kind']
  onClose: () => void
}) {
  // Vorschlag für neue Einträge: direkt im Anschluss, gleiche Länge wie die letzte Stunde
  const last = periods[periods.length - 1]
  const lastLesson = [...periods].reverse().find((p) => p.kind === 'lesson')
  const kind0 = period?.kind ?? newKind ?? 'lesson'
  const start0 = period?.start ?? last?.end ?? '08:00'
  const len0 = kind0 === 'lesson' ? (lastLesson ? duration(lastLesson) : 45) : 15

  const [kind, setKind] = useState<Period['kind']>(kind0)
  const [label, setLabel] = useState(period?.label ?? '')
  const [start, setStart] = useState(start0)
  const [end, setEnd] = useState(period?.end ?? fromMinutes(toMinutes(start0) + len0))
  const [shiftFollowing, setShiftFollowing] = useState(true)
  const valid = Boolean(start && end) && toMinutes(end) > toMinutes(start)

  async function save() {
    let next: Period[]
    if (period) {
      const delta = toMinutes(end) - toMinutes(period.end)
      next = periods.map((p) => {
        if (p.id === period.id) return { ...p, kind, start, end, label: label.trim() || undefined }
        // Nachfolgende Einträge um dieselbe Zeit verschieben
        if (shiftFollowing && delta !== 0 && toMinutes(p.start) >= toMinutes(period.end)) {
          return { ...p, start: fromMinutes(toMinutes(p.start) + delta), end: fromMinutes(toMinutes(p.end) + delta) }
        }
        return p
      })
    } else {
      next = [...periods, { id: crypto.randomUUID(), kind, start, end, ...(label.trim() ? { label: label.trim() } : {}) }]
    }
    await savePeriods(timetable, next)
    onClose()
  }

  async function del() {
    if (!period) return
    const lessons = (await db.records.where({ collection: C.lessons, deleted: 0 }).toArray()).filter((r) => {
      const l = r.data as Lesson
      return l.timetableId === timetable.id && l.periodId === period.id
    })
    const msg =
      lessons.length > 0
        ? `Diesen Eintrag löschen? ${lessons.length} eingetragene Stunde(n) werden ebenfalls entfernt.`
        : 'Diesen Eintrag löschen?'
    if (!(await confirmDialog(msg, { confirm: 'Löschen', danger: true }))) return
    for (const l of lessons) await remove(l.id)
    await savePeriods(
      timetable,
      periods.filter((p) => p.id !== period.id),
    )
    onClose()
  }

  return (
    <Sheet title={period ? 'Bearbeiten' : kind === 'lesson' ? 'Neue Stunde' : 'Neue Pause'} onClose={onClose} onSave={save} saveDisabled={!valid}>
      <div className="list">
        <div className="row stack">
          <Segmented<Period['kind']>
            value={kind}
            onChange={setKind}
            options={[
              { value: 'lesson', label: 'Unterricht' },
              { value: 'break', label: 'Pause' },
            ]}
          />
        </div>
        <Field label="Beginn">
          <input className="row-input" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Ende">
          <input className="row-input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
        <div className="row">
          <span className="label">Dauer</span>
          <span className="value">{valid ? `${toMinutes(end) - toMinutes(start)} Min.` : '–'}</span>
        </div>
        <Field label="Bezeichnung">
          <input
            className="row-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={kind === 'lesson' ? 'automatisch' : 'z. B. Mittagspause'}
          />
        </Field>
      </div>

      {period && (
        <>
          <div className="list" style={{ marginTop: 24 }}>
            <div className="row">
              <span className="label">Nachfolgende Zeiten mitverschieben</span>
              <Switch checked={shiftFollowing} onChange={setShiftFollowing} />
            </div>
          </div>
          <p className="section-footer">Wenn du das Ende änderst, rutschen alle späteren Stunden und Pausen um dieselbe Zeit mit.</p>
          <div className="list" style={{ marginTop: 24 }}>
            <button type="button" className="row danger" onClick={del}>
              Löschen
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}
