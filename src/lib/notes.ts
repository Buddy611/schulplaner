import type { Attachment } from './files'
import { removeFiles } from './files'
import { remove, useCollection, type Item } from './repo'

/** Notiz zu einer bestimmten Stunde (z. B. Tafelbild, was besprochen wurde) */
export const NOTES = 'lessonNotes'

export interface LessonNote {
  subjectId: string
  date: string
  periodId?: string
  text: string
  attachments: Attachment[]
  createdAt: number
}

export function useNotes() {
  return useCollection<LessonNote>(NOTES)
}

export async function deleteNote(n: Item<LessonNote>) {
  await removeFiles(n.attachments ?? [])
  await remove(n.id)
}
