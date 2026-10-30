import Dexie, { type EntityTable } from 'dexie'

/**
 * Alle Daten der App liegen lokal in IndexedDB. Jeder Datensatz gehört zu einer
 * "collection" (z. B. 'subjects', 'homework') und wird als ein Eintrag in
 * `records` gespeichert. Genau diese Struktur wird 1:1 mit Supabase synchronisiert.
 */
export interface LocalRecord<T = unknown> {
  id: string
  collection: string
  data: T
  /** Zeitpunkt der letzten Änderung (ms, Uhr des Geräts) – entscheidet Konflikte. */
  updatedAt: number
  /** Gelöscht-Markierung, damit Löschungen auch auf andere Geräte übertragen werden. */
  deleted: 0 | 1
  /** 1 = lokale Änderung, die noch zu Supabase hochgeladen werden muss. */
  dirty: 0 | 1
}

/** Lokal gespeicherte Datei (Foto/Dokument), die später hochgeladen wird. */
export interface LocalFile {
  id: string
  name: string
  type: string
  size: number
  blob?: Blob
  /** 1 = muss noch hochgeladen werden */
  pendingUpload: 0 | 1
  /** 1 = soll auf dem Server gelöscht werden */
  pendingDelete: 0 | 1
  createdAt: number
}

export interface MetaEntry {
  key: string
  value: unknown
}

export const db = new Dexie('schulplaner') as Dexie & {
  records: EntityTable<LocalRecord, 'id'>
  files: EntityTable<LocalFile, 'id'>
  meta: EntityTable<MetaEntry, 'key'>
}

db.version(1).stores({
  records: 'id, collection, [collection+deleted], dirty',
  files: 'id, pendingUpload, pendingDelete',
  meta: 'key',
})

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value })
}

/** Bittet den Browser, die Daten nie automatisch zu löschen (wichtig für iOS). */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist()
    }
  } catch {
    // nicht unterstützt – kein Problem
  }
}
