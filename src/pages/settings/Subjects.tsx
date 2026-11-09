import { confirmDialog } from '../../components/dialogs'
import { useState } from 'react'
import { db } from '../../lib/db'
import { PageHeader } from '../../components/PageHeader'
import { ColorDot, ColorPicker, EntitySelect, Field, Segmented, Sheet, Switch } from '../../components/ui'
import { C, STANDARD_SUBJECTS, SUBJECT_COLORS, subjectCategory, useLookups, type Lesson, type Subject, type SubjectCategory } from '../../lib/models'
import { newId, put, remove, type Item } from '../../lib/repo'
import { quickCreate } from './MasterData'
import { t } from '../../lib/i18n'

/** Nächste noch nicht benutzte Farbe aus der Palette */
export function nextSubjectColor(used: string[]) {
  return SUBJECT_COLORS.find((c) => !used.includes(c)) ?? SUBJECT_COLORS[used.length % SUBJECT_COLORS.length]
}

export function SubjectsPage() {
  const { subjects, teacherMap, roomMap } = useLookups()
  const [editing, setEditing] = useState<Item<Subject> | 'new' | null>(null)
  const [picking, setPicking] = useState(false)

  return (
    <div className="page">
      <PageHeader title={t('Fächer')} back={{ to: '/einstellungen', label: t('Einstellungen') }}>
        <button type="button" className="icon-btn" aria-label={t('Fach hinzufügen')} onClick={() => setEditing('new')}>
          +
        </button>
      </PageHeader>
      {subjects.length === 0 && <p className="hint">{t('Noch keine Fächer. Tippe auf +, um eins anzulegen, oder wähle unten Standardfächer aus.')}</p>}
      <button type="button" className="btn secondary" style={{ marginBottom: 16 }} onClick={() => setPicking(true)}>
        {t('Standardfächer hinzufügen')}
      </button>
      {subjects.length > 0 && (
        <div className="list">
          {subjects.map((s) => {
            const details = [s.general ? t('Ohne Noten') : subjectCategory(s) === 'haupt' ? t('Hauptfach') : t('Nebenfach'), s.teacherId && teacherMap.get(s.teacherId)?.name, s.roomId && roomMap.get(s.roomId)?.name]
              .filter(Boolean)
              .join(' · ')
            return (
              <button key={s.id} type="button" className="row" onClick={() => setEditing(s)}>
                <ColorDot color={s.color} size={14} />
                <span className="label">
                  {s.name}
                  {details && <span className="sub">{details}</span>}
                </span>
                <span className="value">{s.short}</span>
              </button>
            )
          })}
        </div>
      )}
      {editing && (
        <SubjectSheet
          subject={editing === 'new' ? undefined : editing}
          defaultColor={nextSubjectColor(subjects.map((s) => s.color))}
          onClose={() => setEditing(null)}
        />
      )}
      {subjects.length > 0 && (
        <div className="list" style={{ marginTop: 24 }}>
          <button
            type="button"
            className="row danger"
            onClick={async () => {
              const ok = await confirmDialog(
                t('Alle {n} Fächer entfernen? Sie verschwinden auch aus dem Stundenplan. Hausaufgaben, Klausuren und Noten bleiben gespeichert, stehen dann aber ohne Fach da.', { n: subjects.length }),
                { title: t('Fächer zurücksetzen?'), confirm: t('Alle entfernen'), danger: true },
              )
              if (!ok) return
              const ids = new Set(subjects.map((s) => s.id))
              const lessons = await db.records.where({ collection: C.lessons, deleted: 0 }).toArray()
              for (const l of lessons) if (ids.has((l.data as Lesson).subjectId)) await remove(l.id)
              for (const s of subjects) await remove(s.id)
            }}
          >
            {t('Alle Fächer entfernen')}
          </button>
        </div>
      )}
      {picking && <StandardSubjectsSheet existing={subjects.map((s) => s.name.toLowerCase())} onClose={() => setPicking(false)} />}
    </div>
  )
}

