import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { addFiles, formatSize, useFileUrl, type Attachment } from '../lib/files'
import { t } from '../lib/i18n'
import { emptyDoc, imagePage, inkFile, isInk, parseInk, pdfPages, renderPage, type InkDoc } from '../lib/ink'
import { getFileBlob } from '../lib/sync'
import { alertDialog } from './dialogs'
import { InkEditor } from './InkEditor'

/**
 * Anhänge bearbeiten: Foto aufnehmen, Fotos auswählen, Dokumente hinzufügen, mit dem Stift schreiben.
 * Neue Dateien werden sofort lokal gespeichert; entfernte erst beim Speichern
 * des Eintrags gelöscht (onRemove liefert sie an den Aufrufer).
 */
export function AttachmentEditor({
  value,
  onChange,
  onRemove,
}: {
  value: Attachment[]
  onChange: (next: Attachment[]) => void
  onRemove: (a: Attachment) => void
}) {
  const camera = useRef<HTMLInputElement>(null)
  const photos = useRef<HTMLInputElement>(null)
  const docs = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [writing, setWriting] = useState(false)

  // Handschrift speichern: als neue Datei anhängen bzw. die bearbeitete ersetzen
  const addInk = async (doc: InkDoc) => {
    const [att] = await addFiles([inkFile(doc)])
    return att
  }

  async function handle(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    try {
      onChange([...value, ...(await addFiles(files))])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {value.length > 0 && (
        <AttachmentGrid
          items={value}
          onRemove={onRemove}
          onAdd={(att) => onChange([...value, att])}
          onReplace={(old, next) => onChange(value.map((a) => (a.id === old.id ? next : a)))}
        />
      )}
      <div className="chips" style={{ marginTop: value.length ? 12 : 0 }}>
        <button type="button" className="chip" onClick={() => camera.current?.click()} disabled={busy}>
          + {t('Kamera')}
        </button>
        <button type="button" className="chip" onClick={() => photos.current?.click()} disabled={busy}>
          + {t('Fotos')}
        </button>
        <button type="button" className="chip" onClick={() => docs.current?.click()} disabled={busy}>
          + {t('Dokument')}
        </button>
        <button type="button" className="chip" onClick={() => setWriting(true)} disabled={busy}>
          + {t('Handschrift')}
        </button>
        {busy && <span className="muted" style={{ alignSelf: 'center', fontSize: '0.875rem' }}>{t('Wird gespeichert …')}</span>}
      </div>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (void handle(e.target.files), (e.target.value = ''))} />
      <input ref={photos} type="file" accept="image/*" multiple hidden onChange={(e) => (void handle(e.target.files), (e.target.value = ''))} />
      <input
        ref={docs}
        type="file"
        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.odt,application/pdf"
        multiple
        hidden
        onChange={(e) => (void handle(e.target.files), (e.target.value = ''))}
      />
      {writing && (
        <InkEditor
          initial={emptyDoc()}
          onSave={async (doc) => onChange([...value, await addInk(doc)])}
          onClose={() => setWriting(false)}
        />
      )}
    </div>
  )
}

/**
 * Vorschau-Kacheln; Tippen öffnet die Datei. Handschriften öffnen sich im Stift-Editor.
 * Mit onAdd/onReplace (nur beim Bearbeiten) kann man Fotos/PDFs beschriften und Handschriften ändern.
 */
export function AttachmentGrid({
  items,
  onRemove,
  onAdd,
  onReplace,
}: {
  items: Attachment[]
  onRemove?: (a: Attachment) => void
  onAdd?: (a: Attachment) => void
  onReplace?: (old: Attachment, next: Attachment) => void
}) {
  const [open, setOpen] = useState<Attachment | null>(null)
  const [ink, setInk] = useState<{ doc: InkDoc; source: Attachment; replace: boolean } | null>(null)
  const [loading, setLoading] = useState(false)

  async function openInk(a: Attachment) {
    const blob = await getFileBlob(a.id)
    if (!blob) return void alertDialog(t('Datei ist offline nicht verfügbar – sie wird geladen, sobald Internet da ist.'))
    setInk({ doc: await parseInk(blob), source: a, replace: true })
  }

  /** Foto oder PDF als Hintergrund – das Original bleibt, die Beschriftung kommt als neuer Anhang dazu */
  async function annotate(a: Attachment) {
    setOpen(null)
    setLoading(true)
    try {
      const blob = await getFileBlob(a.id)
      if (!blob) throw new Error(t('Datei ist offline nicht verfügbar – sie wird geladen, sobald Internet da ist.'))
      const pages = a.type === 'application/pdf' ? await pdfPages(blob) : [await imagePage(blob)]
      setInk({ doc: { v: 1, pages }, source: a, replace: false })
    } catch (e) {
      await alertDialog(e instanceof Error ? e.message : String(e), t('Beschriften nicht möglich'))
    } finally {
      setLoading(false)
    }
  }

  const editable = Boolean(onAdd || onReplace)

  return (
    <>
      <div className="att-grid">
        {items.map((a) => (
          <div key={a.id} className="att-item">
            <button type="button" className="att-thumb" onClick={() => (isInk(a) ? void openInk(a) : setOpen(a))} aria-label={a.name}>
              {isInk(a) ? (
                <InkThumb id={a.id} />
              ) : SAFE_IMAGES.includes(a.type) ? (
                <Thumb id={a.id} />
              ) : (
                <span className="att-doc">{a.name.split('.').pop()?.toUpperCase()}</span>
              )}
            </button>
            {onRemove && (
              <button type="button" className="att-remove" aria-label={t('Entfernen')} onClick={() => onRemove(a)}>
                ×
              </button>
            )}
            <span className="att-name">{isInk(a) ? t('Handschrift') : a.type.startsWith('image/') ? formatSize(a.size) : a.name}</span>
          </div>
        ))}
      </div>
      {loading && <p className="muted" style={{ fontSize: '0.875rem' }}>{t('Wird vorbereitet …')}</p>}
      {open && <Viewer attachment={open} onClose={() => setOpen(null)} onAnnotate={onAdd ? () => void annotate(open) : undefined} />}
      {ink && (
        <InkEditor
          initial={ink.doc}
          readOnly={!editable}
          onSave={
            editable
              ? async (doc) => {
                  const [att] = await addFiles([inkFile(doc)])
                  if (ink.replace && onReplace) onReplace(ink.source, att)
                  else onAdd?.(att)
                }
              : undefined
          }
          onClose={() => setInk(null)}
        />
      )}
    </>
  )
}

