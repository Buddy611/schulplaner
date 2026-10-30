import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { useAuth } from '../lib/auth'
import { useSyncState } from '../lib/sync'

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
        Offline{pending > 0 && ` · ${pending} ausstehend`}
      </span>
    )
  }
  if (!sessionValid) {
    return (
      <span className="status-pill error">
        <span className="dot" />
        Neu anmelden
      </span>
    )
  }
  if (syncing) {
    return (
      <span className="status-pill syncing">
        <span className="dot" />
        Synchronisiere…
      </span>
    )
  }
  if (error) {
    return (
      <span className="status-pill error" title={error}>
        <span className="dot" />
        Sync-Fehler
      </span>
    )
  }
  if (pending > 0) {
    return (
      <span className="status-pill pending">
        <span className="dot" />
        {pending} ausstehend
      </span>
    )
  }
  return null
}