/** Auswahl typischer Fächer zum Anhaken – Farben und Kürzel sind vorbelegt und später änderbar */
function StandardSubjectsSheet({ existing, onClose }: { existing: string[]; onClose: () => void }) {
  const available = STANDARD_SUBJECTS.filter((s) => !existing.includes(s.name.toLowerCase()))
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function toggle(name: string) {
    const next = new Set(selected)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    setSelected(next)
  }

  async function save() {
    for (const s of available) if (selected.has(s.name)) await put<Subject>(C.subjects, newId(), { ...s })
    onClose()
  }

  return (
    <Sheet title={t('Standardfächer')} onClose={onClose} onSave={save} saveLabel={t('Hinzufügen ({n})', { n: selected.size })} saveDisabled={selected.size === 0}>
      {available.length === 0 ? (
        <p className="hint">{t('Alle Standardfächer sind schon angelegt.')}</p>
      ) : (
        <>
          <p className="section-footer" style={{ marginBottom: 12 }}>
            {t('Hake deine Fächer an. Haupt-/Nebenfach, Farbe, Kürzel, Lehrer und Raum kannst du danach beim Fach ändern.')}
          </p>
          <div className="list">
            {available.map((s) => (
              <label key={s.name} className="row" style={{ cursor: 'pointer' }}>
                <ColorDot color={s.color} size={14} />
                <span className="label">
                  {s.name}
                  <span className="sub">{s.general ? t('Ohne Noten') : s.category === 'haupt' ? t('Hauptfach') : t('Nebenfach')}</span>
                </span>
                <span className="value">{s.short}</span>
                <input type="checkbox" className="checkbox" checked={selected.has(s.name)} onChange={() => toggle(s.name)} />
              </label>
            ))}
          </div>
        </>
      )}
    </Sheet>
  )
}

