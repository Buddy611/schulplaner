import { useState } from 'react'
import { AttachmentGrid } from '../../components/Attachments'
import { PageHeader } from '../../components/PageHeader'
import { formatDate, parseISODate } from '../../lib/dates'
import { useLookups } from '../../lib/models'
import { useNotes, type LessonNote } from '../../lib/notes'
import type { Item } from '../../lib/repo'
import { NoteSheet } from './NoteSheet'

/** Alle Notizen, nach Fach filterbar */
export function NotesPage() {
  const notes = useNotes()
  const { subjects, subjectMap } = useLookups()
  const [filter, setFilter] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Item<LessonNote> | 'new' | null>(null)
  if (!notes) return null

  const q = query.trim().toLowerCase()
  const list = notes
    .filter((n) => (!filter || n.subjectId === filter) && (!q || n.text.toLowerCase().includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  const usedSubjects = subjects.filter((s) => notes.some((n) => n.subjectId === s.id))

  return (
    <div className="page">
      <PageHeader title="Notizen" back={{ to: '/', label: 'Heute' }}>
        <button type="button" className="icon-btn" aria-label="Notiz hinzufügen" onClick={() => setEditing('new')}>
          +
        </button>
      </PageHeader>

      {usedSubjects.length > 0 && (
        <div className="chips scroll-chips">
          <button type="button" className={`chip ${!filter ? 'active' : ''}`} onClick={() => setFilter(null)}>
            Alle
          </button>
          {usedSubjects.map((s) => (
            <button key={s.id} type="button" className={`chip ${filter === s.id ? 'active' : ''}`} onClick={() => setFilter(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
      )}
      <input className="input search" type="search" placeholder="In Notizen suchen" value={query} onChange={(e) => setQuery(e.target.value)} />

      {list.length === 0 && (
        <p className="hint">{notes.length ? 'Nichts gefunden.' : 'Noch keine Notizen. In der Tagesansicht gibt es bei jeder Stunde „+ Notiz“.'}</p>
      )}

      <div className="note-list">
        {list.map((n) => {
          const s = subjectMap.get(n.subjectId)
          return (
            <div key={n.id} className="card note-card" style={{ borderLeft: `5px solid ${s?.color ?? 'var(--outline)'}` }}>
              <button type="button" className="note-body" onClick={() => setEditing(n)}>
                <span className="note-head">
                  <strong>{s?.name ?? 'Fach gelöscht'}</strong>
                  <span className="muted">{formatDate(parseISODate(n.date), { weekday: 'short', day: 'numeric', month: 'long' })}</span>
                </span>
                {n.text && <span className="note-text">{n.text}</span>}
              </button>
              {n.attachments?.length > 0 && <AttachmentGrid items={n.attachments} />}
            </div>
          )
        })}
      </div>

      {editing && <NoteSheet note={editing === 'new' ? undefined : editing} defaults={{ subjectId: filter ?? undefined }} onClose={() => setEditing(null)} />}
    </div>
  )
}
