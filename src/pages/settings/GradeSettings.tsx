import { PageHeader } from '../../components/PageHeader'
import { Field, ResetButton, Segmented, Switch } from '../../components/ui'
import { WeightPicker } from '../../components/WeightPicker'
import { useHalfYearSettings } from '../../lib/useHalfYears'
import { DEFAULT_SETTINGS, updateSettings, useSettings, type Settings } from '../../lib/settings'
import { t } from '../../lib/i18n'

/** Notensystem, Gewichtungen und Halbjahre */
export function GradeSettingsPage() {
  const settings = useSettings()
  const half = useHalfYearSettings()
  const set = (c: Partial<Settings>) => updateSettings(settings, c)
  const dm = (md: string) => `${Number(md.slice(3))}.${Number(md.slice(0, 2))}.`

  return (
    <div className="page">
      <PageHeader title={t('Noten')} back={{ to: '/einstellungen', label: t('Einstellungen') }} />

      <h2 className="section-title">{t('Noten mit + und −')}</h2>
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
        {t('Noten oder Punkte stellst du direkt auf der Einstellungsseite um. Bereits eingetragene Noten behalten ihr System – alte Halbjahre bleiben also in Noten, auch wenn du später auf Punkte wechselst.')}
      </p>

      <h2 className="section-title">{t('Gewichtung schriftlich / mündlich')}</h2>
      <div className="list">
        <div className="row stack">
          <span className="field-label">{t('Hauptfächer')}</span>
          <WeightPicker value={settings.writtenWeight} onChange={(v) => set({ writtenWeight: v ?? DEFAULT_SETTINGS.writtenWeight })} />
        </div>
        <div className="row stack">
          <span className="field-label">{t('Nebenfächer')}</span>
          <WeightPicker value={settings.writtenWeightNeben ?? settings.writtenWeight} onChange={(writtenWeightNeben) => set({ writtenWeightNeben })} />
        </div>
      </div>
      <p className="section-footer">
        {t('Erste Zahl schriftlich, zweite mündlich (in %). Mit „Eigene“ tippst du einen genauen Wert ein. Ob ein Fach Haupt- oder Nebenfach ist, stellst du unter Einstellungen → Fächer ein; einzelne Fächer kannst du auf ihrer Notenseite auch abweichend gewichten.')}
      </p>

      <h2 className="section-title">{t('Notenbesprechung')}</h2>
      <div className="list">
        <Field label={t('Notenbesprechung zählt wie … Noten')}>
          <NumberInput value={settings.besprechungWeight} min={0.1} max={50} onChange={(besprechungWeight) => set({ besprechungWeight })} />
        </Field>
      </div>
      <p className="section-footer">
        {t('Eine Notenbesprechung ist ein Zwischenstand (wie eine Zwischenzeugnisnote): Sie ersetzt alle Noten davor – schriftlich und mündlich. Noten danach werden mit ihr verrechnet. Je höher die Zahl, desto stärker zählt der Zwischenstand gegenüber den neuen Noten.')}
      </p>

      <h2 className="section-title">{t('Klausurtypen')}</h2>
      <div className="list">
        {settings.examTypes.map((tp) => (
          <div key={tp} className="row stack">
            <span className="field-label">{t(tp)}</span>
            <div className="type-settings">
              <Segmented<'schriftlich' | 'muendlich'>
                value={settings.typeCategory?.[tp] ?? 'schriftlich'}
                onChange={(v) => set({ typeCategory: { ...settings.typeCategory, [tp]: v } })}
                options={[
                  { value: 'schriftlich', label: t('Schriftlich') },
                  { value: 'muendlich', label: t('Mündlich') },
                ]}
              />
              <label className="weight-input">
                <span>{t('Gewicht')}</span>
                <NumberInput
                  value={settings.typeWeights[tp] ?? 1}
                  min={0}
                  max={10}
                  onChange={(v) => set({ typeWeights: { ...settings.typeWeights, [tp]: v } })}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
      <p className="section-footer">{t('Lege fest, ob ein Typ zur schriftlichen oder mündlichen Note zählt. Gewicht: 1 = normal, 0,5 = halb, 2 = doppelt.')}</p>

      <h2 className="section-title">{t('Halbjahre')}</h2>
      <div className="list">
        <div className="row">
          <span className="label">
            {t('Automatisch aus den Ferien')}
            <span className="sub">
              {half.halfYearSource === 'ferien'
                ? t('Schuljahr ab {a}, 2. Halbjahr ab {b}', { a: dm(half.schoolYearStart), b: dm(half.secondHalfStart) })
                : settings.halfYearAuto
                  ? t('Wähle unter „Ferien & Feiertage“ dein Bundesland')
                  : t('Aus – eigene Daten unten')}
            </span>
          </span>
          <Switch checked={settings.halfYearAuto} onChange={(halfYearAuto) => set({ halfYearAuto })} />
        </div>
        {!settings.halfYearAuto && (
          <>
            <Field label={t('Schuljahr beginnt am (TT.MM.)')}>
              <DayMonthInput value={settings.schoolYearStart} onChange={(schoolYearStart) => set({ schoolYearStart })} />
            </Field>
            <Field label={t('2. Halbjahr beginnt am (TT.MM.)')}>
              <DayMonthInput value={settings.secondHalfStart} onChange={(secondHalfStart) => set({ secondHalfStart })} />
            </Field>
          </>
        )}
      </div>
      <p className="section-footer">
        {t('Automatisch: Das Schuljahr beginnt nach den Sommerferien, das 2. Halbjahr nach den Halbjahres- bzw. Winterferien (sonst am 1. Februar). Noten und Fehlstunden werden nach Datum dem passenden Halbjahr zugeordnet.')}
      </p>
      <ResetButton
        what={t('Gewichtung und Halbjahre')}
        onReset={() =>
          set({
            tendency: DEFAULT_SETTINGS.tendency,
            writtenWeight: DEFAULT_SETTINGS.writtenWeight,
            writtenWeightNeben: undefined,
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
