import { useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { Field, Select, Sheet } from '../../components/ui'
import { toISODate } from '../../lib/dates'
import { ensureHolidays, formatRange, FREE_DAYS, useHolidayCache, useHolidays, type FreeDay } from '../../lib/holidays'
import { newId, put, remove, useCollection } from '../../lib/repo'
import { STATES, updateSettings, useSettings } from '../../lib/settings'

export function HolidaysPage() {
  const settings = useSettings()
  const holidays = useHolidays(settings.state)
  const cache = useHolidayCache()
  const own = useCollection<FreeDay>(FREE_DAYS)
  const [adding, setAdding] = useState(false)
  const [status, setStatus] = useState('')
  const today = toISODate(new Date())
  const upcoming = holidays.filter((h) => h.end >= today)

  async function reload() {
    setStatus('Lädt …')
    try {
      await ensureHolidays(settings.state, true)
      setStatus('Aktualisiert.')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Fehler beim Laden.')
    }
  }

  return (
    <div className="page">
      <PageHeader title="Ferien & Feiertage" back={{ to: '/einstellungen', label: 'Einstellungen' }}>
        <button type="button" className="icon-btn" aria-label="Freien Tag hinzufügen" onClick={() => setAdding(true)}>
          +
        </button>
      </PageHeader>

      <div className="list">
        <Field label="Bundesland">
          <Select
            title="Bundesland"
            value={settings.state || undefined}
            options={STATES.map((s) => ({ value: s.code, label: s.name }))}
            onChange={(state) => updateSettings(settings, { state })}
          />
        </Field>
        {settings.state && (
          <button type="button" className="row action" onClick={reload} disabled={!navigator.onLine}>
            <span className="label">Ferien neu laden</span>
            <span className="value">{status || (cache?.fetchedAt ? `Stand ${new Date(cache.fetchedAt).toLocaleDateString('de-DE')}` : '')}</span>
          </button>
        )}
      </div>
      <p className="section-footer">
        Ferien und Feiertage kommen von openholidaysapi.org und werden für zwei Schuljahre im Voraus auf dem Gerät gespeichert – sie funktionieren
        also auch offline. In dieser Zeit zeigt der Stundenplan keinen Unterricht, und „Nächste Stunde“ überspringt sie.
      </p>

      {!settings.state && <p className="hint">Wähle oben dein Bundesland, dann werden die Ferien geladen.</p>}

      {upcoming.length > 0 && (
        <>
          <h2 className="section-title">Kommende freie Tage</h2>
          <div className="list">
            {upcoming.map((h, i) => {
              const ownEntry = h.kind === 'frei' ? own?.find((o) => o.start === h.start && o.name === h.name) : undefined
              return (
                <div key={i} className="row">
                  <span className={`holiday-dot ${h.kind}`} />
                  <span className="label">
                    {h.name}
                    <span className="sub">
                      {formatRange(h)} · {h.kind === 'ferien' ? 'Ferien' : h.kind === 'feiertag' ? 'Feiertag' : 'Eigener freier Tag'}
                    </span>
                  </span>
                  {ownEntry && (
                    <button type="button" className="link-btn" style={{ color: 'var(--red)' }} onClick={() => remove(ownEntry.id)}>
                      Entfernen
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {adding && <FreeDaySheet onClose={() => setAdding(false)} />}
    </div>
  )
}

/** Eigener freier Tag, z. B. Studientag, beweglicher Ferientag, Klassenfahrt */
function FreeDaySheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [start, setStart] = useState(toISODate(new Date()))
  const [end, setEnd] = useState(toISODate(new Date()))
  const valid = name.trim() && start && end && end >= start

  async function save() {
    if (!valid) return
    await put<FreeDay>(FREE_DAYS, newId(), { name: name.trim(), start, end, createdAt: Date.now() })
    onClose()
  }

  return (
    <Sheet title="Freier Tag" onClose={onClose} onSave={save} saveLabel="Sichern" saveDisabled={!valid}>
      <div className="list">
        <Field label="Bezeichnung">
          <input className="row-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Studientag, Klassenfahrt" autoFocus />
        </Field>
        <Field label="Von">
          <input className="row-input" type="date" value={start} onChange={(e) => (setStart(e.target.value), end < e.target.value && setEnd(e.target.value))} />
        </Field>
        <Field label="Bis">
          <input className="row-input" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      <p className="section-footer">An diesen Tagen zeigt der Stundenplan keinen Unterricht. Eigene freie Tage werden mit deinen Geräten synchronisiert.</p>
    </Sheet>
  )
}
