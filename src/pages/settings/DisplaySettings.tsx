import { PageHeader } from '../../components/PageHeader'
import { ColorPicker, ResetButton, Segmented } from '../../components/ui'
import { ACCENT_PRESETS, DEFAULT_SETTINGS, updateSettings, useSettings, type Corners, type TextSize, type ThemeMode } from '../../lib/settings'
import { resolve, t, type LanguagePref } from '../../lib/i18n'

/** Darstellung: Hell/Dunkel, Farbschema, Schriftgröße, Ecken */
export function DisplaySettingsPage() {
  const settings = useSettings()
  const set = (changes: Partial<typeof settings>) => updateSettings(settings, changes)

  return (
    <div className="page">
      <PageHeader title={t('Darstellung')} back={{ to: '/einstellungen', label: t('Einstellungen') }} />

      <div className="list">
        <div className="row stack">
          <span className="field-label">{t('Sprache')}</span>
          <Segmented<LanguagePref>
            value={settings.language ?? 'auto'}
            onChange={(language) => set({ language, notifyLang: resolve(language) })}
            options={[
              { value: 'auto', label: t('Automatisch') },
              { value: 'de', label: 'Deutsch' },
              { value: 'en', label: 'English' },
            ]}
          />
        </div>
        <div className="row stack">
          <span className="field-label">{t('Modus')}</span>
          <Segmented<ThemeMode>
            value={settings.theme}
            onChange={(theme) => set({ theme })}
            options={[
              { value: 'system', label: t('System') },
              { value: 'light', label: t('Hell') },
              { value: 'dark', label: t('Dunkel') },
            ]}
          />
        </div>
        <div className="row stack">
          <span className="field-label">{t('Farbschema')}</span>
          <ColorPicker value={settings.accent} colors={ACCENT_PRESETS.map((p) => p.value)} onChange={(accent) => set({ accent })} />
        </div>
        <div className="row stack">
          <span className="field-label">{t('Schriftgröße')}</span>
          <Segmented<TextSize>
            value={settings.textSize}
            onChange={(textSize) => set({ textSize })}
            options={[
              { value: 'small', label: t('Klein') },
              { value: 'normal', label: t('Normal') },
              { value: 'large', label: t('Groß') },
              { value: 'xlarge', label: t('Sehr groß') },
            ]}
          />
        </div>
        <div className="row stack">
          <span className="field-label">{t('Ecken')}</span>
          <Segmented<Corners>
            value={settings.corners}
            onChange={(corners) => set({ corners })}
            options={[
              { value: 'square', label: t('Eckig') },
              { value: 'normal', label: t('Normal') },
              { value: 'round', label: t('Rund') },
            ]}
          />
        </div>
      </div>
      <p className="section-footer">
        {t('Wie bei Android wird aus der gewählten Farbe ein ganzes Farbschema berechnet. Die Darstellung gilt auf all deinen Geräten.')}
      </p>
      <ResetButton
        what={t('Die Darstellung')}
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
