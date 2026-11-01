import { useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AttachmentEditor, AttachmentGrid } from '../../components/Attachments'
import { confirmDialog } from '../../components/dialogs'
import { PageHeader } from '../../components/PageHeader'
import { Field, Select } from '../../components/ui'
import { formatDate, parseISODate } from '../../lib/dates'
import { upcomingExams, useExams } from '../../lib/exams'
import { removeFiles } from '../../lib/files'
import { useLookups } from '../../lib/models'
import { put, remove, useRecord } from '../../lib/repo'
import { STUDY_SHEETS, type StudySheet } from '../../lib/study'
import { SubjectSelect } from '../../components/SubjectSelect'
import { t } from '../../lib/i18n'

/** Lernzettel ansehen und bearbeiten */
export function StudySheetPage() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const sheet = useRecord<StudySheet>(id)
  const navigate = useNavigate()
  const editing = params.get('bearbeiten') === '1'

  if (sheet === undefined) return null
  if (sheet === null) {
    return (
      <div className="page">
        <PageHeader title={t('Lernzettel')} back={{ to: '/lernen?tab=zettel', label: t('Lernen') }} />
        <p className="hint">Diesen Lernzettel gibt es nicht mehr.</p>
      </div>
    )
  }

  const save = (changes: Partial<StudySheet>) => {
    const { id: sheetId, ...data } = sheet
    return put<StudySheet>(STUDY_SHEETS, sheetId, { ...data, ...changes, updatedAt: Date.now() })
  }

  async function del() {
    if (await confirmDialog(t('„{name}“ löschen?', { name: sheet!.title }), { confirm: t('Löschen'), danger: true })) {
      await removeFiles(sheet!.attachments ?? [])
      await remove(sheet!.id)
      navigate('/lernen?tab=zettel')
    }
  }

  return (
    <div className="page">
      <PageHeader title={editing ? t('Bearbeiten') : sheet.title} back={{ to: '/lernen?tab=zettel', label: t('Lernen') }}>
        <button type="button" className="link-btn strong" onClick={() => setParams(editing ? {} : { bearbeiten: '1' }, { replace: true })}>
          {editing ? t('Fertig') : t('Bearbeiten')}
        </button>
      </PageHeader>
      {editing ? <SheetEditor sheet={sheet} save={save} onDelete={del} /> : <SheetView sheet={sheet} onToggle={(content) => save({ content })} />}
    </div>
  )
}

function SheetView({ sheet, onToggle }: { sheet: StudySheet; onToggle: (content: string) => void }) {
  const { subjectMap } = useLookups()
  const exams = useExams()
  const subject = sheet.subjectId ? subjectMap.get(sheet.subjectId) : undefined
  const exam = sheet.examId ? exams?.find((e) => e.id === sheet.examId) : undefined
  return (
    <>
      {(subject || exam) && (
        <p className="subtitle">
          {[subject?.name, exam && t('{type} am {date}', { type: t(exam.type), date: formatDate(parseISODate(exam.date), { day: 'numeric', month: 'long' }) })].filter(Boolean).join(' · ')}
        </p>
      )}
      <div className="card study-sheet" style={subject ? { borderTop: `5px solid ${subject.color}` } : undefined}>
        {sheet.content.trim() ? <RichText text={sheet.content} onToggle={onToggle} /> : <p className="muted">{t('Noch leer – tippe oben auf „Bearbeiten“.')}</p>}
      </div>
      {sheet.attachments?.length > 0 && (
        <div className="card">
          <AttachmentGrid items={sheet.attachments} />
        </div>
      )}
    </>
  )
}

