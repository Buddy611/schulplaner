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
import { locale, t } from '../../lib/i18n'

const fmtDate = (iso: string) => parseISODate(iso).toLocaleDateString(locale, { day: 'numeric', month: 'numeric', year: 'numeric' })

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
    const name = (await promptDialog(t('Neuer Stundenplan'), { initial: t('Schuljahr {year}', { year: `${new Date().getFullYear()}/${String(new Date().getFullYear() + 1).slice(2)}` }), confirm: t('Anlegen') }))?.trim()
    if (!name) return
    const copy = active
      ? await confirmDialog(t('Das Zeitraster wird übernommen. Sollen auch die Stunden aus „{name}“ kopiert werden?', { name: active.name }), {
          title: t('Stunden übernehmen?'),
          confirm: t('Kopieren'),
          cancel: t('Leer starten'),
        })
      : false
    // Vorschlag: der neue Plan gilt automatisch ab dem nächsten Halbjahr
    const nextHalf = shiftHalfYear(halfYearOf(today, halfSettings), 1, halfSettings).start
    const fromNextHalf = await confirmDialog(
      t('Soll der Plan automatisch ab dem nächsten Halbjahr gelten ({date})? Bis dahin bleibt der bisherige Plan sichtbar. Das Datum kannst du später unter „Bearbeiten“ ändern.', { date: fmtDate(nextHalf) }),
      { title: t('Ab wann gilt der Plan?'), confirm: t('Ab nächstem Halbjahr'), cancel: t('Ab sofort') },
    )
    await createTimetable(settings, name, active, copy, fromNextHalf ? nextHalf : undefined)
  }

  return (
    <div className="page">
      <PageHeader title={t('Stundenpläne')} back={{ to: '/einstellungen', label: t('Einstellungen') }}>
        <button type="button" className="icon-btn" aria-label={t('Stundenplan hinzufügen')} onClick={add}>
          +
        </button>
      </PageHeader>
      {all && all.length === 0 && <p className="hint">{t('Noch kein Stundenplan. Tippe auf +, um einen anzulegen.')}</p>}
      {all && all.length > 0 && (
        <>
          <div className="list">
            {all.map((tp) => (
              <div key={tp.id} className="row" style={{ padding: 0 }}>
                <button
                  type="button"
                  className="row"
                  style={{ flex: 1 }}
                  onClick={() => updateSettings(settings, { activeTimetableId: tp.id })}
                >
                  <span className="label">
                    {tp.name}
                    <span className="sub">
                      {[tp.validFrom ? (tp.validFrom > today ? t('gilt ab {date}', { date: fmtDate(tp.validFrom) }) : t('seit {date}', { date: fmtDate(tp.validFrom) })) : null, tp.abWeeks ? t('A/B-Wochen') : null, tp.id === current?.id ? t('gilt gerade') : null]
                        .filter(Boolean)
                        .join(' · ') || t('ohne Startdatum')}
                    </span>
                  </span>
                  {tp.id === active?.id && <span className="check">✓</span>}
                </button>
                <button type="button" className="link-btn" style={{ paddingRight: 16 }} onClick={() => setEditing(tp)}>
                  {t('Bearbeiten')}
                </button>
              </div>
            ))}
          </div>
          <p className="section-footer">{t('Der Haken zeigt den Plan, den du bearbeitest. Welcher Plan an einem Tag gilt, richtet sich nach „gilt ab“ – so wechselt die App z. B. zum 2. Halbjahr automatisch.')}</p>
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
    if (!(await confirmDialog(t('Stundenplan „{name}“ mit allen Stunden löschen?', { name: timetable.name }), { confirm: t('Löschen'), danger: true }))) return
    const lessons = await db.records.where({ collection: C.lessons, deleted: 0 }).toArray()
    for (const l of lessons) if ((l.data as Lesson).timetableId === timetable.id) await remove(l.id)
    await remove(timetable.id)
    onClose()
  }

  return (
    <Sheet title={t('Stundenplan')} onClose={onClose} onSave={save} saveDisabled={!name.trim()}>
      <div className="list">
        <Field label={t('Name')}>
          <input className="row-input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('Gilt ab (leer = immer)')}>
          <input className="row-input" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
        </Field>
        {validFrom && (
          <button type="button" className="row action" onClick={() => setValidFrom('')}>
            {t('Startdatum entfernen')}
          </button>
        )}
        <div className="row">
          <span className="label">{t('A/B-Wochen')}</span>
          <Switch checked={abWeeks} onChange={setAbWeeks} />
        </div>
        {abWeeks && (
          <div className="row stack">
            <span className="field-label">{t('Diese Woche ist eine …')}</span>
            <Segmented<WeekType>
              value={currentWeek}
              onChange={setCurrentWeek}
              options={[
                { value: 'A', label: t('A-Woche') },
                { value: 'B', label: t('B-Woche') },
              ]}
            />
          </div>
        )}
      </div>
      <p className="section-footer">
        {t('Bei A/B-Wochen kannst du Stunden eintragen, die nur in A- oder nur in B-Wochen stattfinden. Danach wechseln die Wochen automatisch ab.')}
      </p>
      <div className="list" style={{ marginTop: 24 }}>
        <button type="button" className="row danger" onClick={del}>
          {t('Stundenplan löschen')}
        </button>
      </div>
    </Sheet>
  )
}
