import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { Field, Select, Sheet } from '../../components/ui'
import { toISODate } from '../../lib/dates'
import { ensureHolidays, fetchCountries, fetchRegions, formatRange, FREE_DAYS, regionKey, useHolidayCache, useHolidays, type FreeDay, type Place } from '../../lib/holidays'
import { newId, put, remove, useCollection } from '../../lib/repo'
import { STATES, updateSettings, useSettings } from '../../lib/settings'
import { locale, t } from '../../lib/i18n'

export function HolidaysPage() {
  const settings = useSettings()
  const country = settings.country ?? 'DE'
  const region = regionKey(settings)
  const holidays = useHolidays(region)
  const [countries, setCountries] = useState<Place[]>([])
  const [regions, setRegions] = useState<Place[]>([])

  // Länder und Regionen kommen von der Ferien-Schnittstelle (und werden für offline gemerkt)
  useEffect(() => {
    void fetchCountries().then(setCountries, () => undefined)
  }, [])
  useEffect(() => {
    if (country === 'DE') return setRegions(STATES.map((s) => ({ code: s.code, name: s.name })))
    setRegions([])
    void fetchRegions(country).then(setRegions, () => undefined)
  }, [country])
  const cache = useHolidayCache()
  const own = useCollection<FreeDay>(FREE_DAYS)
  const [adding, setAdding] = useState(false)
  const [status, setStatus] = useState('')
  const today = toISODate(new Date())
  const upcoming = holidays.filter((h) => h.end >= today)

  async function reload() {
    setStatus(t('Lädt …'))
    try {
      await ensureHolidays(region, true)
      setStatus(t('Aktualisiert.'))
    } catch (e) {
      setStatus(e instanceof Error ? e.message : t('Fehler beim Laden.'))
    }
  }

  return (
    <div className="page">
      <PageHeader title={t('Ferien & Feiertage')} back={{ to: '/einstellungen', label: t('Einstellungen') }}>
        <button type="button" className="icon-btn" aria-label={t('Freien Tag hinzufügen')} onClick={() => setAdding(true)}>
          +
        </button>
      </PageHeader>

      <div className="list">
        <Field label={t('Land')}>
          <Select
            title={t('Land')}
            value={country}
            options={(countries.length ? countries : [{ code: 'DE', name: t('Deutschland') }]).map((c) => ({ value: c.code, label: c.name }))}
            onChange={(c) => c !== country && updateSettings(settings, { country: c === 'DE' ? undefined : c, state: '', regionName: countries.find((x) => x.code === c)?.name })}
          />
        </Field>
        <Field label={country === 'DE' ? t('Bundesland') : t('Region')}>
          <Select
            title={country === 'DE' ? t('Bundesland') : t('Region')}
            value={country === 'DE' ? settings.state || undefined : settings.state}
            placeholder={country === 'DE' ? t('Bitte wählen …') : t('Ganzes Land')}
            options={[
              ...(country === 'DE' ? [] : [{ value: '', label: t('Ganzes Land') }]),
              ...regions.map((r) => ({ value: r.code, label: r.name })),
            ]}
            onChange={(state) => updateSettings(settings, { state, regionName: regions.find((r) => r.code === state)?.name ?? countries.find((x) => x.code === country)?.name })}
          />
        </Field>
        {region && (
          <button type="button" className="row action" onClick={reload} disabled={!navigator.onLine}>
            <span className="label">{t('Ferien neu laden')}</span>
            <span className="value">{status || (cache?.fetchedAt ? t('Stand {date}', { date: new Date(cache.fetchedAt).toLocaleDateString(locale) }) : '')}</span>
          </button>
        )}
      </div>
      <p className="section-footer">
        {t('Ferien und Feiertage kommen von openholidaysapi.org und werden für zwei Schuljahre im Voraus auf dem Gerät gespeichert – sie funktionieren also auch offline. In dieser Zeit zeigt der Stundenplan keinen Unterricht, und „Nächste Stunde“ überspringt sie.')}
      </p>

      {!region && <p className="hint">{t('Wähle oben dein Bundesland, dann werden die Ferien geladen.')}</p>}
      {region && cache?.state === region && !cache.items.some((h) => h.kind === 'ferien') && (
        <p className="hint">{t('Für diese Auswahl gibt es keine Schulferien-Daten. Trag deine Ferien mit + als freie Tage ein.')}</p>
      )}

      {upcoming.length > 0 && (
        <>
          <h2 className="section-title">{t('Kommende freie Tage')}</h2>
          <div className="list">
            {upcoming.map((h, i) => {
              const ownEntry = h.kind === 'frei' ? own?.find((o) => o.start === h.start && o.name === h.name) : undefined
              return (
                <div key={i} className="row">
                  <span className={`holiday-dot ${h.kind}`} />
                  <span className="label">
                    {h.name}
                    <span className="sub">
                      {formatRange(h)} · {h.kind === 'ferien' ? t('Ferien') : h.kind === 'feiertag' ? t('Feiertag') : t('Eigener freier Tag')}
                    </span>
                  </span>
                  {ownEntry && (
                    <button type="button" className="link-btn" style={{ color: 'var(--red)' }} onClick={() => remove(ownEntry.id)}>
                      {t('Entfernen')}
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
    <Sheet title={t('Freier Tag')} onClose={onClose} onSave={save} saveLabel={t('Sichern')} saveDisabled={!valid}>
      <div className="list">
        <Field label={t('Bezeichnung')}>
          <input className="row-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('z. B. Studientag, Klassenfahrt')} />
        </Field>
        <Field label={t('Von')}>
          <input className="row-input" type="date" value={start} onChange={(e) => (setStart(e.target.value), end < e.target.value && setEnd(e.target.value))} />
        </Field>
        <Field label={t('Bis')}>
          <input className="row-input" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      <p className="section-footer">{t('An diesen Tagen zeigt der Stundenplan keinen Unterricht. Eigene freie Tage werden mit deinen Geräten synchronisiert.')}</p>
    </Sheet>
  )
}
