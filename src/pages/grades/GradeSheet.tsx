import { confirmDialog } from '../../components/dialogs'
import { useState } from 'react'
import { Field, Sheet } from '../../components/ui'
import { toISODate } from '../../lib/dates'
import { GRADES, gradeOptions, type Grade, type GradeKind, type GradeSystem } from '../../lib/grades'
import { newId, put, remove, type Item } from '../../lib/repo'
import { useSettings } from '../../lib/settings'
import { SubjectSelect } from '../../components/SubjectSelect'

export interface GradeDefaults {
  subjectId?: string
  kind?: GradeKind
  type?: string
  date?: string
  examId?: string
}

/** Notenauswahl zum Antippen (1+ … 6 oder 15 … 0) */
export function GradePicker({
  value,
  system,
  onChange,
}: {
  value?: string
  system: GradeSystem
  onChange: (o: { label: string; value: number }) => void
}) {
  const settings = useSettings()
  const options = gradeOptions({ ...settings, gradeSystem: system })
  return (
    <div className={`grade-picker ${system}`}>
      {options.map((o) => (
        <button key={o.label} type="button" className={`grade-opt ${value === o.label ? 'active' : ''}`} onClick={() => onChange(o)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function GradeSheet({ grade, defaults, onClose }: { grade?: Item<Grade>; defaults?: GradeDefaults; onClose: () => void }) {
  const settings = useSettings()
  const [subjectId, setSubjectId] = useState(grade?.subjectId ?? defaults?.subjectId)
  const [kind, setKind] = useState<GradeKind>(grade?.kind ?? defaults?.kind ?? 'schriftlich')
  const [type, setType] = useState(grade?.type ?? defaults?.type ?? settings.examTypes[0])
  // Alte Noten behalten ihr System; neue werden im eingestellten System eingetragen
  const system: GradeSystem = grade?.system ?? settings.gradeSystem
  const [picked, setPicked] = useState<{ label: string; value: number } | undefined>(
    grade ? { label: grade.label, value: grade.value } : undefined,
  )
  const [date, setDate] = useState(grade?.date ?? defaults?.date ?? toISODate(new Date()))
  const [note, setNote] = useState(grade?.note ?? '')
  const canSave = Boolean(subjectId && picked && date)

  async function save() {
    if (!canSave) return
    await put<Grade>(GRADES, grade?.id ?? newId(), {
      subjectId: subjectId!,
      kind,
      type: kind === 'schriftlich' ? type : undefined,
      value: picked!.value,
      label: picked!.label,
      system,
      date,
      examId: grade?.examId ?? defaults?.examId,
      note: note.trim() || undefined,
      createdAt: grade?.createdAt ?? Date.now(),
    })
    onClose()
  }

  async function del() {
    if (grade && await confirmDialog('Note löschen?', { confirm: 'Löschen', danger: true })) {
      await remove(grade.id)
      onClose()
    }
  }

  return (
    <Sheet title={grade ? 'Note bearbeiten' : 'Neue Note'} onClose={onClose} onSave={save} saveLabel="Sichern" saveDisabled={!canSave}>
      <div className="list">
        <Field label="Fach">
          <SubjectSelect value={subjectId} onChange={setSubjectId} emptyLabel="Fach wählen …" />
        </Field>
        <div className="row stack">
          <span className="field-label">Art</span>
          <div className="chips">
            {settings.examTypes.map((t) => (
              <button
                key={t}
                type="button"
                className={`chip ${kind === 'schriftlich' && t === type ? 'active' : ''}`}
                onClick={() => {
                  setKind('schriftlich')
                  setType(t)
                }}
              >
                {t}
              </button>
            ))}
            <button type="button" className={`chip ${kind === 'muendlich' ? 'active' : ''}`} onClick={() => setKind('muendlich')}>
              Mündlich
            </button>
            <button type="button" className={`chip ${kind === 'besprechung' ? 'active' : ''}`} onClick={() => setKind('besprechung')}>
              Notenbesprechung
            </button>
          </div>
          <p className="section-footer" style={{ margin: '10px 0 0' }}>
            {kind === 'besprechung'
              ? 'Zwischenstand wie eine Zwischenzeugnisnote: ersetzt alle Noten davor in diesem Fach.'
              : kind === 'muendlich'
                ? 'Einzelne mündliche Note (Mitarbeit, Referat …).'
                : `${type} zählt ${settings.typeCategory?.[type] === 'muendlich' ? 'mündlich' : 'schriftlich'} – änderbar unter Einstellungen → Gewichtung.`}
          </p>
        </div>
      </div>

      <h3 className="section-title">{system === 'punkte' ? 'Punkte' : 'Note'}</h3>
      <div className="list">
        <div className="row stack">
          <GradePicker value={picked?.label} system={system} onChange={setPicked} />
        </div>
      </div>

      <div className="list" style={{ marginTop: 16 }}>
        <Field label="Datum">
          <input className="row-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Notiz">
          <input className="row-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
        </Field>
      </div>

      {grade && (
        <div className="list" style={{ marginTop: 24 }}>
          <button type="button" className="row danger" onClick={del}>
            Note löschen
          </button>
        </div>
      )}
    </Sheet>
  )
}