function SheetEditor({ sheet, save, onDelete }: { sheet: StudySheet; save: (c: Partial<StudySheet>) => Promise<void>; onDelete: () => void }) {
  const { subjects } = useLookups()
  const exams = upcomingExams(useExams())
  const [title, setTitle] = useState(sheet.title)
  const [content, setContent] = useState(sheet.content)
  const area = useRef<HTMLTextAreaElement>(null)

  // Text wird beim Verlassen eines Feldes gespeichert (und beim Formatieren)
  const commit = (changes: Partial<StudySheet>) => void save(changes)

  /** Formatierung am Zeilenanfang einfügen bzw. Auswahl fett machen */
  function format(kind: 'h' | 'list' | 'todo' | 'bold') {
    const el = area.current
    if (!el) return
    const { selectionStart: s, selectionEnd: e } = el
    let next = content
    if (kind === 'bold') {
      const sel = content.slice(s, e) || t('fett')
      next = content.slice(0, s) + `**${sel}**` + content.slice(e)
    } else {
      const lineStart = content.lastIndexOf('\n', s - 1) + 1
      const prefix = kind === 'h' ? '# ' : kind === 'list' ? '- ' : '- [ ] '
      next = content.slice(0, lineStart) + prefix + content.slice(lineStart)
    }
    setContent(next)
    commit({ content: next })
    requestAnimationFrame(() => el.focus())
  }

  return (
    <>
      <div className="list">
        <Field label={t('Titel')}>
          <input className="row-input" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && commit({ title: title.trim() })} />
        </Field>
        <Field label={t('Fach')}>
          <SubjectSelect value={sheet.subjectId} onChange={(subjectId) => commit({ subjectId })} emptyLabel={t('Kein Fach')} />
        </Field>
        <Field label={t('Für Klausur')}>
          <Select
            title={t('Klausur')}
            value={sheet.examId ?? ''}
            options={[{ value: '', label: t('Keine') }, ...exams.map((e) => ({ value: e.id, label: `${subjects.find((s) => s.id === e.subjectId)?.name ?? ''} ${t(e.type)} · ${formatDate(parseISODate(e.date), { day: 'numeric', month: 'short' })}` }))]}
            onChange={(v) => commit({ examId: v || undefined })}
          />
        </Field>
      </div>

      <div className="format-bar">
        <button type="button" className="chip" onClick={() => format('h')}>
          {t('Überschrift')}
        </button>
        <button type="button" className="chip" onClick={() => format('list')}>
          • {t('Liste')}
        </button>
        <button type="button" className="chip" onClick={() => format('todo')}>
          ☐ {t('Aufgabe')}
        </button>
        <button type="button" className="chip" onClick={() => format('bold')}>
          <strong>{t('Fett')}</strong>
        </button>
      </div>
      <div className="list">
        <div className="row stack">
          <textarea
            ref={area}
            className="row-input sheet-text"
            rows={14}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={() => commit({ content })}
            placeholder={t('# Thema\n- wichtiger Punkt\n- **Merke:** …\n- [ ] Aufgabe zum Üben')}
          />
        </div>
      </div>

      <h3 className="section-title">{t('Fotos & Dokumente')}</h3>
      <div className="list">
        <div className="row stack">
          <AttachmentEditor
            value={sheet.attachments ?? []}
            onChange={(attachments) => commit({ attachments })}
            onRemove={async (a) => {
              await removeFiles([a])
              commit({ attachments: (sheet.attachments ?? []).filter((x) => x.id !== a.id) })
            }}
          />
        </div>
      </div>

      <div className="list" style={{ marginTop: 24 }}>
        <button type="button" className="row danger" onClick={onDelete}>
          {t('Lernzettel löschen')}
        </button>
      </div>
    </>
  )
}

/** Sehr einfache Formatierung: # Überschrift, - Liste, - [ ] Aufgabe (antippbar), **fett** */
function RichText({ text, onToggle }: { text: string; onToggle: (content: string) => void }) {
  const lines = text.split('\n')
  const bold = (s: string): ReactNode[] => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part))
  return (
    <div className="rich">
      {lines.map((line, i) => {
        const todo = line.match(/^\s*- \[( |x)\] (.*)$/i)
        if (todo) {
          const done = todo[1].toLowerCase() === 'x'
          return (
            <label key={i} className="rich-todo">
              <input
                type="checkbox"
                className="checkbox"
                checked={done}
                onChange={() => {
                  const next = [...lines]
                  next[i] = line.replace(/\[( |x)\]/i, done ? '[ ]' : '[x]')
                  onToggle(next.join('\n'))
                }}
              />
              <span style={done ? { textDecoration: 'line-through', color: 'var(--text-2)' } : undefined}>{bold(todo[2])}</span>
            </label>
          )
        }
        if (/^### /.test(line)) return <h4 key={i}>{bold(line.slice(4))}</h4>
        if (/^## /.test(line)) return <h3 key={i}>{bold(line.slice(3))}</h3>
        if (/^# /.test(line)) return <h2 key={i}>{bold(line.slice(2))}</h2>
        if (/^\s*[-*] /.test(line)) return <p key={i} className="rich-li">{bold(line.replace(/^\s*[-*] /, ''))}</p>
        if (!line.trim()) return <div key={i} className="rich-gap" />
        return <p key={i}>{bold(line)}</p>
      })}
    </div>
  )
}
