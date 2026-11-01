import { useState } from 'react'
import { parseISODate, toISODate } from '../lib/dates'
import { halfYearOf, shiftHalfYear, type HalfYear } from '../lib/grades'
import type { Settings } from '../lib/settings'
import { Sheet } from './ui'
import { locale, t } from '../lib/i18n'

const fmt = (iso: string) => parseISODate(iso).toLocaleDateString(locale, { day: 'numeric', month: 'numeric', year: 'numeric' })

/** "1. Halbjahr 2026/27" statt "2026/27 · 1. Halbjahr" – leichter zu lesen */
export function halfYearName(h: HalfYear) {
  const [year, half] = h.key.split('-')
  return t('{half}. Halbjahr {year}', { half, year: `${year}/${String(Number(year) + 1).slice(2)}` })
}

/**
 * Auswahl des Halbjahres: zeigt Name und genauen Zeitraum;
 * Antippen öffnet eine Liste der letzten und nächsten Halbjahre.
 */
export function HalfYearPicker({
  value,
  settings,
  onChange,
}: {
  value: HalfYear
  settings: Pick<Settings, 'schoolYearStart' | 'secondHalfStart'>
  onChange: (h: HalfYear) => void
}) {
  const [open, setOpen] = useState(false)
  const current = halfYearOf(toISODate(new Date()), settings)
  // Liste: 6 Halbjahre zurück bis 1 Halbjahr voraus
  const options: HalfYear[] = []
  let h = shiftHalfYear(current, 1, settings)
  for (let i = 0; i < 8; i++) {
    options.push(h)
    h = shiftHalfYear(h, -1, settings)
  }

  return (
    <>
      <button type="button" className="half-picker" onClick={() => setOpen(true)}>
        <span className="half-picker-text">
          <span className="half-picker-name">
            {halfYearName(value)}
            {value.key === current.key && <span className="badge accent">{t('aktuell')}</span>}
          </span>
          <span className="half-picker-range">
            {fmt(value.start)} – {fmt(value.end)}
          </span>
        </span>
        <span className="half-picker-action">{t('Ändern')}</span>
      </button>
      {open && (
        <Sheet title={t('Halbjahr wählen')} onClose={() => setOpen(false)}>
          <div className="list">
            {options.map((o) => (
              <button
                key={o.key}
                type="button"
                className="row"
                onClick={() => {
                  onChange(o)
                  setOpen(false)
                }}
              >
                <span className="label">
                  {halfYearName(o)}
                  <span className="sub">
                    {fmt(o.start)} – {fmt(o.end)}
                    {o.key === current.key ? ` · ${t('aktuell')}` : ''}
                  </span>
                </span>
                {o.key === value.key && <span className="check">✓</span>}
              </button>
            ))}
          </div>
          <p className="section-footer">{t('Die Grenzen der Halbjahre stellst du unter Einstellungen → Noten ein.')}</p>
        </Sheet>
      )}
    </>
  )
}
