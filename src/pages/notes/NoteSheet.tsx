import { useState } from 'react'
import { AttachmentEditor } from '../../components/Attachments'
import { confirmDialog } from '../../components/dialogs'
import { EntitySelect, Field, Sheet } from '../../components/ui'
import { formatDate, parseISODate, toISODate } from '../../lib/dates'
import { removeFiles, type Attachment } from '../../lib/files'
import { useLookups } from '../../lib/models'
import { deleteNote, NOTES, type LessonNote } from '../../lib/notes'
import { newId, put, type Item } from '../../lib/repo'

export interface NoteDefaults {
  subjectId?: string
  date?: string
  periodId?: string
}

/** Notiz zu einer Stunde: Text und Fotos/Dokumente */
export function NoteSheet({ note, defaults, onClose }: { note?: Item<LessonNote>; defaults?: NoteDefaults; onClose: () => void }) {
  const { subjects } = useLookups()
  const [subjectId, setSubjectId] = useState(note?.subjectId ?? defaults?.subjectId)
  const [date, setDate] = useState(note?.date ?? defaults?.date ?? toISODate(new Date()))
  const [text, setText] = useState(note?.text ?? '')
  const [attachments, setAttachments] = useState<Attachment[]>(note?.attachments ?? [])
  const [removed, setRemoved] = useState<Attachment[]>([])
  const canSave = Boolean(subjectId && (text.trim() || attachments.length))

  async function save() {
    if (!canSave) return
    await put<LessonNote>(NOTES, note?.id ?? newId(), {
      subjectId: subjectId!,
      date,
      periodId: note?.periodId ?? defaults?.periodId,
      text: text.trim(),
      attachments,
      createdAt: note?.createdAt ?? Date.now(),
    })
    if (removed.length) await removeFiles(removed)
    onClose()
  }

  async function cancel() {
    const original = new Set((note?.attachments ?? []).map((a) => a.id))
    const added = attachments.filter((a) => !original.has(a.id))
    if (added.length) await removeFiles(added)
    onClose()
  }

  async function del() {
    if (note && (await confirmDialog('Notiz löschen?', { confirm: 'Löschen', danger: true }))) {
      await deleteNote(note)
      onClose()
    }
  }

  return (
    <Sheet title={note ? 'Notiz' : 'Neue Notiz'} onClose={cancel} onSave={save} saveLabel="Sichern" saveDisabled={!canSave}>
      <div className="list">
        <Field label="Fach">
          <EntitySelect title="Fach" value={subjectId} items={subjects} onChange={setSubjectId} emptyLabel="Fach wählen …" />
        </Field>
        <Field label="Datum">
          <input className="row-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <p className="section-footer">{formatDate(parseISODate(date), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>

      <h3 className="section-title">Notiz</h3>
      <div className="list">
        <div className="row stack">
          <textarea className="row-input" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Was wurde besprochen? Was ist wichtig?" autoFocus={!note} />
        </div>
      </div>

      <h3 className="section-title">Fotos & Dokumente</h3>
      <div className="list">
        <div className="row stack">
          <AttachmentEditor
            value={attachments}
            onChange={setAttachments}
            onRemove={(a) => {
              setAttachments(attachments.filter((x) => x.id !== a.id))
              setRemoved([...removed, a])
            }}
          />
        </div>
      </div>

      {note && (
        <div className="list" style={{ marginTop: 24 }}>
          <button type="button" className="row danger" onClick={del}>
            Notiz löschen
          </button>
        </div>
      )}
    </Sheet>
  )
}
