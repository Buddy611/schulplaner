import { confirmDialog } from '../../components/dialogs'
import { useMemo, useState } from 'react'
import { AttachmentEditor } from '../../components/Attachments'
import { Field, Sheet, Switch } from '../../components/ui'
import { formatDate, parseISODate, toISODate } from '../../lib/dates'
import { removeFiles, type Attachment } from '../../lib/files'
import { deleteHomework, HOMEWORK, nextLessonsOfSubject, type Homework } from '../../lib/homework'
import { periodTitle, sortPeriods } from '../../lib/models'
import { newId, put, type Item } from '../../lib/repo'
import { useSchedule } from '../../lib/schedule'
import { SubjectSelect } from '../../components/SubjectSelect'
import { t } from '../../lib/i18n'

type DueMode = 'next' | 'next2' | 'date'

export interface HomeworkDefaults {
  subjectId?: string
  /** z. B. aus der Tagesansicht: fällig genau in dieser Stunde */
  dueDate?: string
  duePeriodId?: string
  /** z. B. aus „Teilen“: schon angehängte Dateien und Text */
  attachments?: Attachment[]
  title?: string
}

export function HomeworkSheet({
  homework,
  defaults,
  onClose,
}: {
  homework?: Item<Homework>
  defaults?: HomeworkDefaults
  onClose: () => void
}) {
  const schedule = useSchedule()
  const [subjectId, setSubjectId] = useState(homework?.subjectId ?? defaults?.subjectId)
  const [title, setTitle] = useState(homework?.title ?? defaults?.title ?? '')
  const [notes, setNotes] = useState(homework?.notes ?? '')
  const [repeatWeekly, setRepeatWeekly] = useState(homework?.repeatWeekly ?? false)
  const [attachments, setAttachments] = useState<Attachment[]>(homework?.attachments ?? defaults?.attachments ?? [])
  const [removed, setRemoved] = useState<Attachment[]>([])
  const [mode, setMode] = useState<DueMode>(homework || defaults?.dueDate ? 'date' : 'next')
  const [date, setDate] = useState(homework?.dueDate ?? defaults?.dueDate ?? toISODate(new Date()))
  const [datePeriodId, setDatePeriodId] = useState(homework?.duePeriodId ?? defaults?.duePeriodId)

  // Nächste und übernächste Stunde dieses Fachs laut Stundenplan
  const now = useMemo(() => new Date(), [])
  const upcoming = subjectId && schedule.ready ? nextLessonsOfSubject(schedule, subjectId, now, 2) : []
  const periods = schedule.timetable ? sortPeriods(schedule.timetable.periods) : []

  const chosen =
    mode === 'next' && upcoming[0]
      ? { dueDate: upcoming[0].date, duePeriodId: upcoming[0].period.id }
      : mode === 'next2' && upcoming[1]
        ? { dueDate: upcoming[1].date, duePeriodId: upcoming[1].period.id }
        : { dueDate: date, duePeriodId: datePeriodId }

  const canSave = Boolean(subjectId && title.trim() && chosen.dueDate)

  function short(d: string) {
    return formatDate(parseISODate(d), { weekday: 'short', day: 'numeric', month: 'numeric' })
  }

  async function save() {
    if (!canSave) return
    await put<Homework>(HOMEWORK, homework?.id ?? newId(), {
      subjectId: subjectId!,
      title: title.trim(),
      notes: notes.trim() || undefined,
      dueDate: chosen.dueDate,
      duePeriodId: chosen.duePeriodId,
      done: homework?.done ?? false,
      doneAt: homework?.doneAt,
      attachments,
      createdAt: homework?.createdAt ?? Date.now(),
      repeatWeekly: repeatWeekly || undefined,
      nextId: homework?.nextId,
    })
    if (removed.length) await removeFiles(removed)
    onClose()
  }

  async function cancel() {
    // Neu hinzugefügte, aber nicht gespeicherte Dateien wieder wegräumen
    const original = new Set((homework?.attachments ?? []).map((a) => a.id))
    const added = attachments.filter((a) => !original.has(a.id))
    if (added.length) await removeFiles(added)
    onClose()
  }

  async function del() {
    if (homework && await confirmDialog(t('Hausaufgabe löschen?'), { confirm: t('Löschen'), danger: true })) {
      await deleteHomework(homework)
      onClose()
    }
  }

  // Stunden des Fachs am gewählten Datum (für "genaues Datum")
  const lessonsThatDay = subjectId && mode === 'date' ? schedule.lessonsOn(parseISODate(date)).filter((l) => l.subject.id === subjectId) : []

  return (
    <Sheet title={homework ? t('Hausaufgabe') : t('Neue Hausaufgabe')} onClose={cancel} onSave={save} saveLabel={t('Sichern')} saveDisabled={!canSave}>
      <div className="list">
        <Field label={t('Fach')}>
          <SubjectSelect value={subjectId} onChange={setSubjectId} emptyLabel={t('Fach wählen …')} />
        </Field>
        <Field label={t('Aufgabe')}>
          <textarea className="row-input" rows={2} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('z. B. S. 42 Nr. 3a–c')} autoFocus={!homework} />
        </Field>
      </div>

      <h3 className="section-title">{t('Fällig')}</h3>
      <div className="list">
        <div className="row stack">
          <div className="chips">
            <button type="button" className={`chip ${mode === 'next' ? 'active' : ''}`} disabled={!upcoming[0]} onClick={() => setMode('next')}>
              {t('Nächste Stunde')}{upcoming[0] && ` · ${short(upcoming[0].date)}`}
            </button>
            <button type="button" className={`chip ${mode === 'next2' ? 'active' : ''}`} disabled={!upcoming[1]} onClick={() => setMode('next2')}>
              {t('Übernächste')}{upcoming[1] && ` · ${short(upcoming[1].date)}`}
            </button>
            <button type="button" className={`chip ${mode === 'date' ? 'active' : ''}`} onClick={() => setMode('date')}>
              {t('Datum')}
            </button>
          </div>
          {mode === 'date' && (
            <div style={{ marginTop: 12 }}>
              <input
                className="input"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value)
                  setDatePeriodId(undefined)
                }}
              />
              {lessonsThatDay.length > 0 && (
                <div className="chips" style={{ marginTop: 10 }}>
                  {lessonsThatDay.map((l) => (
                    <button
                      key={l.period.id + l.startSlot}
                      type="button"
                      className={`chip ${datePeriodId === l.period.id ? 'active' : ''}`}
                      onClick={() => setDatePeriodId(datePeriodId === l.period.id ? undefined : l.period.id)}
                    >
                      {periodTitle(periods, l.period)} · {l.period.start}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {subjectId && !upcoming[0] && mode !== 'date' && (
            <p className="section-footer" style={{ margin: '10px 0 0' }}>
              {t('Dieses Fach steht nicht im Stundenplan – bitte ein Datum wählen.')}
            </p>
          )}
          {mode !== 'date' && upcoming[0] && (
            <p className="section-footer" style={{ margin: '10px 0 0' }}>
              {formatDate(parseISODate(chosen.dueDate), { weekday: 'long', day: 'numeric', month: 'long' })}
              {chosen.duePeriodId && `, ${periodTitle(periods, periods.find((p) => p.id === chosen.duePeriodId)!)}`}
            </p>
          )}
        </div>
      </div>

      <h3 className="section-title">{t('Notizen')}</h3>
      <div className="list">
        <div className="row stack">
          <textarea className="row-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('optional')} />
        </div>
      </div>

      <div className="list" style={{ marginTop: 16 }}>
        <div className="row">
          <span className="label">
            {t('Jede Woche wiederholen')}
            <span className="sub">{t('Beim Abhaken kommt automatisch die nächste für eine Woche später')}</span>
          </span>
          <Switch checked={repeatWeekly} onChange={setRepeatWeekly} />
        </div>
      </div>

      <h3 className="section-title">{t('Fotos & Dokumente')}</h3>
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

      {homework && (
        <div className="list" style={{ marginTop: 24 }}>
          <button type="button" className="row danger" onClick={del}>
            {t('Hausaufgabe löschen')}
          </button>
        </div>
      )}
    </Sheet>
  )
}
