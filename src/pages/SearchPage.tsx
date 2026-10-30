import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconBubble, type IconName, type Tone } from '../components/Icons'
import { PageHeader } from '../components/PageHeader'
import { formatDate, parseISODate } from '../lib/dates'
import { useExams, type Exam } from '../lib/exams'
import { useGrades } from '../lib/grades'
import { useHomework, type Homework } from '../lib/homework'
import { useLookups } from '../lib/models'
import { useNotes, type LessonNote } from '../lib/notes'
import type { Item } from '../lib/repo'
import { useStudySheets, useVocabSets } from '../lib/study'
import { ExamSheet } from './exams/ExamSheet'
import { HomeworkSheet } from './homework/HomeworkSheet'
import { NoteSheet } from './notes/NoteSheet'

interface Hit {
  key: string
  icon: IconName
  tone: Tone
  title: string
  sub: string
  date?: string
  open: () => void
}

/** Eine Suche über Hausaufgaben (auch erledigte), Klausuren, Notizen, Lernzettel, Vokabeln, Noten und Fächer */
export function SearchPage() {
  const [query, setQuery] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const homework = useHomework()
  const exams = useExams()
  const notes = useNotes()
  const sheets = useStudySheets()
  const vocab = useVocabSets()
  const grades = useGrades()
  const { subjects, subjectMap, teacherMap } = useLookups()
  const [openHw, setOpenHw] = useState<Item<Homework> | null>(null)
  const [openExam, setOpenExam] = useState<Item<Exam> | null>(null)
  const [openNote, setOpenNote] = useState<Item<LessonNote> | null>(null)

  useEffect(() => input.current?.focus(), [])

  const q = query.trim().toLowerCase()
  const has = (...texts: (string | undefined)[]) => texts.some((t) => t?.toLowerCase().includes(q))
  const subjectName = (id?: string) => (id && subjectMap.get(id)?.name) || ''
  const fmt = (iso: string) => formatDate(parseISODate(iso), { day: 'numeric', month: 'short', year: 'numeric' })

  const hits: Hit[] = []
  if (q.length >= 2) {
    for (const s of subjects) {
      if (has(s.name, s.short, s.teacherId && teacherMap.get(s.teacherId)?.name))
        hits.push({ key: s.id, icon: 'book', tone: 'cyan', title: s.name, sub: 'Fach · Noten ansehen', open: () => navigate(`/noten/${s.id}`) })
    }
    for (const h of homework ?? []) {
      if (has(h.title, h.notes, subjectName(h.subjectId)))
        hits.push({ key: h.id, icon: 'list', tone: 'green', title: h.title, sub: `Hausaufgabe · ${subjectName(h.subjectId)}${h.done ? ' · erledigt' : ''}`, date: h.dueDate, open: () => setOpenHw(h) })
    }
    for (const e of exams ?? []) {
      if (has(e.topic, e.notes, e.type, subjectName(e.subjectId), ...(e.studyTopics ?? []).map((t) => t.text)))
        hits.push({ key: e.id, icon: 'exam', tone: 'red', title: `${subjectName(e.subjectId)} ${e.type}`, sub: e.topic ?? 'Klausur', date: e.date, open: () => setOpenExam(e) })
    }
    for (const n of notes ?? []) {
      if (has(n.text, subjectName(n.subjectId)))
        hits.push({ key: n.id, icon: 'note', tone: 'blue', title: n.text.split('\n')[0] || 'Notiz', sub: `Notiz · ${subjectName(n.subjectId)}`, date: n.date, open: () => setOpenNote(n) })
    }
    for (const s of sheets ?? []) {
      if (has(s.title, s.content, subjectName(s.subjectId)))
        hits.push({ key: s.id, icon: 'note', tone: 'purple', title: s.title, sub: `Lernzettel${s.subjectId ? ` · ${subjectName(s.subjectId)}` : ''}`, open: () => navigate(`/lernen/zettel/${s.id}`) })
    }
    for (const v of vocab ?? []) {
      const cards = v.cards.filter((c) => has(c.front, c.back))
      if (cards.length || has(v.name))
        hits.push({
          key: v.id,
          icon: 'translate',
          tone: 'indigo',
          title: cards[0] ? `${cards[0].front} – ${cards[0].back}` : v.name,
          sub: `Vokabeln · ${v.name}${cards.length > 1 ? ` · ${cards.length} Treffer` : ''}`,
          open: () => navigate(`/lernen/vokabeln/${v.id}`),
        })
    }
    for (const g of grades ?? []) {
      if (has(g.note, g.type) && g.note)
        hits.push({ key: g.id, icon: 'grade', tone: 'pink', title: `${subjectName(g.subjectId)}: ${g.label}`, sub: `Note · ${g.note}`, date: g.date, open: () => navigate(`/noten/${g.subjectId}`) })
    }
  }
  hits.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

  return (
    <div className="page">
      <PageHeader title="Suche" back={{ to: '/', label: 'Heute' }} />
      <input
        ref={input}
        className="input search"
        type="search"
        placeholder="Hausaufgaben, Klausuren, Notizen, Vokabeln …"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {q.length < 2 && <p className="hint">Mindestens zwei Buchstaben eingeben. Gesucht wird auch in erledigten Hausaufgaben und alten Klausuren.</p>}
      {q.length >= 2 && hits.length === 0 && <p className="hint">Nichts gefunden.</p>}
      {hits.length > 0 && (
        <div className="list">
          {hits.slice(0, 80).map((h) => (
            <button key={h.key} type="button" className="row with-icon" onClick={h.open}>
              <IconBubble name={h.icon} tone={h.tone} />
              <span className="label">
                <span className="row-title">{highlight(h.title, q)}</span>
                <span className="sub">
                  {h.sub}
                  {h.date && ` · ${fmt(h.date)}`}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      {openHw && <HomeworkSheet homework={openHw} onClose={() => setOpenHw(null)} />}
      {openExam && <ExamSheet exam={openExam} onClose={() => setOpenExam(null)} />}
      {openNote && <NoteSheet note={openNote} onClose={() => setOpenNote(null)} />}
    </div>
  )
}

/** Suchbegriff im Titel hervorheben */
function highlight(text: string, q: string): ReactNode {
  const i = text.toLowerCase().indexOf(q)
  if (i < 0 || !q) return text
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}
