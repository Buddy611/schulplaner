import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AttachmentGrid } from '../components/Attachments'
import { IconBubble } from '../components/Icons'
import { PageHeader } from '../components/PageHeader'
import { addFiles, removeFiles, type Attachment } from '../lib/files'
import { currentSubjectId } from '../lib/homework'
import { useSchedule } from '../lib/schedule'
import { HomeworkSheet } from './homework/HomeworkSheet'
import { NoteSheet } from './notes/NoteSheet'
import { t } from '../lib/i18n'

/** Übernimmt Dateien, die über "Teilen → Schulplaner" (Android) geschickt wurden */
async function takeSharedFiles(): Promise<{ files: File[]; text: string }> {
  if (!('caches' in window)) return { files: [], text: '' }
  const cache = await caches.open('share-target')
  const metaRes = await cache.match('shared-meta')
  if (!metaRes) return { files: [], text: '' }
  const meta = (await metaRes.json()) as { count: number; title: string; text: string; url: string }
  const files: File[] = []
  for (let i = 0; i < meta.count; i++) {
    const res = await cache.match(`shared-${i}`)
    if (!res) continue
    const blob = await res.blob()
    files.push(new File([blob], decodeURIComponent(res.headers.get('x-name') ?? t('Datei-{n}', { n: i + 1 })), { type: blob.type }))
  }
  await caches.delete('share-target')
  return { files, text: [meta.title, meta.text, meta.url].filter(Boolean).join('\n') }
}

export function SharePage() {
  const navigate = useNavigate()
  const schedule = useSchedule()
  const [attachments, setAttachments] = useState<Attachment[] | null>(null)
  const [text, setText] = useState('')
  const [target, setTarget] = useState<'hw' | 'note' | null>(null)

  useEffect(() => {
    void takeSharedFiles().then(async ({ files, text: tp }) => {
      setText(tp)
      setAttachments(files.length ? await addFiles(files) : [])
    })
  }, [])

  async function cancel() {
    if (attachments?.length) await removeFiles(attachments)
    navigate('/')
  }

  if (attachments === null) return null
  const subjectId = schedule.ready ? currentSubjectId(schedule) : undefined

  return (
    <div className="page">
      <PageHeader title={t('Geteilt')} back={{ to: '/', label: t('Heute') }} />
      {attachments.length === 0 && !text ? (
        <p className="hint">{t('Es wurde nichts geteilt. Teile ein Foto aus der Galerie über „Teilen → Schulplaner“.')}</p>
      ) : (
        <>
          {attachments.length > 0 && (
            <div className="card">
              <AttachmentGrid items={attachments} />
            </div>
          )}
          {text && <div className="card note-text">{text}</div>}

          <h2 className="section-title">{t('Speichern als …')}</h2>
          <div className="list">
            <button type="button" className="row with-icon" onClick={() => setTarget('hw')}>
              <IconBubble name="list" tone="green" />
              <span className="label">
                <span className="row-title">{t('Hausaufgabe')}</span>
                <span className="sub">{t('z. B. ein Arbeitsblatt')}</span>
              </span>
            </button>
            <button type="button" className="row with-icon" onClick={() => setTarget('note')}>
              <IconBubble name="note" tone="blue" />
              <span className="label">
                <span className="row-title">{t('Notiz')}</span>
                <span className="sub">{t('z. B. ein Tafelbild')}</span>
              </span>
            </button>
            <button type="button" className="row danger" onClick={cancel}>
              {t('Verwerfen')}
            </button>
          </div>
        </>
      )}

      {target === 'hw' && (
        <HomeworkSheet
          defaults={{ subjectId, attachments, title: text }}
          onClose={() => {
            setTarget(null)
            navigate('/hausaufgaben')
          }}
        />
      )}
      {target === 'note' && (
        <NoteSheet
          defaults={{ subjectId, attachments, text }}
          onClose={() => {
            setTarget(null)
            navigate('/notizen')
          }}
        />
      )}
    </div>
  )
}
