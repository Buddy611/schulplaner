import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { addFiles, formatSize, useFileUrl, type Attachment } from '../lib/files'

/**
 * Anhänge bearbeiten: Foto aufnehmen, Fotos auswählen, Dokumente hinzufügen.
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
      {value.length > 0 && <AttachmentGrid items={value} onRemove={onRemove} />}
      <div className="chips" style={{ marginTop: value.length ? 12 : 0 }}>
        <button type="button" className="chip" onClick={() => camera.current?.click()} disabled={busy}>
          + Kamera
        </button>
        <button type="button" className="chip" onClick={() => photos.current?.click()} disabled={busy}>
          + Fotos
        </button>
        <button type="button" className="chip" onClick={() => docs.current?.click()} disabled={busy}>
          + Dokument
        </button>
        {busy && <span className="muted" style={{ alignSelf: 'center', fontSize: '0.875rem' }}>Wird gespeichert …</span>}
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
    </div>
  )
}

/** Vorschau-Kacheln; Tippen öffnet die Datei */
export function AttachmentGrid({ items, onRemove }: { items: Attachment[]; onRemove?: (a: Attachment) => void }) {
  const [open, setOpen] = useState<Attachment | null>(null)
  return (
    <>
      <div className="att-grid">
        {items.map((a) => (
          <div key={a.id} className="att-item">
            <button type="button" className="att-thumb" onClick={() => setOpen(a)} aria-label={a.name}>
              {SAFE_IMAGES.includes(a.type) ? <Thumb id={a.id} /> : <span className="att-doc">{a.name.split('.').pop()?.toUpperCase()}</span>}
            </button>
            {onRemove && (
              <button type="button" className="att-remove" aria-label="Entfernen" onClick={() => onRemove(a)}>
                ×
              </button>
            )}
            <span className="att-name">{a.type.startsWith('image/') ? formatSize(a.size) : a.name}</span>
          </div>
        ))}
      </div>
      {open && <Viewer attachment={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function Thumb({ id }: { id: string }) {
  const { url, missing } = useFileUrl(id)
  if (missing) return <span className="att-doc">offline</span>
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

function Viewer({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  const { url, missing } = useFileUrl(attachment.id)
  const isImage = SAFE_IMAGES.includes(attachment.type)
  const isPdf = attachment.type === 'application/pdf'
  return createPortal(
    <div className="viewer" onClick={onClose}>
      <div className="viewer-bar" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="link-btn" onClick={onClose}>
          Schließen
        </button>
        <span className="viewer-name">{attachment.name}</span>
        {url && (
          <button type="button" className="link-btn" onClick={() => void saveOrShare(url, attachment)}>
            Teilen / Speichern
          </button>
        )}
      </div>
      <div className="viewer-body" onClick={(e) => e.stopPropagation()}>
        {missing && <p className="muted">Datei ist offline nicht verfügbar – sie wird geladen, sobald Internet da ist.</p>}
        {url && isImage && <img src={url} alt={attachment.name} />}
        {url && isPdf && <iframe src={url} title={attachment.name} />}
        {url && !isImage && !isPdf && (
          <div className="viewer-file">
            <span className="att-doc big">{attachment.name.split('.').pop()?.toUpperCase()}</span>
            <p>{attachment.name}</p>
            <button type="button" className="btn" style={{ width: 'auto' }} onClick={() => void saveOrShare(url, attachment)}>
              Mit anderer App öffnen
            </button>
            <p className="muted" style={{ fontSize: '0.8125rem' }}>
              Zur Sicherheit zeigt die App nur Fotos und PDFs selbst an.
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
