import { useSyncExternalStore } from 'react'
import { db, getMeta, setMeta, type LocalRecord } from './db'
import { ATTACHMENT_BUCKET, supabase, supabaseConfigured } from './supabase'

/**
 * Synchronisation lokal <-> Supabase
 *
 * 1. Push: Alle lokal geänderten Datensätze (dirty = 1) werden hochgeladen.
 *    Der Server übernimmt eine Änderung nur, wenn sie neuer ist als sein Stand
 *    (Trigger in supabase/schema.sql) → "neueste Änderung gewinnt".
 * 2. Pull: Alles, was sich seit dem letzten Abgleich auf dem Server geändert hat,
 *    wird heruntergeladen. Lokale, noch nicht hochgeladene neuere Änderungen bleiben.
 * 3. Dateien: Fotos/Dokumente aus der Warteschlange werden hochgeladen bzw. gelöscht.
 */

interface RemoteRow {
  id: string
  collection: string
  data: unknown
  deleted: boolean
  updated_at: number
  server_updated_at: string
}

export interface SyncState {
  online: boolean
  syncing: boolean
  lastSync?: number
  error?: string
}

let state: SyncState = { online: navigator.onLine, syncing: false }
const listeners = new Set<() => void>()

function setState(changes: Partial<SyncState>) {
  state = { ...state, ...changes }
  listeners.forEach((l) => l())
}

export function useSyncState() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

const PAGE = 1000
const PUSH_CHUNK = 200
/** Beim Abholen 60 s überlappen, damit nichts durch gleichzeitige Schreibvorgänge verloren geht. */
const PULL_OVERLAP_MS = 60_000

let running: Promise<void> | null = null
let again = false
let timer: ReturnType<typeof setTimeout> | undefined

/** Plant einen Abgleich kurz nach einer Änderung (mehrere Änderungen werden gebündelt). */
export function scheduleSync(delay = 1500) {
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), delay)
}

export async function syncNow(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      await runOnce()
    } while (again)
  })().finally(() => {
    running = null
  })
  return running
}

async function runOnce() {
  if (!supabaseConfigured || !navigator.onLine) return
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id
  if (!userId) return

  setState({ syncing: true })
  try {
    await push()
    await pull()
    await syncFiles(userId)
    setState({ syncing: false, lastSync: Date.now(), error: undefined })
  } catch (e) {
    setState({ syncing: false, error: e instanceof Error ? e.message : String(e) })
  }
}

async function push() {
  const dirty = await db.records.where('dirty').equals(1).toArray()
  for (let i = 0; i < dirty.length; i += PUSH_CHUNK) {
    const chunk = dirty.slice(i, i + PUSH_CHUNK)
    const { error } = await supabase.from('records').upsert(
      chunk.map((r) => ({
        id: r.id,
        collection: r.collection,
        data: r.data,
        deleted: r.deleted === 1,
        updated_at: r.updatedAt,
      })),
      { onConflict: 'user_id,id' },
    )
    if (error) throw new Error(error.message)

    // Nur als erledigt markieren, wenn der Datensatz inzwischen nicht erneut geändert wurde.
    await db.transaction('rw', db.records, async () => {
      for (const r of chunk) {
        const current = await db.records.get(r.id)
        if (current && current.updatedAt === r.updatedAt) await db.records.update(r.id, { dirty: 0 })
      }
    })
  }
}

async function pull() {
  const cursor = await getMeta<string>('pullCursor')
  let since = cursor ? new Date(new Date(cursor).getTime() - PULL_OVERLAP_MS).toISOString() : undefined

  for (;;) {
    let query = supabase
      .from('records')
      .select('id, collection, data, deleted, updated_at, server_updated_at')
      .order('server_updated_at', { ascending: true })
      .limit(PAGE)
    if (since) query = query.gt('server_updated_at', since)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as RemoteRow[]
    if (rows.length === 0) break

    await db.transaction('rw', db.records, async () => {
      for (const row of rows) {
        const local = await db.records.get(row.id)
        const remoteUpdated = Number(row.updated_at)
        // Lokal neuere, noch nicht hochgeladene Änderung gewinnt.
        if (local?.dirty && local.updatedAt > remoteUpdated) continue
        const record: LocalRecord = {
          id: row.id,
          collection: row.collection,
          data: row.data,
          updatedAt: remoteUpdated,
          deleted: row.deleted ? 1 : 0,
          dirty: 0,
        }
        await db.records.put(record)
      }
    })

    since = rows[rows.length - 1].server_updated_at
    await setMeta('pullCursor', since)
    if (rows.length < PAGE) break
  }
}

async function syncFiles(userId: string) {
  const uploads = await db.files.where('pendingUpload').equals(1).toArray()
  for (const f of uploads) {
    if (!f.blob) continue
    const { error } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .upload(`${userId}/${f.id}`, f.blob, { upsert: true, contentType: f.type || 'application/octet-stream' })
    if (error) throw new Error(`Upload ${f.name}: ${error.message}`)
    await db.files.update(f.id, { pendingUpload: 0 })
  }

  const deletes = await db.files.where('pendingDelete').equals(1).toArray()
  if (deletes.length) {
    const { error } = await supabase.storage.from(ATTACHMENT_BUCKET).remove(deletes.map((f) => `${userId}/${f.id}`))
    if (error) throw new Error(error.message)
    await db.files.bulkDelete(deletes.map((f) => f.id))
  }
}

/** Lädt eine Datei: zuerst lokal, sonst vom Server (und speichert sie dann lokal). */
export async function getFileBlob(fileId: string): Promise<Blob | undefined> {
  const local = await db.files.get(fileId)
  if (local?.blob) return local.blob
  if (!navigator.onLine) return undefined
  const { data: session } = await supabase.auth.getSession()
  const userId = session.session?.user.id
  if (!userId) return undefined
  const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).download(`${userId}/${fileId}`)
  if (error || !data) return undefined
  await db.files.put({
    id: fileId,
    name: local?.name ?? fileId,
    type: data.type,
    size: data.size,
    blob: data,
    pendingUpload: 0,
    pendingDelete: 0,
    createdAt: local?.createdAt ?? Date.now(),
  })
  return data
}

/** Startet automatische Abgleiche: beim Start, wenn Internet zurückkommt, beim Öffnen der App und jede Minute. */
export function startAutoSync() {
  const onOnline = () => {
    setState({ online: true })
    scheduleSync(300)
  }
  const onOffline = () => setState({ online: false })
  const onVisible = () => {
    if (document.visibilityState === 'visible') scheduleSync(300)
  }
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  document.addEventListener('visibilitychange', onVisible)
  const interval = setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow()
  }, 60_000)
  scheduleSync(300)

  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    document.removeEventListener('visibilitychange', onVisible)
    clearInterval(interval)
  }
}
