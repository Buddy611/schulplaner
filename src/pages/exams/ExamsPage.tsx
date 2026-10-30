import { useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { Segmented } from '../../components/ui'
import { formatDate, isoWeek, parseISODate } from '../../lib/dates'
import { examCountdown, sortExams, studyProgress, useExams, weekKey, weekRange, type Exam } from '../../lib/exams'
import { daysUntil } from '../../lib/homework'
import { useGrades } from '../../lib/grades'
import { periodTitle, sortPeriods, useActiveTimetable, useLookups } from '../../lib/models'
import type { Item } from '../../lib/repo'
import { ExamSheet } from './ExamSheet'

type Tab = 'kommend' | 'vorbei'

export function ExamsPage() {
  const all = useExams()
  const [tab, setTab] = useState<Tab>('kommend')
  const [editing, setEditing] = useState<Item<Exam> | 'new' | null>(null)
  if (!all) return null

  const sorted = sortExams(all)
  const upcoming = sorted.filter((e) => daysUntil(e.date) >= 0)
  const past = sorted.filter((e) => daysUntil(e.date) < 0).reverse()
  const list = tab === 'kommend' ? upcoming : past

  // Nach Kalenderwoche gruppieren
  const groups = new Map<string, Item<Exam>[]>()
  for (const e of list) groups.set(weekKey(e.date), [...(groups.get(weekKey(e.date)) ?? []), e])

  return (
    <div className="page">
      <PageHeader title="Klausuren">
        <button type="button" className="icon-btn" aria-label="Klausur hinzufügen" onClick={() => setEditing('new')}>
          +
        </button>
      </PageHeader>
      <p className="subtitle">
        {upcoming.length === 0 ? 'Keine kommenden Klausuren' : `${upcoming.length} zukünftige Klausur${upcoming.length > 1 ? 'en' : ''}`}
      </p>

      <div className="toolbar">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'kommend', label: 'Kommend' },
            { value: 'vorbei', label: 'Vorbei' },
          ]}
        />
      </div>

      {list.length === 0 && (
        <p className="hint">{tab === 'kommend' ? 'Tippe auf +, um eine Klausur oder einen Test einzutragen.' : 'Noch keine vergangenen Klausuren.'}</p>
      )}

      {[...groups.entries()].map(([monday, items]) => (
        <div key={monday}>
          <h2 className="section-title">
            KW {isoWeek(parseISODate(monday))}: {weekRange(monday)}
          </h2>
          <div className="list">
            {items.map((e) => (
              <ExamRow key={e.id} exam={e} onOpen={() => setEditing(e)} />
            ))}
          </div>
        </div>
      ))}

      {editing && <ExamSheet exam={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

export function ExamRow({ exam, onOpen, compact }: { exam: Item<Exam>; onOpen: () => void; compact?: boolean }) {
  const { subjectMap, roomMap } = useLookups()
  const { timetable } = useActiveTimetable()
  const subject = subjectMap.get(exam.subjectId)
  const period = exam.periodId && timetable?.periods.find((p) => p.id === exam.periodId)
  const room = exam.roomId ? roomMap.get(exam.roomId) : undefined
  const { total, done } = studyProgress(exam)
  const days = daysUntil(exam.date)
  const grade = useGrades()?.find((g) => g.examId === exam.id)

  return (
    <button type="button" className="row exam-row" onClick={onOpen}>
      <span className="color-bar" style={{ background: subject?.color ?? 'var(--outline)' }} />
      <span className="label">
        <span className="exam-subject">{subject?.name ?? 'Fach gelöscht'}</span>
        <span className="sub">
          {exam.type}
          {exam.topic && ` · ${exam.topic}`}
        </span>
        <span className="sub">
          {formatDate(parseISODate(exam.date), { weekday: compact ? 'short' : 'long', day: 'numeric', month: 'long', year: compact ? undefined : 'numeric' })}
          {period && timetable && ` · ${periodTitle(sortPeriods(timetable.periods), period)}`}
        </span>
        {total > 0 && (
          <span className="study">
            <span className="progress">
              <span style={{ width: `${(done / total) * 100}%`, background: subject?.color }} />
            </span>
            {done}/{total} Themen gelernt
          </span>
        )}
      </span>
      <span className="exam-side">
        {room && <span className="value">{room.name}</span>}
        {days >= 0 && <span className={`countdown ${days <= 3 ? 'soon' : ''}`}>{examCountdown(exam.date)}</span>}
        {days < 0 && (grade ? <span className="grade-chip">{grade.label}</span> : <span className="countdown">Note fehlt</span>)}
      </span>
    </button>
  )
}
