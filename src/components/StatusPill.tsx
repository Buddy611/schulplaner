import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { useAuth } from '../lib/auth'
import { useSyncState } from '../lib/sync'
import { t } from '../lib/i18n'

export function usePendingCount() {
  return (
    useLiveQuery(async () => {
      const records = await db.records.where('dirty').equals(1).count()
      const uploads = await db.files.where('pendingUpload').equals(1).count()
      const deletes = await db.files.where('pendingDelete').equals(1).count()
      return records + uploads + deletes
    }) ?? 0
  )
}

/** Dezente Anzeige oben rechts: offline? noch etwas zu synchronisieren? */
export function StatusPill() {
  const { online, syncing, error } = useSyncState()
  const { sessionValid } = useAuth()
  const pending = usePendingCount()

  if (!online) {
    return (
      <span className="status-pill offline">
        <span className="dot" />
        Offline{pending > 0 && ` · ${t('{n} ausstehend', { n: pending })}`}
      </span>
    )
  }
  if (!sessionValid) {
    return (
      <span className="status-pill error">
        <span className="dot" />
        {t('Neu anmelden')}
      </span>
    )
  }
  if (syncing) {
    return (
      <span className="status-pill syncing">
        <span className="dot" />
        {t('Synchronisiere…')}
      </span>
    )
  }
  if (error) {
    return (
      <span className="status-pill error" title={error}>
        <span className="dot" />
        {t('Sync-Fehler')}
      </span>
    )
  }
  if (pending > 0) {
    return (
      <span className="status-pill pending">
        <span className="dot" />
        {t('{n} ausstehend', { n: pending })}
      </span>
    )
  }
  return null
}
