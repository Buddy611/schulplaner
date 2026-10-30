import { confirmDialog, promptDialog } from '../../components/dialogs'
import { useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { Field, Sheet } from '../../components/ui'
import { byName, C, type Room, type Teacher } from '../../lib/models'
import { newId, put, remove, useCollection, type Item } from '../../lib/repo'

const BACK = { to: '/einstellungen', label: 'Einstellungen' }

/** Schnell anlegen per Eingabedialog (z. B. direkt aus einem Dropdown heraus) */
export async function quickCreate(collection: typeof C.teachers | typeof C.rooms): Promise<string | undefined> {
  const name = (await promptDialog(collection === C.teachers ? 'Neuer Lehrer' : 'Neuer Raum', { placeholder: collection === C.teachers ? 'z. B. Frau Meyer' : 'z. B. A204', confirm: 'Anlegen' }))?.trim()
  if (!name) return undefined
  const id = newId()
  await put(collection, id, { name })
  return id
}

export function TeachersPage() {
  const teachers = useCollection<Teacher>(C.teachers)
  const [editing, setEditing] = useState<Item<Teacher> | 'new' | null>(null)

  return (
    <div className="page">
      <PageHeader title="Lehrer" back={BACK}>
        <button type="button" className="icon-btn" aria-label="Lehrer hinzufügen" onClick={() => setEditing('new')}>
          +
        </button>
      </PageHeader>
      {teachers && teachers.length === 0 && <p className="hint">Noch keine Lehrer. Tippe auf +, um einen anzulegen.</p>}
      {teachers && teachers.length > 0 && (
        <div className="list">
          {[...teachers].sort(byName).map((t) => (
            <button key={t.id} type="button" className="row" onClick={() => setEditing(t)}>
              <span className="label">{t.name}</span>
              {t.short && <span className="value">{t.short}</span>}
            </button>
          ))}
        </div>
      )}
      {editing && <TeacherSheet teacher={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function TeacherSheet({ teacher, onClose }: { teacher?: Item<Teacher>; onClose: () => void }) {
  const [name, setName] = useState(teacher?.name ?? '')
  const [short, setShort] = useState(teacher?.short ?? '')

  async function save() {
    await put<Teacher>(C.teachers, teacher?.id ?? newId(), { name: name.trim(), short: short.trim() || undefined })
    onClose()
  }

  async function del() {
    if (teacher && await confirmDialog(`„${teacher.name}“ löschen?`, { confirm: 'Löschen', danger: true })) {
      await remove(teacher.id)
      onClose()
    }
  }

  return (
    <Sheet title={teacher ? 'Lehrer bearbeiten' : 'Neuer Lehrer'} onClose={onClose} onSave={save} saveDisabled={!name.trim()}>
      <div className="list">
        <Field label="Name">
          <input className="row-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Frau Meyer" autoFocus />
        </Field>
        <Field label="Kürzel">
          <input className="row-input" value={short} onChange={(e) => setShort(e.target.value)} placeholder="optional" />
        </Field>
      </div>
      {teacher && (
        <div className="list" style={{ marginTop: 24 }}>
          <button type="button" className="row danger" onClick={del}>
            Lehrer löschen
          </button>
        </div>
      )}
    </Sheet>
  )
}

export function RoomsPage() {
  const rooms = useCollection<Room>(C.rooms)
  const [editing, setEditing] = useState<Item<Room> | 'new' | null>(null)

  return (
    <div className="page">
      <PageHeader title="Räume" back={BACK}>
        <button type="button" className="icon-btn" aria-label="Raum hinzufügen" onClick={() => setEditing('new')}>
          +
        </button>
      </PageHeader>
      {rooms && rooms.length === 0 && <p className="hint">Noch keine Räume. Tippe auf +, um einen anzulegen.</p>}
      {rooms && rooms.length > 0 && (
        <div className="list">
          {[...rooms].sort(byName).map((r) => (
            <button key={r.id} type="button" className="row" onClick={() => setEditing(r)}>
              <span className="label">{r.name}</span>
            </button>
          ))}
        </div>
      )}
      {editing && <RoomSheet room={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function RoomSheet({ room, onClose }: { room?: Item<Room>; onClose: () => void }) {
  const [name, setName] = useState(room?.name ?? '')

  async function save() {
    await put<Room>(C.rooms, room?.id ?? newId(), { name: name.trim() })
    onClose()
  }

  async function del() {
    if (room && await confirmDialog(`Raum „${room.name}“ löschen?`, { confirm: 'Löschen', danger: true })) {
      await remove(room.id)
      onClose()
    }
  }

  return (
    <Sheet title={room ? 'Raum bearbeiten' : 'Neuer Raum'} onClose={onClose} onSave={save} saveDisabled={!name.trim()}>
      <div className="list">
        <Field label="Name">
          <input className="row-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. A204" autoFocus />
        </Field>
      </div>
      {room && (
        <div className="list" style={{ marginTop: 24 }}>
          <button type="button" className="row danger" onClick={del}>
            Raum löschen
          </button>
        </div>
      )}
    </Sheet>
  )
}