/** Kleine Vorschau der ersten Seite einer Handschrift */
function InkThumb({ id }: { id: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    let cancelled = false
    void getFileBlob(id).then(async (blob) => {
      if (cancelled) return
      if (!blob) return setMissing(true)
      const doc = await parseInk(blob).catch(() => null)
      const c = canvas.current
      const page = doc?.pages[0]
      if (!c || !page || cancelled) return
      const s = c.width / 1000
      c.height = Math.round(page.h * s)
      await renderPage(c.getContext('2d')!, page, s)
    })
    return () => {
      cancelled = true
    }
  }, [id])
  if (missing) return <span className="att-doc">{t('offline')}</span>
  return <canvas ref={canvas} className="ink-thumb" width={160} height={226} />
}

function Thumb({ id }: { id: string }) {
  const { url, missing } = useFileUrl(id)
  if (missing) return <span className="att-doc">{t('offline')}</span>
  return url ? <img src={url} alt="" /> : <span className="att-doc">…</span>
}

/** Nur diese Typen zeigt die App selbst an – alles andere (z. B. HTML, SVG) wird nur gespeichert/geteilt */
const SAFE_IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']

/**
 * Datei sicher weitergeben: als neutraler Download (nie im App-Kontext ausgeführt).
 * Auf dem Handy über das Teilen-Menü (z. B. "In Word öffnen", "In Dateien sichern").
 */
async function saveOrShare(url: string, attachment: Attachment) {
  const blob = await (await fetch(url)).blob()
  const file = new File([blob], attachment.name, { type: SAFE_IMAGES.includes(attachment.type) || attachment.type === 'application/pdf' ? attachment.type : 'application/octet-stream' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: attachment.name })
      return
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
    }
  }
  const neutral = URL.createObjectURL(new Blob([blob], { type: 'application/octet-stream' }))
  const a = document.createElement('a')
  a.href = neutral
  a.download = attachment.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(neutral), 2000)
}

function Viewer({ attachment, onClose, onAnnotate }: { attachment: Attachment; onClose: () => void; onAnnotate?: () => void }) {
  const { url, missing } = useFileUrl(attachment.id)
  const isImage = SAFE_IMAGES.includes(attachment.type)
  const isPdf = attachment.type === 'application/pdf'
  return createPortal(
    <div className="viewer" onClick={onClose}>
      <div className="viewer-bar" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="link-btn" onClick={onClose}>
          {t('Schließen')}
        </button>
        <span className="viewer-name">{attachment.name}</span>
        <span className="viewer-actions">
          {url && onAnnotate && (isImage || isPdf) && (
            <button type="button" className="link-btn strong" onClick={onAnnotate}>
              {t('Beschriften')}
            </button>
          )}
          {url && (
            <button type="button" className="link-btn" onClick={() => void saveOrShare(url, attachment)}>
              {t('Teilen / Speichern')}
            </button>
          )}
        </span>
      </div>
      <div className="viewer-body" onClick={(e) => e.stopPropagation()}>
        {missing && <p className="muted">{t('Datei ist offline nicht verfügbar – sie wird geladen, sobald Internet da ist.')}</p>}
        {url && isImage && <img src={url} alt={attachment.name} />}
        {url && isPdf && <iframe src={url} title={attachment.name} />}
        {url && !isImage && !isPdf && (
          <div className="viewer-file">
            <span className="att-doc big">{attachment.name.split('.').pop()?.toUpperCase()}</span>
            <p>{attachment.name}</p>
            <button type="button" className="btn" style={{ width: 'auto' }} onClick={() => void saveOrShare(url, attachment)}>
              {t('Mit anderer App öffnen')}
            </button>
            <p className="muted" style={{ fontSize: '0.8125rem' }}>
              {t('Zur Sicherheit zeigt die App nur Fotos und PDFs selbst an.')}
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
