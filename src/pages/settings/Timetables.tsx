import { confirmDialog, promptDialog } from '../../components/dialogs'
import { useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { Field, Segmented, Sheet, Switch } from '../../components/ui'
import { db } from '../../lib/db'
import {
  abRefFor,
  C,
  templatePeriods,
  useActiveTimetable,
  weekTypeFor,
  type Lesson,
  type Timetable,
  type WeekType,
} from '../../lib/models'
import { newId, put, remove, type Item } from '../../lib/repo'
import { updateSettings, useSettings, type Settings } from '../../lib/settings'
import { useHalfYearSettings } from '../../lib/useHalfYears'
import { useSchedule } from '../../lib/schedule'
import { halfYearOf, shiftHalfYear } from '../../lib/grades'
import { parseISODate, toISODate } from '../../lib/dates'

const fmtDate = (iso: string) => parseISODate(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric' })

/** Legt einen neuen Stundenplan an (Zeitraster vom Vorbild übernommen) und macht ihn aktiv. */
export async function createTimetable(settings: Settings, name: string, from?: Item<Timetable> | null, copyLessons = false, validFrom?: string) {
  const id = newId()
  await put<Timetable>(C.timetables, id, {
    name,
    periods: from ? from.periods : templatePeriods(),
    abWeeks: from?.abWeeks ?? false,
    abRefMonday: from?.abRefMonday,
    validFrom,
    createdAt: Date.now(),
  })
  if (from && copyLessons) {
    const lessons = await db.records.where({ collection: C.lessons, deleted: 0 }).toArray()
    for (const l of lessons) {
      const data = l.data as Lesson
      if (data.timetableId === from.id) await put<Lesson>(C.lessons, newId(), { ...data, timetableId: id })
    }
  }
  await updateSettings(settings, { activeTimetableId: id })
  return id
}

export function TimetablesPage() {
  const settings = useSettings()
  const { timetable: active, all } = useActiveTimetable()
  const [editing, setEditing] = useState<Item<Timetable> | null>(null)
  const halfSettings = useHalfYearSettings()
  const schedule = useSchedule()
  const today = toISODate(new Date())
  const current = schedule.timetableFor(new Date())

  async function add() {
    const name = (await promptDialog('Neuer Stundenplan', { initial: `Schuljahr ${new Date().getFullYear()}/${String(new Date().getFullYear() + 1).slice(2)}`, confirm: 'Anlegen' }))?.trim()
    if (!name) return
    const copy = active
      ? await confirmDialog(`Das Zeitraster wird übernommen. Sollen auch die Stunden aus „${active.name}“ kopiert werden?`, {
          title: 'Stunden übernehmen?',
          confirm: 'Kopieren',
          cancel: 'Leer starten',
        })
      : false
    // Vorschlag: der neue Plan gilt automatisch ab dem nächsten Halbjahr
    const nextHalf = shiftHalfYear(halfYearOf(today, halfSettings), 1, halfSettings).start
    const fromNextHalf = await confirmDialog(
      `Soll der Plan automatisch ab dem nächsten Halbjahr gelten (${fmtDate(nextHalf)})? Bis dahin bleibt der bisherige Plan sichtbar. Das Datum kannst du später unter „Bearbeiten“ ändern.`,
      { title: 'Ab wann gilt der Plan?', confirm: 'Ab nächstem Halbjahr', cancel: 'Ab sofort' },
    )
    await createTimetable(settings, name, active, copy, fromNextHalf ? nextHalf : undefined)
  }

  return (
    <div className="page">
      <PageHeader title="Stundenpläne" back={{ to: '/einstellungen', label: 'Einstellungen' }}>
        <button type="button" className="icon-btn" aria-label="Stundenplan hinzufügen" onClick={add}>
          +
        </button>
      </PageHeader>
      {all && all.length === 0 && <p className="hint">Noch kein Stundenplan. Tippe auf +, um einen anzulegen.</p>}
      {all && all.length > 0 && (
        <>
          <div className="list">
            {all.map((t) => (
              <div key={t.id} className="row" style={{ padding: 0 }}>
                <button
                  type="button"
                  className="row"
                  style={{ flex: 1 }}
                  onClick={() => updateSettings(settings, { activeTimetableId: t.id })}
                >
                  <span className="label">
                    {t.name}
                    <span className="sub">
                      {[t.validFrom ? (t.validFrom > today ? `gilt ab ${fmtDate(t.validFrom)}` : `seit ${fmtDate(t.validFrom)}`) : null, t.abWeeks ? 'A/B-Wochen' : null, t.id === current?.id ? 'gilt gerade' : null]
                        .filter(Boolean)
                        .join(' · ') || 'ohne Startdatum'}
                    </span>
                  </span>
                  {t.id === active?.id && <span className="check">✓</span>}
                </button>
                <button type="button" className="link-btn" style={{ paddingRight: 16 }} onClick={() => setEditing(t)}>
                  Bearbeiten
                </button>
              </div>
            ))}
          </div>
          <p className="section-footer">Der Haken zeigt den Plan, den du bearbeitest. Welcher Plan an einem Tag gilt, richtet sich nach „gilt ab“ – so wechselt die App z. B. zum 2. Halbjahr automatisch.</p>
        </>
      )}
      {editing && <TimetableSheet timetable={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function TimetableSheet({ timetable, onClose }: { timetable: Item<Timetable>; onClose: () => void }) {
  const [name, setName] = useState(timetable.name)
  const [abWeeks, setAbWeeks] = useState(timetable.abWeeks)
  const [validFrom, setValidFrom] = useState(timetable.validFrom ?? '')
  const [currentWeek, setCurrentWeek] = useState<WeekType>(weekTypeFor({ ...timetable, abWeeks: true }, new Date()) ?? 'A')

  async function save() {
    const { id, ...data } = timetable
    await put<Timetable>(C.timetables, id, {
      ...data,
      name: name.trim(),
      abWeeks,
      abRefMonday: abWeeks ? abRefFor(new Date(), currentWeek) : data.abRefMonday,
      validFrom: validFrom || undefined,
    })
    onClose()
  }

  async function del() {
    if (!(await confirmDialog(`Stundenplan „${timetable.name}“ mit allen Stunden löschen?`, { confirm: 'Löschen', danger: true }))) return
    const lessons = await db.records.where({ collection: C.lessons, deleted: 0 }).toArray()
    for (const l of lessons) if ((l.data as Lesson).timetableId === timetable.id) await remove(l.id)
    await remove(timetable.id)
    onClose()
  }

  return (
    <Sheet title="Stundenplan" onClose={onClose} onSave={save} saveDisabled={!name.trim()}>
      <div className="list">
        <Field label="Name">
          <input className="row-input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Gilt ab (leer = immer)">
          <input className="row-input" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
        </Field>
        {validFrom && (
          <button type="button" className="row action" onClick={() => setValidFrom('')}>
            Startdatum entfernen
          </button>
        )}
        <div className="row">
          <span className="label">A/B-Wochen</span>
          <Switch checked={abWeeks} onChange={setAbWeeks} />
        </div>
        {abWeeks && (
          <div className="row stack">
            <span className="field-label">Diese Woche ist eine …</span>
            <Segmented<WeekType>
              value={currentWeek}
              onChange={setCurrentWeek}
              options={[
                { value: 'A', label: 'A-Woche' },
                { value: 'B', label: 'B-Woche' },
              ]}
            />
          </div>
        )}
      </div>
      <p className="section-footer">
        Bei A/B-Wochen kannst du Stunden eintragen, die nur in A- oder nur in B-Wochen stattfinden. Danach wechseln die Wochen automatisch ab.
      </p>
      <div className="list" style={{ marginTop: 24 }}>
        <button type="button" className="row danger" onClick={del}>
          Stundenplan löschen
        </button>
      </div>
    </Sheet>
  )
}
