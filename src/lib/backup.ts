import { db, type LocalFile } from './db'
import { scheduleSync } from './sync'

/**
 * Backup als eine JSON-Datei: alle Datensätze und alle lokal vorhandenen Fotos/Dokumente.
 * Beim Import werden die Daten übernommen und wie neue Änderungen synchronisiert.
 */

interface BackupFile {
  app: 'schulplaner'
  version: 1
  exportedAt: string
  records: { id: string; collection: string; data: unknown; updatedAt: number }[]
  files: { id: string; name: string; type: string; size: number; createdAt: number; base64: string }[]
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

function base64ToBlob(base64: string, type: string): Blob {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

export async function exportBackup() {
  const records = (await db.records.filter((r) => r.deleted === 0).toArray()).map(({ id, collection, data, updatedAt }) => ({
    id,
    collection,
    data,
    updatedAt,
  }))
  const files: BackupFile['files'] = []
  for (const f of await db.files.toArray()) {
    if (!f.blob || f.pendingDelete) continue
    files.push({ id: f.id, name: f.name, type: f.type, size: f.size, createdAt: f.createdAt, base64: await blobToBase64(f.blob) })
  }
  const backup: BackupFile = { app: 'schulplaner', version: 1, exportedAt: new Date().toISOString(), records, files }

  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
  const name = `schulplaner-backup-${new Date().toISOString().slice(0, 10)}.json`
  const file = new File([blob], name, { type: 'application/json' })

  // Auf iPhone/iPad/Android: Teilen-Menü (in Dateien sichern, AirDrop …); sonst normaler Download
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Schulplaner-Backup' })
      return
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Liest eine Backup-Datei und übernimmt alle Einträge. Gibt die Anzahl zurück. */
export async function importBackup(file: File): Promise<{ records: number; files: number }> {
  let backup: BackupFile
  try {
    backup = JSON.parse(await file.text())
  } catch {
    throw new Error('Die Datei ist kein gültiges Backup.')
  }
  if (backup?.app !== 'schulplaner' || !Array.isArray(backup.records)) {
    throw new Error('Die Datei ist kein Schulplaner-Backup.')
  }

  const now = Date.now()
  await db.transaction('rw', db.records, db.files, async () => {
    // Neuer Zeitstempel, damit das Backup beim Abgleich auf allen Geräten gewinnt
    await db.records.bulkPut(
      backup.records.map((r, i) => ({
        id: r.id,
        collection: r.collection,
        data: r.data,
        updatedAt: now + i,
        deleted: 0 as const,
        dirty: 1 as const,
      })),
    )
    const files: LocalFile[] = (backup.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      size: f.size,
      createdAt: f.createdAt,
      blob: base64ToBlob(f.base64, f.type),
      pendingUpload: 1,
      pendingDelete: 0,
    }))
    await db.files.bulkPut(files)
  })
  scheduleSync(300)
  return { records: backup.records.length, files: backup.files?.length ?? 0 }
}
