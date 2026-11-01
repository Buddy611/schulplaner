import { confirmDialog } from '../../components/dialogs'
import { useState } from 'react'
import { Field, Segmented, Sheet } from '../../components/ui'
import { ABSENCES, unitsFor, type Absence } from '../../lib/changes'
import { formatDate, parseISODate, toISODate } from '../../lib/dates'
import { periodTitle, sortPeriods } from '../../lib/models'
import { newId, put, remove, type Item } from '../../lib/repo'
import { useSchedule, type ScheduledLesson } from '../../lib/schedule'
import { locale, t } from '../../lib/i18n'

const REASONS = [t('Krankheit'), t('Arzttermin'), t('Familiäre Gründe'), t('Schulveranstaltung')]

/** Fehlstunden für einen Tag eintragen: Stunden auswählen, Grund, Status */
export function AbsenceSheet({ absence, onClose }: { absence?: Item<Absence>; onClose: () => void }) {
  const schedule = useSchedule()
  const [date, setDate] = useState(absence?.date ?? toISODate(new Date()))
  const dayLessons = schedule.lessonsOn(parseISODate(date))
  const [selected, setSelected] = useState<Set<string>>(
    new Set(absence ? absence.lessons.map((l) => l.periodId) : dayLessons.map(lessonKey)),
  )
  const [reason, setReason] = useState(absence?.reason ?? REASONS[0])
  const [excused, setExcused] = useState(absence?.excused ?? false)
  const [note, setNote] = useState(absence?.note ?? '')
  const periods = schedule.timetable ? sortPeriods(schedule.timetable.periods) : []

  // Beim Bearbeiten: festgehaltene Stunden auch zeigen, wenn sich der Plan inzwischen geändert hat
  const options = dayLessons.map((l) => ({
    // Geteilte Stunden: 2. Hälfte bekommt eine eigene Kennung
    periodId: lessonKey(l),
    subjectId: l.lesson.subjectId,
    label: `${hhmm(l.start)}–${hhmm(l.end)} · ${schedule.lookups.subjectMap.get(l.lesson.subjectId)?.name ?? ''}`,
    units: unitsFor(Math.round((l.end.getTime() - l.start.getTime()) / 60_000)),
  }))
  for (const l of absence?.lessons ?? []) {
    if (!options.some((o) => o.periodId === l.periodId)) {
      const p = periods.find((x) => x.id === l.periodId.split('#')[0])
      options.push({
        periodId: l.periodId,
        subjectId: l.subjectId ?? '',
        label: `${p ? periodTitle(periods, p) : t('Stunde')} · ${(l.subjectId && schedule.lookups.subjectMap.get(l.subjectId)?.name) ?? ''}`,
        units: l.units,
      })
    }
  }
  const chosen = options.filter((o) => selected.has(o.periodId))
  const units = chosen.reduce((s, o) => s + o.units, 0)
  const canSave = chosen.length > 0 && reason.trim().length > 0

  function changeDate(next: string) {
    setDate(next)
    setSelected(new Set(schedule.lessonsOn(parseISODate(next)).map(lessonKey)))
  }

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  async function save() {
    if (!canSave) return
    await put<Absence>(ABSENCES, absence?.id ?? newId(), {
      date,
      lessons: chosen.map((o) => ({ periodId: o.periodId, subjectId: o.subjectId || undefined, units: o.units })),
      reason: reason.trim(),
      excused,
      note: note.trim() || undefined,
      createdAt: absence?.createdAt ?? Date.now(),
    })
    onClose()
  }

  async function del() {
    if (absence && await confirmDialog(t('Fehlstunden-Eintrag löschen?'), { confirm: t('Löschen'), danger: true })) {
      await remove(absence.id)
      onClose()
    }
  }

  return (
    <Sheet title={absence ? t('Fehlstunden') : t('Fehlstunden eintragen')} onClose={onClose} onSave={save} saveLabel={t('Sichern')} saveDisabled={!canSave}>
      <div className="list">
        <Field label={t('Datum')}>
          <input className="row-input" type="date" value={date} onChange={(e) => changeDate(e.target.value)} />
        </Field>
      </div>
      <p className="section-footer">{formatDate(parseISODate(date), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>

      <h3 className="section-title">
        {t('Versäumte Stunden')}
        {options.length > 0 && (
          <button
            type="button"
            className="section-link link-btn"
            onClick={() => setSelected(selected.size === options.length ? new Set() : new Set(options.map((o) => o.periodId)))}
          >
            {selected.size === options.length ? t('Keine') : t('Ganzer Tag')}
          </button>
        )}
      </h3>
      <div className="list">
        {options.length === 0 && <div className="row muted">{t('An diesem Tag ist laut Stundenplan kein Unterricht.')}</div>}
        {options.map((o) => (
          <label key={o.periodId} className="row" style={{ cursor: 'pointer' }}>
            <span className="label">
              {o.label}
              <span className="sub">
                {o.units > 1 ? t('{n} Fehlstunden', { n: o.units }) : t('1 Fehlstunde')}
              </span>
            </span>
            <input type="checkbox" className="checkbox" checked={selected.has(o.periodId)} onChange={() => toggle(o.periodId)} />
          </label>
        ))}
      </div>
      {units > 0 && <p className="section-footer">{t('Zusammen {n} Fehlstunden (45 Min. = 1 Stunde).', { n: units })}</p>}

      <h3 className="section-title">{t('Grund')}</h3>
      <div className="list">
        <div className="row stack">
          <div className="chips" style={{ marginBottom: 10 }}>
            {REASONS.map((r) => (
              <button key={r} type="button" className={`chip ${reason === r ? 'active' : ''}`} onClick={() => setReason(r)}>
                {r}
              </button>
            ))}
          </div>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('Grund')} />
        </div>
      </div>

      <h3 className="section-title">{t('Entschuldigung')}</h3>
      <div className="list">
        <div className="row stack">
          <Segmented<'yes' | 'no'>
            value={excused ? 'yes' : 'no'}
            onChange={(v) => setExcused(v === 'yes')}
            options={[
              { value: 'no', label: t('Noch nicht abgegeben') },
              { value: 'yes', label: t('Entschuldigt') },
            ]}
          />
        </div>
        <Field label={t('Notiz')}>
          <input className="row-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('optional')} />
        </Field>
      </div>

      {absence && (
        <div className="list" style={{ marginTop: 24 }}>
          <button type="button" className="row danger" onClick={del}>
            {t('Eintrag löschen')}
          </button>
        </div>
      )}
    </Sheet>
  )
}

function lessonKey(l: ScheduledLesson) {
  return l.startSlot % 2 ? `${l.period.id}#b` : l.period.id
}

function hhmm(d: Date) {
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}
