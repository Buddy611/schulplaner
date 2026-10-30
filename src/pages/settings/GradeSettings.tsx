import { PageHeader } from '../../components/PageHeader'
import { Field, Segmented } from '../../components/ui'
import { updateSettings, useSettings, type Settings } from '../../lib/settings'

/** Notensystem, Gewichtungen und Halbjahre */
export function GradeSettingsPage() {
  const settings = useSettings()
  const set = (c: Partial<Settings>) => updateSettings(settings, c)

  return (
    <div className="page">
      <PageHeader title="Noten" back={{ to: '/einstellungen', label: 'Einstellungen' }} />

      <h2 className="section-title">Noten mit + und −</h2>
      <div className="list">
        <div className="row stack">
          <Segmented<Settings['tendency']>
            value={settings.tendency}
            onChange={(tendency) => set({ tendency })}
            options={[
              { value: 'third', label: '2+ = 1,67' },
              { value: 'quarter', label: '2+ = 1,75' },
              { value: 'half', label: '2+ = 1,5' },
            ]}
          />
        </div>
      </div>
      <p className="section-footer">
        Noten oder Punkte stellst du direkt auf der Einstellungsseite um. Bereits eingetragene Noten behalten ihr System – alte Halbjahre bleiben
        also in Noten, auch wenn du später auf Punkte wechselst.
      </p>

      <h2 className="section-title">Gewichtung</h2>
      <div className="list">
        <Field label="Standard-Anteil schriftlich in %">
          <NumberInput value={settings.writtenWeight} min={0} max={100} onChange={(writtenWeight) => set({ writtenWeight })} />
        </Field>
        <Field label="Notenbesprechung zählt wie … mündliche Einzelnoten">
          <NumberInput value={settings.besprechungWeight} min={0.1} max={50} onChange={(besprechungWeight) => set({ besprechungWeight })} />
        </Field>
      </div>
      <p className="section-footer">
        Eine Notenbesprechung ist deine mündliche Gesamtnote zu diesem Zeitpunkt. Die neueste ersetzt alle älteren mündlichen Noten. Mündliche Noten
        danach zählen zusätzlich – je höher die Zahl hier, desto stärker zählt die Besprechung gegenüber diesen neuen Noten.
      </p>

      <h2 className="section-title">Gewicht je Typ (schriftlich)</h2>
      <div className="list">
        {settings.examTypes.map((t) => (
          <Field key={t} label={t}>
            <NumberInput
              value={settings.typeWeights[t] ?? 1}
              min={0}
              max={10}
              onChange={(v) => set({ typeWeights: { ...settings.typeWeights, [t]: v } })}
            />
          </Field>
        ))}
      </div>
      <p className="section-footer">1 = zählt normal, 0,5 = zählt halb, 2 = zählt doppelt.</p>

      <h2 className="section-title">Halbjahre</h2>
      <div className="list">
        <Field label="Schuljahr beginnt am (TT.MM.)">
          <DayMonthInput value={settings.schoolYearStart} onChange={(schoolYearStart) => set({ schoolYearStart })} />
        </Field>
        <Field label="2. Halbjahr beginnt am (TT.MM.)">
          <DayMonthInput value={settings.secondHalfStart} onChange={(secondHalfStart) => set({ secondHalfStart })} />
        </Field>
      </div>
      <p className="section-footer">Noten werden nach Datum dem passenden Halbjahr zugeordnet.</p>
    </div>
  )
}

/** Zahl mit Komma; wird erst beim Verlassen des Feldes übernommen (ungültig → alter Wert) */
function NumberInput({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  const shown = String(value).replace('.', ',')
  return (
    <input
      key={shown}
      className="row-input"
      inputMode="decimal"
      defaultValue={shown}
      onBlur={(e) => {
        const v = Number(e.target.value.replace(',', '.'))
        if (e.target.value.trim() === '' || Number.isNaN(v) || v < min || v > max) return void (e.target.value = shown)
        if (v !== value) onChange(v)
      }}
    />
  )
}

/** Eingabe "TT.MM." – gespeichert als "MM-TT" */
function DayMonthInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const shown = `${value.slice(3)}.${value.slice(0, 2)}.`
  return (
    <input
      key={shown}
      className="row-input"
      defaultValue={shown}
      onBlur={(e) => {
        const m = e.target.value.match(/^(\d{1,2})\.(\d{1,2})\.?$/)
        if (!m) return void (e.target.value = shown)
        const [d, mo] = [Number(m[1]), Number(m[2])]
        if (d < 1 || d > 31 || mo < 1 || mo > 12) return void (e.target.value = shown)
        onChange(`${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
      }}
    />
  )
}
