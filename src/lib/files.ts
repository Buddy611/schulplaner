import { useEffect, useState } from 'react'
import { db } from './db'
import { getFileBlob, scheduleSync } from './sync'

/** Verweis auf eine Datei (Foto/Dokument) in einem Eintrag */
export interface Attachment {
  id: string
  name: string
  type: string
  size: number
}

const MAX_SIDE = 1800
const JPEG_QUALITY = 0.8

/**
 * Fotos werden vor dem Speichern verkleinert (max. 1800 px, JPEG) –
 * gut lesbar, aber nur ca. 200–400 KB statt mehrerer MB.
 */
async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', JPEG_QUALITY))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

/** Speichert ausgewählte Dateien lokal und merkt sie zum Hochladen vor */
export async function addFiles(files: FileList | File[]): Promise<Attachment[]> {
  const result: Attachment[] = []
  for (const file of Array.from(files)) {
    const blob = await compressImage(file)
    const compressed = blob !== file
    const att: Attachment = {
      id: crypto.randomUUID(),
      name: compressed ? file.name.replace(/\.\w+$/, '') + '.jpg' : file.name,
      type: compressed ? 'image/jpeg' : file.type || 'application/octet-stream',
      size: blob.size,
    }
    await db.files.put({ ...att, blob, pendingUpload: 1, pendingDelete: 0, createdAt: Date.now() })
    result.push(att)
  }
  scheduleSync()
  return result
}

/** Entfernt Dateien (lokal sofort, auf dem Server beim nächsten Abgleich) */
export async function removeFiles(attachments: Attachment[]) {
  for (const a of attachments) {
    const existing = await db.files.get(a.id)
    await db.files.put({
      id: a.id,
      name: a.name,
      type: a.type,
      size: a.size,
      createdAt: existing?.createdAt ?? Date.now(),
      pendingUpload: 0,
      pendingDelete: 1,
    })
  }
  scheduleSync()
}

/** Objekt-URL für eine Datei (lokal oder bei Bedarf vom Server geladen) */
export function useFileUrl(id: string | undefined) {
  const [state, setState] = useState<{ url?: string; missing?: boolean }>({})
  useEffect(() => {
    if (!id) return
    let url: string | undefined
    let cancelled = false
    void getFileBlob(id).then((blob) => {
      if (cancelled) return
      if (!blob) return setState({ missing: true })
      url = URL.createObjectURL(blob)
      setState({ url })
    })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [id])
  return state
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
