import { PageHeader } from '../../components/PageHeader'
import { Field, ResetButton, Segmented, Switch } from '../../components/ui'
import { useHalfYearSettings } from '../../lib/useHalfYears'
import { DEFAULT_SETTINGS, updateSettings, useSettings, type Settings } from '../../lib/settings'

/** Notensystem, Gewichtungen und Halbjahre */
export function GradeSettingsPage() {
  const settings = useSettings()
  const half = useHalfYearSettings()
  const set = (c: Partial<Settings>) => updateSettings(settings, c)
  const dm = (md: string) => `${Number(md.slice(3))}.${Number(md.slice(0, 2))}.`

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
        <Field label="Notenbesprechung zählt wie … Noten">
          <NumberInput value={settings.besprechungWeight} min={0.1} max={50} onChange={(besprechungWeight) => set({ besprechungWeight })} />
        </Field>
      </div>
      <p className="section-footer">
        Eine Notenbesprechung ist ein Zwischenstand (wie eine Zwischenzeugnisnote): Sie ersetzt alle Noten davor – schriftlich und mündlich. Noten danach
        werden mit ihr verrechnet. Je höher die Zahl, desto stärker zählt der Zwischenstand gegenüber den neuen Noten.
      </p>

      <h2 className="section-title">Klausurtypen</h2>
      <div className="list">
        {settings.examTypes.map((t) => (
          <div key={t} className="row stack">
            <span className="field-label">{t}</span>
            <div className="type-settings">
              <Segmented<'schriftlich' | 'muendlich'>
                value={settings.typeCategory?.[t] ?? 'schriftlich'}
                onChange={(v) => set({ typeCategory: { ...settings.typeCategory, [t]: v } })}
                options={[
                  { value: 'schriftlich', label: 'Schriftlich' },
                  { value: 'muendlich', label: 'Mündlich' },
                ]}
              />
              <label className="weight-input">
                <span>Gewicht</span>
                <NumberInput
                  value={settings.typeWeights[t] ?? 1}
                  min={0}
                  max={10}
                  onChange={(v) => set({ typeWeights: { ...settings.typeWeights, [t]: v } })}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
      <p className="section-footer">Lege fest, ob ein Typ zur schriftlichen oder mündlichen Note zählt. Gewicht: 1 = normal, 0,5 = halb, 2 = doppelt.</p>

      <h2 className="section-title">Halbjahre</h2>
      <div className="list">
        <div className="row">
          <span className="label">
            Automatisch aus den Ferien
            <span className="sub">
              {half.halfYearSource === 'ferien'
                ? `Schuljahr ab ${dm(half.schoolYearStart)}, 2. Halbjahr ab ${dm(half.secondHalfStart)}`
                : settings.halfYearAuto
                  ? 'Wähle unter „Ferien & Feiertage“ dein Bundesland'
                  : 'Aus – eigene Daten unten'}
            </span>
          </span>
          <Switch checked={settings.halfYearAuto} onChange={(halfYearAuto) => set({ halfYearAuto })} />
        </div>
        {!settings.halfYearAuto && (
          <>
            <Field label="Schuljahr beginnt am (TT.MM.)">
              <DayMonthInput value={settings.schoolYearStart} onChange={(schoolYearStart) => set({ schoolYearStart })} />
            </Field>
            <Field label="2. Halbjahr beginnt am (TT.MM.)">
              <DayMonthInput value={settings.secondHalfStart} onChange={(secondHalfStart) => set({ secondHalfStart })} />
            </Field>
          </>
        )}
      </div>
      <p className="section-footer">
        Automatisch: Das Schuljahr beginnt nach den Sommerferien, das 2. Halbjahr nach den Halbjahres- bzw. Winterferien (sonst am 1. Februar). Noten und
        Fehlstunden werden nach Datum dem passenden Halbjahr zugeordnet.
      </p>
      <ResetButton
        what="Gewichtung und Halbjahre"
        onReset={() =>
          set({
            tendency: DEFAULT_SETTINGS.tendency,
            writtenWeight: DEFAULT_SETTINGS.writtenWeight,
            besprechungWeight: DEFAULT_SETTINGS.besprechungWeight,
            typeWeights: DEFAULT_SETTINGS.typeWeights,
            typeCategory: DEFAULT_SETTINGS.typeCategory,
            halfYearAuto: DEFAULT_SETTINGS.halfYearAuto,
            schoolYearStart: DEFAULT_SETTINGS.schoolYearStart,
            secondHalfStart: DEFAULT_SETTINGS.secondHalfStart,
          })
        }
      />
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
