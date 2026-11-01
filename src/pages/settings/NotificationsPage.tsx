import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { Field, ResetButton, Switch } from '../../components/ui'
import { currentSubscription, disablePush, enablePush, pushSupport, sendTestPush } from '../../lib/push'
import { DEFAULT_SETTINGS, updateSettings, useSettings } from '../../lib/settings'
import { lang, t } from '../../lib/i18n'

const EXAM_DAY_OPTIONS = [14, 7, 3, 2, 1]

export function NotificationsPage() {
  const settings = useSettings()
  const cfg = settings.notifications
  const set = (changes: Partial<typeof cfg>) => updateSettings(settings, { notifications: { ...cfg, ...changes } })
  const support = pushSupport()
  const [deviceOn, setDeviceOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (support === 'ok') void currentSubscription().then((s) => setDeviceOn(Boolean(s)), () => setDeviceOn(false))
  }, [support])

  async function toggleDevice(on: boolean) {
    setBusy(true)
    setMessage('')
    try {
      if (on) {
        await enablePush()
        // Erinnerungen in der Sprache der App schicken
        await updateSettings(settings, { notifyLang: lang, notifications: { ...cfg, enabled: true } })
      } else {
        await disablePush()
      }
      setDeviceOn(on)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    setBusy(true)
    setMessage('')
    try {
      const n = await sendTestPush()
      setMessage(n > 1 ? t('Testnachricht an {n} Geräte geschickt.', { n }) : n === 1 ? t('Testnachricht an 1 Gerät geschickt.') : t('Kein Gerät angemeldet.'))
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <PageHeader title={t('Benachrichtigungen')} back={{ to: '/einstellungen', label: t('Einstellungen') }} />

      {support === 'needs-homescreen' && (
        <div className="card">
          <strong>{t('Erst zum Home-Bildschirm hinzufügen')}</strong>
          <p className="muted" style={{ marginBottom: 0 }}>
            {t('Auf iPhone und iPad gibt es Benachrichtigungen nur, wenn du die App vom Home-Bildschirm aus öffnest (ab iOS 16.4): In Safari auf „Teilen“ → „Zum Home-Bildschirm“ tippen, dann die App von dort öffnen und hier erneut aktivieren.')}
          </p>
        </div>
      )}
      {support === 'unsupported' && <div className="card">{t('Dieser Browser unterstützt leider keine Push-Benachrichtigungen.')}</div>}
      {support === 'not-configured' && <div className="card">{t('Benachrichtigungen sind noch nicht eingerichtet (VAPID-Schlüssel fehlt).')}</div>}

      <div className="list">
        <div className="row">
          <span className="label">
            {t('Erinnerungen')}
            <span className="sub">{t('Für dein Konto – gilt auf allen angemeldeten Geräten')}</span>
          </span>
          <Switch checked={cfg.enabled} onChange={(enabled) => set({ enabled })} />
        </div>
        {support === 'ok' && (
          <div className="row">
            <span className="label">
              {t('Auf diesem Gerät empfangen')}
              <span className="sub">{deviceOn ? t('Angemeldet') : t('Nicht angemeldet')}</span>
            </span>
            <Switch checked={Boolean(deviceOn)} onChange={(on) => !busy && void toggleDevice(on)} />
          </div>
        )}
      </div>

      <h2 className="section-title">{t('Wann')}</h2>
      <div className="list">
        <Field label={t('Uhrzeit')}>
          <input className="row-input" type="time" value={cfg.time} onChange={(e) => e.target.value && set({ time: e.target.value })} />
        </Field>
        <div className="row">
          <span className="label">
            {t('Hausaufgaben')}
            <span className="sub">{t('Am Vortag: was morgen fällig ist')}</span>
          </span>
          <Switch checked={cfg.homework} onChange={(homework) => set({ homework })} />
        </div>
        <div className="row">
          <span className="label">
            {t('Offene Entschuldigungen')}
            <span className="sub">{t('Wenn eine Entschuldigung seit 3 Tagen fehlt')}</span>
          </span>
          <Switch checked={cfg.excuses !== false} onChange={(excuses) => set({ excuses })} />
        </div>
        <div className="row stack">
          <span className="field-label">{t('Klausuren – erinnern … Tage vorher')}</span>
          <div className="chips">
            {EXAM_DAY_OPTIONS.map((d) => {
              const on = cfg.examDays.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  className={`chip ${on ? 'active' : ''}`}
                  onClick={() => set({ examDays: on ? cfg.examDays.filter((x) => x !== d) : [...cfg.examDays, d].sort((a, b) => b - a) })}
                >
                  {d === 1 ? t('1 Tag') : t('{n} Tage', { n: d })}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <p className="section-footer">
        {t('Die Klausur-Erinnerung zeigt auch, wie viele Themen deines Lernplans du schon abgehakt hast.')}
      </p>

      {support === 'ok' && deviceOn && (
        <div className="list" style={{ marginTop: 16 }}>
          <button type="button" className="row action" onClick={test} disabled={busy || !navigator.onLine}>
            {t('Testnachricht senden')}
          </button>
        </div>
      )}
      {message && <p className="section-footer">{message}</p>}

      <ResetButton
        what={t('Zeit und Erinnerungstage')}
        onReset={() => set({ time: DEFAULT_SETTINGS.notifications.time, homework: true, examDays: DEFAULT_SETTINGS.notifications.examDays })}
      />

      <h2 className="section-title">{t('Gut zu wissen')}</h2>
      <div className="card explain">
        <p>{t('Erinnerungen schickt ein kleiner Server-Teil bei Supabase. Dein Gerät braucht zur eingestellten Zeit Internet – sonst kommt die Nachricht, sobald es wieder online ist.')}</p>
        <p>{t('Pro Tag kommt höchstens eine Erinnerung, und nur wenn etwas ansteht.')}</p>
      </div>
    </div>
  )
}
