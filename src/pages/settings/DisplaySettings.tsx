import { PageHeader } from '../../components/PageHeader'
import { ColorPicker, ResetButton, Segmented } from '../../components/ui'
import { ACCENT_PRESETS, DEFAULT_SETTINGS, updateSettings, useSettings, type Corners, type TextSize, type ThemeMode } from '../../lib/settings'

/** Darstellung: Hell/Dunkel, Farbschema, Schriftgröße, Ecken */
export function DisplaySettingsPage() {
  const settings = useSettings()
  const set = (changes: Partial<typeof settings>) => updateSettings(settings, changes)

  return (
    <div className="page">
      <PageHeader title="Darstellung" back={{ to: '/einstellungen', label: 'Einstellungen' }} />

      <div className="list">
        <div className="row stack">
          <span className="field-label">Modus</span>
          <Segmented<ThemeMode>
            value={settings.theme}
            onChange={(theme) => set({ theme })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Hell' },
              { value: 'dark', label: 'Dunkel' },
            ]}
          />
        </div>
        <div className="row stack">
          <span className="field-label">Farbschema</span>
          <ColorPicker value={settings.accent} colors={ACCENT_PRESETS.map((p) => p.value)} onChange={(accent) => set({ accent })} />
        </div>
        <div className="row stack">
          <span className="field-label">Schriftgröße</span>
          <Segmented<TextSize>
            value={settings.textSize}
            onChange={(textSize) => set({ textSize })}
            options={[
              { value: 'small', label: 'Klein' },
              { value: 'normal', label: 'Normal' },
              { value: 'large', label: 'Groß' },
              { value: 'xlarge', label: 'Sehr groß' },
            ]}
          />
        </div>
        <div className="row stack">
          <span className="field-label">Ecken</span>
          <Segmented<Corners>
            value={settings.corners}
            onChange={(corners) => set({ corners })}
            options={[
              { value: 'square', label: 'Eckig' },
              { value: 'normal', label: 'Normal' },
              { value: 'round', label: 'Rund' },
            ]}
          />
        </div>
      </div>
      <p className="section-footer">
        Wie bei Android wird aus der gewählten Farbe ein ganzes Farbschema berechnet. Die Darstellung gilt auf all deinen Geräten.
      </p>
      <ResetButton
        what="Die Darstellung"
        onReset={() =>
          set({
            theme: DEFAULT_SETTINGS.theme,
            accent: DEFAULT_SETTINGS.accent,
            textSize: DEFAULT_SETTINGS.textSize,
            corners: DEFAULT_SETTINGS.corners,
          })
        }
      />
    </div>
  )
}
