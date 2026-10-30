import { confirmDialog } from '../../components/dialogs'
import { useState } from 'react'
import { AttachmentEditor } from '../../components/Attachments'
import { EntitySelect, Field, Sheet } from '../../components/ui'
import { addDays, formatDate, parseISODate, toISODate } from '../../lib/dates'
import { deleteExam, EXAMS, type Exam, type StudyTopic } from '../../lib/exams'
import { removeFiles, type Attachment } from '../../lib/files'
import { C, periodTitle, sortPeriods } from '../../lib/models'
import { newId, put, type Item } from '../../lib/repo'
import { useSchedule } from '../../lib/schedule'
import { useSettings } from '../../lib/settings'
import { quickCreate } from '../settings/MasterData'
import { daysUntil } from '../../lib/homework'
import { useGrades } from '../../lib/grades'
import { GradeSheet } from '../grades/GradeSheet'

export interface ExamDefaults {
  subjectId?: string
  date?: string
  periodId?: string
}

export function ExamSheet({ exam, defaults, onClose }: { exam?: Item<Exam>; defaults?: ExamDefaults; onClose: () => void }) {
  const schedule = useSchedule()
  const settings = useSettings()
  const { subjects, rooms } = schedule.lookups
  const [subjectId, setSubjectId] = useState(exam?.subjectId ?? defaults?.subjectId)
  const [type, setType] = useState(exam?.type ?? settings.examTypes[0] ?? 'Klausur')
  const [date, setDate] = useState(exam?.date ?? defaults?.date ?? toISODate(addDays(new Date(), 7)))
  const [periodId, setPeriodId] = useState<string | undefined>(exam?.periodId ?? defaults?.periodId)
  const [roomId, setRoomId] = useState(exam?.roomId)
  const [topic, setTopic] = useState(exam?.topic ?? '')
  const [notes, setNotes] = useState(exam?.notes ?? '')
  const [studyTopics, setStudyTopics] = useState<StudyTopic[]>(exam?.studyTopics ?? [])
  const [newTopic, setNewTopic] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>(exam?.attachments ?? [])
  const [removed, setRemoved] = useState<Attachment[]>([])

  const [gradeOpen, setGradeOpen] = useState(false)
  const grades = useGrades()
  const examGrade = exam ? grades?.find((g) => g.examId === exam.id) : undefined

  const periods = schedule.timetable ? sortPeriods(schedule.timetable.periods) : []
  const allThatDay = date ? schedule.lessonsOn(parseISODate(date)) : []
  const lessonsThatDay = subjectId ? allThatDay.filter((l) => l.subject.id === subjectId) : []
  // Alle Unterrichtsstunden des Tages zur Auswahl (auch wenn dort ein anderes Fach ist)
  const otherPeriods = periods.filter((p) => p.kind === 'lesson' && !lessonsThatDay.some((l) => l.period.id === p.id))
  const [timeMode, setTimeMode] = useState<'stunde' | 'zeit' | 'tag'>(exam?.startTime ? 'zeit' : (exam?.periodId ?? defaults?.periodId) ? 'stunde' : 'tag')
  const [startTime, setStartTime] = useState(exam?.startTime ?? '08:00')
  const [endTime, setEndTime] = useState(exam?.endTime ?? '09:30')
  const [pickingPeriod, setPickingPeriod] = useState(false)
  const types = settings.examTypes.includes(type) ? settings.examTypes : [...settings.examTypes, type]
  const canSave = Boolean(subjectId && date)

  // Fach oder Datum geändert: passende Stunde automatisch wählen (falls das Fach an dem Tag Unterricht hat)
  function pickLesson(nextSubject: string | undefined, nextDate: string) {
    const lessons = nextSubject && nextDate ? schedule.lessonsOn(parseISODate(nextDate)).filter((l) => l.subject.id === nextSubject) : []
    setPeriodId(lessons[0]?.period.id)
    if (lessons[0]) setTimeMode('stunde')
    else if (timeMode === 'stunde') setTimeMode('tag')
    if (!exam && lessons[0]?.room) setRoomId(lessons[0].room.id)
  }

  function addTopic() {
    const text = newTopic.trim()
    if (!text) return
    setStudyTopics([...studyTopics, { id: crypto.randomUUID(), text, done: false }])
    setNewTopic('')
  }

  async function save() {
    if (!canSave) return
    await put<Exam>(EXAMS, exam?.id ?? newId(), {
      subjectId: subjectId!,
      type,
      date,
      periodId: timeMode === 'stunde' ? periodId : undefined,
      startTime: timeMode === 'zeit' ? startTime : undefined,
      endTime: timeMode === 'zeit' ? endTime : undefined,
      roomId,
      topic: topic.trim() || undefined,
      notes: notes.trim() || undefined,
      studyTopics: newTopic.trim() ? [...studyTopics, { id: crypto.randomUUID(), text: newTopic.trim(), done: false }] : studyTopics,
      attachments,
      createdAt: exam?.createdAt ?? Date.now(),
    })
    if (removed.length) await removeFiles(removed)
    onClose()
  }

  async function cancel() {
    const original = new Set((exam?.attachments ?? []).map((a) => a.id))
    const added = attachments.filter((a) => !original.has(a.id))
    if (added.length) await removeFiles(added)
    onClose()
  }

  async function del() {
    if (exam && await confirmDialog(`${exam.type} löschen?`, { confirm: 'Löschen', danger: true })) {
      await deleteExam(exam)
      onClose()
    }
  }

  if (gradeOpen && exam) {
    return (
      <GradeSheet
        grade={examGrade}
        defaults={{ subjectId: exam.subjectId, kind: 'schriftlich', type: exam.type, date: exam.date, examId: exam.id }}
        onClose={() => setGradeOpen(false)}
      />
    )
  }

  return (
    <Sheet title={exam ? type : 'Neue Klausur'} onClose={cancel} onSave={save} saveLabel="Sichern" saveDisabled={!canSave}>
      <div className="list">
        <div className="row stack">
          <div className="chips">
            {types.map((t) => (
              <button key={t} type="button" className={`chip ${t === type ? 'active' : ''}`} onClick={() => setType(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <Field label="Fach">
          <EntitySelect
            title="Fach"
            value={subjectId}
            items={subjects}
            emptyLabel="Fach wählen …"
            onChange={(id) => {
              setSubjectId(id)
              pickLesson(id, date)
            }}
          />
        </Field>
        <Field label="Thema">
          <input className="row-input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="z. B. Lineare Funktionen" />
        </Field>
      </div>

      <h3 className="section-title">Wann</h3>
      <div className="list">
        <div className="row stack">
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              pickLesson(subjectId, e.target.value)
            }}
          />
          <div className="chips" style={{ marginTop: 10 }}>
            {lessonsThatDay.map((l) => (
              <button
                key={l.period.id + l.startSlot}
                type="button"
                className={`chip ${timeMode === 'stunde' && periodId === l.period.id ? 'active' : ''}`}
                onClick={() => {
                  setTimeMode('stunde')
                  setPeriodId(l.period.id)
                }}
              >
                {periodTitle(periods, l.period)} · {l.period.start}
              </button>
            ))}
            {otherPeriods.length > 0 && (
              <button
                type="button"
                className={`chip ${timeMode === 'stunde' && periodId && !lessonsThatDay.some((l) => l.period.id === periodId) ? 'active' : ''}`}
                onClick={() => setPickingPeriod(true)}
              >
                {timeMode === 'stunde' && periodId && !lessonsThatDay.some((l) => l.period.id === periodId)
                  ? `${periodTitle(periods, periods.find((p) => p.id === periodId)!)} · ${periods.find((p) => p.id === periodId)!.start}`
                  : lessonsThatDay.length
                    ? 'Andere Stunde …'
                    : 'Stunde wählen …'}
              </button>
            )}
            <button type="button" className={`chip ${timeMode === 'zeit' ? 'active' : ''}`} onClick={() => setTimeMode('zeit')}>
              Eigene Uhrzeit
            </button>
            <button
              type="button"
              className={`chip ${timeMode === 'tag' ? 'active' : ''}`}
              onClick={() => {
                setTimeMode('tag')
                setPeriodId(undefined)
              }}
            >
              Ganzer Tag
            </button>
          </div>
          {pickingPeriod && (
            <Sheet title="Stunde wählen" onClose={() => setPickingPeriod(false)}>
              <div className="list">
                {otherPeriods.map((p) => {
                  const l = allThatDay.find((x) => x.period.id === p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="row"
                      onClick={() => {
                        setTimeMode('stunde')
                        setPeriodId(p.id)
                        setPickingPeriod(false)
                      }}
                    >
                      <span className="label">
                        {periodTitle(periods, p)}
                        <span className="sub">
                          {p.start}–{p.end}
                          {l ? ` · sonst ${l.subject.name}` : ' · frei'}
                        </span>
                      </span>
                      {periodId === p.id && <span className="check">✓</span>}
                    </button>
                  )
                })}
              </div>
            </Sheet>
          )}
          {timeMode === 'zeit' && (
            <div className="time-range">
              <label>
                <span className="field-label">Beginn</span>
                <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </label>
              <label>
                <span className="field-label">Ende</span>
                <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </label>
            </div>
          )}
          {date && (
            <p className="section-footer" style={{ margin: '10px 0 0' }}>
              {formatDate(parseISODate(date), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
        <Field label="Raum">
          <EntitySelect title="Raum" value={roomId} items={rooms} onChange={setRoomId} onCreate={() => quickCreate(C.rooms)} createLabel="Neuer Raum …" />
        </Field>
      </div>

      {exam && daysUntil(exam.date) <= 0 && (
        <>
          <h3 className="section-title">Note</h3>
          <div className="list">
            <button type="button" className="row action" onClick={() => setGradeOpen(true)}>
              <span className="label">{examGrade ? `Note: ${examGrade.label}` : 'Note eintragen'}</span>
              {examGrade && <span className="value">bearbeiten</span>}
            </button>
          </div>
        </>
      )}

      <h3 className="section-title">Lernplan</h3>
      <div className="list">
        {studyTopics.map((t) => (
          <div key={t.id} className="row">
            <input
              type="checkbox"
              className="checkbox"
              checked={t.done}
              onChange={() => setStudyTopics(studyTopics.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}
            />
            <span className="label" style={t.done ? { textDecoration: 'line-through', color: 'var(--text-2)' } : undefined}>
              {t.text}
            </span>
            <button type="button" className="link-btn" aria-label="Thema entfernen" onClick={() => setStudyTopics(studyTopics.filter((x) => x.id !== t.id))}>
              ×
            </button>
          </div>
        ))}
        <div className="row">
          <input
            className="row-input"
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTopic()
              }
            }}
            placeholder="Thema zum Lernen hinzufügen …"
          />
          <button type="button" className="link-btn" onClick={addTopic} disabled={!newTopic.trim()}>
            Hinzufügen
          </button>
        </div>
      </div>
      <p className="section-footer">Hake Themen ab, die du gelernt hast. Erinnerungen ans Lernen kommen mit den Benachrichtigungen.</p>

      <h3 className="section-title">Notizen</h3>
      <div className="list">
        <div className="row stack">
          <textarea className="row-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
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

      {exam && (
        <div className="list" style={{ marginTop: 24 }}>
          <button type="button" className="row danger" onClick={del}>
            {exam.type} löschen
          </button>
        </div>
      )}
    </Sheet>
  )
}
