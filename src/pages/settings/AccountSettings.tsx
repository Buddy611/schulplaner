import { confirmDialog, alertDialog } from '../../components/dialogs'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { usePendingCount } from '../../components/StatusPill'
import { useAuth } from '../../lib/auth'
import { exportBackup, importBackup } from '../../lib/backup'
import { syncNow, useSyncState } from '../../lib/sync'
import { PasswordSheet } from './PasswordSheet'

/** Konto, Synchronisation und Backup */
export function AccountSettingsPage() {
  const { user, signOut, sessionValid } = useAuth()
  const sync = useSyncState()
  const pending = usePendingCount()
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null))
  }, [])

  async function handleSignOut() {
    const warn =
      pending > 0
        ? `Achtung: ${pending} Änderung(en) sind noch nicht synchronisiert und gehen beim Abmelden verloren. Trotzdem abmelden?`
        : 'Wirklich abmelden? Die Daten auf diesem Gerät werden entfernt (in der Cloud bleiben sie erhalten).'
    if (await confirmDialog(warn, { title: 'Abmelden?', confirm: 'Abmelden', danger: true })) await signOut()
  }

  return (
    <div className="page">
      <PageHeader title="Konto & Daten" back={{ to: '/einstellungen', label: 'Einstellungen' }} />

      <h2 className="section-title">Konto</h2>
      <div className="list">
        <div className="row">
          <span className="label">Angemeldet als</span>
          <span className="value">{user?.email}</span>
        </div>
        {!sessionValid && (
          <Link to="/anmelden" className="row action">
            Sitzung abgelaufen – erneut anmelden (Daten bleiben erhalten)
          </Link>
        )}
        <button type="button" className="row action" onClick={() => setChangingPassword(true)}>
          Passwort ändern
        </button>
        <button type="button" className="row danger" onClick={handleSignOut}>
          Abmelden
        </button>
      </div>

      <h2 className="section-title">Synchronisation</h2>
      <div className="list">
        <div className="row">
          <span className="label">Verbindung</span>
          <span className="value">{sync.online ? 'Online' : 'Offline'}</span>
        </div>
        <div className="row">
          <span className="label">Noch nicht synchronisiert</span>
          <span className="value">{pending}</span>
        </div>
        <div className="row">
          <span className="label">Letzter Abgleich</span>
          <span className="value">
            {sync.lastSync ? new Date(sync.lastSync).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '–'}
          </span>
        </div>
        {sync.error && (
          <div className="row">
            <span className="label" style={{ color: 'var(--red)' }}>
              {sync.error}
            </span>
          </div>
        )}
        <button type="button" className="row action" onClick={() => void syncNow()} disabled={!sync.online || sync.syncing}>
          {sync.syncing ? 'Synchronisiere…' : 'Jetzt synchronisieren'}
        </button>
      </div>
      <p className="section-footer">
        Alles wird auf dem Gerät gespeichert und automatisch abgeglichen, sobald Internet da ist.
        {persisted === true && ' Speicher ist dauerhaft geschützt.'}
      </p>

      <h2 className="section-title">Backup</h2>
      <div className="list">
        <button type="button" className="row action" onClick={() => exportBackup().catch((e) => alertDialog(String(e), 'Export fehlgeschlagen'))}>
          Alle Daten exportieren
        </button>
        <label className="row action" style={{ cursor: 'pointer' }}>
          Backup importieren …
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              if (!(await confirmDialog('Einträge aus dem Backup überschreiben gleiche Einträge in der App. Andere Einträge bleiben erhalten.', { title: 'Backup importieren?', confirm: 'Importieren' }))) return
              try {
                const r = await importBackup(file)
                await alertDialog(`${r.records} Einträge und ${r.files} Dateien wurden übernommen.`, 'Import fertig')
              } catch (err) {
                await alertDialog(err instanceof Error ? err.message : String(err), 'Import fehlgeschlagen')
              }
            }}
          />
        </label>
      </div>
      <p className="section-footer">Speichert alles (inkl. Fotos und Dokumente) in einer Datei, z. B. in der Dateien-App oder bei Google Drive.</p>

      {changingPassword && user && <PasswordSheet email={user.email} onClose={() => setChangingPassword(false)} />}
    </div>
  )
}