export function SubjectSheet({
  subject,
  defaultColor,
  onClose,
  onSaved,
}: {
  subject?: Item<Subject>
  defaultColor: string
  onClose: () => void
  onSaved?: (id: string, data: Subject) => void
}) {
  const { teachers, rooms } = useLookups()
  const [name, setName] = useState(subject?.name ?? '')
  const [short, setShort] = useState(subject?.short ?? '')
  const [color, setColor] = useState(subject?.color ?? defaultColor)
  const [category, setCategory] = useState<SubjectCategory>(subject ? subjectCategory(subject) : 'neben')
  const [general, setGeneral] = useState(Boolean(subject?.general))
  const [teacherId, setTeacherId] = useState(subject?.teacherId)
  const [roomId, setRoomId] = useState(subject?.roomId)
  const [materials, setMaterials] = useState<string[]>(subject?.materials ?? [])
  const [newMaterial, setNewMaterial] = useState('')

  function addMaterial() {
    const m = newMaterial.trim()
    if (m && !materials.includes(m)) setMaterials([...materials, m])
    setNewMaterial('')
  }

  async function save() {
    const id = subject?.id ?? newId()
    const data: Subject = {
      name: name.trim(),
      short: short.trim() || name.trim().slice(0, 3),
      color,
      teacherId,
      roomId,
      writtenWeight: subject?.writtenWeight,
      category,
      general: general || undefined,
      goal: subject?.goal,
      materials: newMaterial.trim() && !materials.includes(newMaterial.trim()) ? [...materials, newMaterial.trim()] : materials,
    }
    await put<Subject>(C.subjects, id, data)
    onSaved?.(id, data)
    onClose()
  }

  async function del() {
    if (!subject) return
    const lessons = (await db.records.where({ collection: C.lessons, deleted: 0 }).toArray()).filter(
      (r) => (r.data as Lesson).subjectId === subject.id,
    )
    const msg =
      lessons.length > 0
        ? t('„{name}“ löschen? Es wird auch aus {n} Stunde(n) im Stundenplan entfernt.', { name: subject.name, n: lessons.length })
        : t('„{name}“ löschen?', { name: subject.name })
    if (!(await confirmDialog(msg, { confirm: t('Löschen'), danger: true }))) return
    for (const l of lessons) await remove(l.id)
    await remove(subject.id)
    onClose()
  }

  return (
    <Sheet title={subject ? t('Fach bearbeiten') : t('Neues Fach')} onClose={onClose} onSave={save} saveDisabled={!name.trim()}>
      <div className="list">
        <Field label={t('Name')}>
          <input className="row-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('z. B. Mathematik')} />
        </Field>
        <Field label={t('Kürzel')}>
          <input className="row-input" value={short} onChange={(e) => setShort(e.target.value)} placeholder={name.trim().slice(0, 3) || 'z. B. Ma'} maxLength={6} />
        </Field>
      </div>

      <h3 className="section-title">{t('Art')}</h3>
      <div className="list">
        <div className="row stack">
          <Segmented<SubjectCategory>
            value={category}
            onChange={setCategory}
            options={[
              { value: 'haupt', label: t('Hauptfach') },
              { value: 'neben', label: t('Nebenfach') },
            ]}
          />
        </div>
      </div>
      <p className="section-footer">{t('Haupt- und Nebenfächer können schriftlich/mündlich unterschiedlich zählen (Einstellungen → Noten).')}</p>

      <div className="list">
        <div className="row">
          <span className="label">
            {t('Fach ohne Noten')}
            <span className="sub">{t('Z. B. „Sonstiges“ für Hausaufgaben ohne Fach oder Vertretungsstunden – erscheint nicht bei den Noten')}</span>
          </span>
          <Switch checked={general} onChange={setGeneral} />
        </div>
      </div>

      <h3 className="section-title">{t('Farbe')}</h3>
      <div className="list">
        <div className="row stack">
          <ColorPicker value={color} colors={SUBJECT_COLORS} onChange={setColor} />
        </div>
      </div>

      <h3 className="section-title">{t('Standard für den Stundenplan')}</h3>
      <div className="list">
        <Field label={t('Lehrer')}>
          <EntitySelect title={t('Lehrer')} value={teacherId} items={teachers} onChange={setTeacherId} onCreate={() => quickCreate(C.teachers)} createLabel={t('Neuer Lehrer …')} />
        </Field>
        <Field label={t('Raum')}>
          <EntitySelect title={t('Raum')} value={roomId} items={rooms} onChange={setRoomId} onCreate={() => quickCreate(C.rooms)} createLabel={t('Neuer Raum …')} />
        </Field>
      </div>
      <p className="section-footer">{t('Wird beim Eintragen vorgeschlagen. Hat das Fach an manchen Tagen einen anderen Raum oder Lehrer, tippe im Stundenplan-Editor auf die Stunde und wähle ihn dort.')}</p>

      <h3 className="section-title">{t('Material für die Packliste')}</h3>
      <div className="list">
        <div className="row stack">
          {materials.length > 0 && (
            <div className="chips" style={{ marginBottom: 12 }}>
              {materials.map((m) => (
                <button key={m} type="button" className="chip removable" onClick={() => setMaterials(materials.filter((x) => x !== m))}>
                  {m} ×
                </button>
              ))}
            </div>
          )}
          <div className="inline-add">
            <input
              className="input"
              value={newMaterial}
              onChange={(e) => setNewMaterial(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addMaterial()
                }
              }}
              placeholder={t('z. B. Buch, Atlas, Sportzeug')}
            />
            <button type="button" className="icon-btn" aria-label={t('Material hinzufügen')} onClick={addMaterial} disabled={!newMaterial.trim()}>
              +
            </button>
          </div>
        </div>
      </div>
      <p className="section-footer">{t('Erscheint auf „Heute“ in der Packliste für den nächsten Schultag.')}</p>

      {subject && (
        <div className="list" style={{ marginTop: 24 }}>
          <button type="button" className="row danger" onClick={del}>
            {t('Fach löschen')}
          </button>
        </div>
      )}
    </Sheet>
  )
}
