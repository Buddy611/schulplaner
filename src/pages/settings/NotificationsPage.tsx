import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { Field, Switch } from '../../components/ui'
import { currentSubscription, disablePush, enablePush, pushSupport, sendTestPush } from '../../lib/push'
import { updateSettings, useSettings } from '../../lib/settings'

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
        if (!cfg.enabled) await set({ enabled: true })
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
      setMessage(n > 0 ? `Testnachricht an ${n} Gerät${n > 1 ? 'e' : ''} geschickt.` : 'Kein Gerät angemeldet.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <PageHeader title="Benachrichtigungen" back={{ to: '/einstellungen', label: 'Einstellungen' }} />

      {support === 'needs-homescreen' && (
        <div className="card">
          <strong>Erst zum Home-Bildschirm hinzufügen</strong>
          <p className="muted" style={{ marginBottom: 0 }}>
            Auf iPhone und iPad gibt es Benachrichtigungen nur, wenn du die App vom Home-Bildschirm aus öffnest (ab iOS 16.4): In Safari auf
            „Teilen“ → „Zum Home-Bildschirm“ tippen, dann die App von dort öffnen und hier erneut aktivieren.
          </p>
        </div>
      )}
      {support === 'unsupported' && <div className="card">Dieser Browser unterstützt leider keine Push-Benachrichtigungen.</div>}
      {support === 'not-configured' && <div className="card">Benachrichtigungen sind noch nicht eingerichtet (VAPID-Schlüssel fehlt).</div>}

      <div className="list">
        <div className="row">
          <span className="label">
            Erinnerungen
            <span className="sub">Für dein Konto – gilt auf allen angemeldeten Geräten</span>
          </span>
          <Switch checked={cfg.enabled} onChange={(enabled) => set({ enabled })} />
        </div>
        {support === 'ok' && (
          <div className="row">
            <span className="label">
              Auf diesem Gerät empfangen
              <span className="sub">{deviceOn ? 'Angemeldet' : 'Nicht angemeldet'}</span>
            </span>
            <Switch checked={Boolean(deviceOn)} onChange={(on) => !busy && void toggleDevice(on)} />
          </div>
        )}
      </div>

      <h2 className="section-title">Wann</h2>
      <div className="list">
        <Field label="Uhrzeit">
          <input className="row-input" type="time" value={cfg.time} onChange={(e) => e.target.value && set({ time: e.target.value })} />
        </Field>
        <div className="row">
          <span className="label">
            Hausaufgaben
            <span className="sub">Am Vortag: was morgen fällig ist</span>
          </span>
          <Switch checked={cfg.homework} onChange={(homework) => set({ homework })} />
        </div>
        <div className="row stack">
          <span className="field-label">Klausuren – erinnern … Tage vorher</span>
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
                  {d === 1 ? '1 Tag' : `${d} Tage`}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <p className="section-footer">
        Die Klausur-Erinnerung zeigt auch, wie viele Themen deines Lernplans du schon abgehakt hast.
      </p>

      {support === 'ok' && deviceOn && (
        <div className="list" style={{ marginTop: 16 }}>
          <button type="button" className="row action" onClick={test} disabled={busy || !navigator.onLine}>
            Testnachricht senden
          </button>
        </div>
      )}
      {message && <p className="section-footer">{message}</p>}

      <h2 className="section-title">Gut zu wissen</h2>
      <div className="card explain">
        <p>Erinnerungen schickt ein kleiner Server-Teil bei Supabase. Dein Gerät braucht zur eingestellten Zeit Internet – sonst kommt die Nachricht, sobald es wieder online ist.</p>
        <p>Pro Tag kommt höchstens eine Erinnerung, und nur wenn etwas ansteht.</p>
      </div>
    </div>
  )
}
