import { useLiveQuery } from 'dexie-react-hooks'
import { db, type LocalRecord } from './db'
import { scheduleSync } from './sync'

export function newId() {
  return crypto.randomUUID()
}

/** Speichert einen Datensatz lokal und merkt ihn für den Upload vor. */
export async function put<T>(collection: string, id: string, data: T) {
  await db.records.put({ id, collection, data, updatedAt: Date.now(), deleted: 0, dirty: 1 })
  scheduleSync()
}

/** Ändert einzelne Felder eines bestehenden Datensatzes. */
export async function patch<T extends object>(collection: string, id: string, changes: Partial<T>) {
  const existing = await db.records.get(id)
  await put<T>(collection, id, { ...(existing?.data as T), ...changes })
}

/** Löscht einen Datensatz (als Markierung, damit die Löschung synchronisiert wird). */
export async function remove(id: string) {
  await db.records.update(id, { deleted: 1, dirty: 1, updatedAt: Date.now() })
  scheduleSync()
}

export type Item<T> = T & { id: string }

function toItem<T>(r: LocalRecord): Item<T> {
  return { ...(r.data as T), id: r.id }
}

/** Liefert alle (nicht gelöschten) Einträge einer Sammlung und aktualisiert sich live. */
export function useCollection<T>(collection: string): Item<T>[] | undefined {
  return useLiveQuery(
    async () => (await db.records.where({ collection, deleted: 0 }).toArray()).map((r) => toItem<T>(r)),
    [collection],
  )
}

/** Liefert einen einzelnen Eintrag und aktualisiert sich live. */
export function useRecord<T>(id: string | undefined): Item<T> | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null
    const r = await db.records.get(id)
    return r && !r.deleted ? toItem<T>(r) : null
  }, [id])
}
