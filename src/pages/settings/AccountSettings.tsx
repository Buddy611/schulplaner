import { confirmDialog, alertDialog, promptDialog } from '../../components/dialogs'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { usePendingCount } from '../../components/StatusPill'
import { useAuth } from '../../lib/auth'
import { deleteAllData, exportBackup, importBackup } from '../../lib/backup'
import { put } from '../../lib/repo'
import { DEFAULT_SETTINGS, useSettings, type Settings } from '../../lib/settings'
import { syncNow, useSyncState } from '../../lib/sync'
import { PasswordSheet } from './PasswordSheet'
import { locale, t } from '../../lib/i18n'

/** Konto, Synchronisation und Backup */
export function AccountSettingsPage() {
  const { user, signOut, sessionValid } = useAuth()
  const sync = useSyncState()
  const pending = usePendingCount()
  const settings = useSettings()
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null))
  }, [])

  async function handleSignOut() {
    const warn =
      pending > 0
        ? t('Achtung: {n} Änderung(en) sind noch nicht synchronisiert und gehen beim Abmelden verloren. Trotzdem abmelden?', { n: pending })
        : t('Wirklich abmelden? Die Daten auf diesem Gerät werden entfernt (in der Cloud bleiben sie erhalten).')
    if (await confirmDialog(warn, { title: t('Abmelden?'), confirm: t('Abmelden'), danger: true })) await signOut()
  }

  return (
    <div className="page">
      <PageHeader title={t('Konto & Daten')} back={{ to: '/einstellungen', label: t('Einstellungen') }} />

      <h2 className="section-title">{t('Konto')}</h2>
      <div className="list">
        <div className="row">
          <span className="label">{t('Angemeldet als')}</span>
          <span className="value">{user?.email}</span>
        </div>
        {!sessionValid && (
          <Link to="/anmelden" className="row action">
            {t('Sitzung abgelaufen – erneut anmelden (Daten bleiben erhalten)')}
          </Link>
        )}
        <button type="button" className="row action" onClick={() => setChangingPassword(true)}>
          {t('Passwort ändern')}
        </button>
        <button type="button" className="row danger" onClick={handleSignOut}>
          {t('Abmelden')}
        </button>
      </div>

      <h2 className="section-title">{t('Synchronisation')}</h2>
      <div className="list">
        <div className="row">
          <span className="label">{t('Verbindung')}</span>
          <span className="value">{sync.online ? t('Online') : t('Offline')}</span>
        </div>
        <div className="row">
          <span className="label">{t('Noch nicht synchronisiert')}</span>
          <span className="value">{pending}</span>
        </div>
        <div className="row">
          <span className="label">{t('Letzter Abgleich')}</span>
          <span className="value">
            {sync.lastSync ? new Date(sync.lastSync).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '–'}
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
          {sync.syncing ? t('Synchronisiere…') : t('Jetzt synchronisieren')}
        </button>
      </div>
      <p className="section-footer">
        {t('Alles wird auf dem Gerät gespeichert und automatisch abgeglichen, sobald Internet da ist.')}
        {persisted === true && ` ${t('Speicher ist dauerhaft geschützt.')}`}
      </p>

      <h2 className="section-title">{t('Backup')}</h2>
      <div className="list">
        <button type="button" className="row action" onClick={() => exportBackup().catch((e) => alertDialog(String(e), t('Export fehlgeschlagen')))}>
          {t('Alle Daten exportieren')}
        </button>
        <label className="row action" style={{ cursor: 'pointer' }}>
          {t('Backup importieren …')}
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              if (!(await confirmDialog(t('Einträge aus dem Backup überschreiben gleiche Einträge in der App. Andere Einträge bleiben erhalten.'), { title: t('Backup importieren?'), confirm: t('Importieren') }))) return
              try {
                const r = await importBackup(file)
                await alertDialog(t('{records} Einträge und {files} Dateien wurden übernommen.', { records: r.records, files: r.files }), t('Import fertig'))
              } catch (err) {
                await alertDialog(err instanceof Error ? err.message : String(err), t('Import fehlgeschlagen'))
              }
            }}
          />
        </label>
      </div>
      <p className="section-footer">{t('Speichert alles (inkl. Fotos und Dokumente) in einer Datei, z. B. in der Dateien-App oder bei Google Drive.')}</p>

      <h2 className="section-title">{t('Zurücksetzen')}</h2>
      <div className="list">
        <button
          type="button"
          className="row action"
          onClick={async () => {
            const ok = await confirmDialog(
              t('Darstellung, Notensystem, Gewichtung, Halbjahre, Klausurtypen, Benachrichtigungen, Bundesland und Layout werden auf die Standardwerte gesetzt. Deine Einträge (Stundenplan, Hausaufgaben, Noten …) bleiben erhalten.'),
              { title: t('Alle Einstellungen zurücksetzen?'), confirm: t('Zurücksetzen') },
            )
            if (ok) await put<Settings>('settings', 'settings', { ...DEFAULT_SETTINGS, activeTimetableId: settings.activeTimetableId })
          }}
        >
          {t('Alle Einstellungen zurücksetzen')}
        </button>
        <button
          type="button"
          className="row danger"
          onClick={async () => {
            const typed = await promptDialog(t('Alle Daten löschen'), {
              message: t('Das löscht ALLE Einträge auf allen deinen Geräten: Stundenpläne, Fächer, Hausaufgaben, Klausuren, Noten, Notizen, Vokabeln, Fotos. Tipp vorher am besten auf „Alle Daten exportieren“. Zum Bestätigen LÖSCHEN eintippen.'),
              placeholder: t('LÖSCHEN'),
              confirm: t('Endgültig löschen'),
            })
            if (typed?.trim().toUpperCase() !== t('LÖSCHEN')) {
              if (typed) await alertDialog(t('Nicht gelöscht – das Wort stimmte nicht.'))
              return
            }
            await deleteAllData()
            await alertDialog(t('Alle Daten wurden gelöscht.'), t('Erledigt'))
          }}
        >
          {t('Alle Daten löschen …')}
        </button>
      </div>

      {changingPassword && user && <PasswordSheet email={user.email} onClose={() => setChangingPassword(false)} />}
    </div>
  )
}
