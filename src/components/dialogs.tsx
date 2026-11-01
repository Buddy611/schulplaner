import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../lib/i18n'

/**
 * Eigene Dialoge im Material-3-Stil statt der Browser-Fenster (confirm/prompt/alert).
 * Aufruf überall per await, z. B. `if (await confirmDialog('Löschen?')) …`
 */

type Dialog =
  | { kind: 'confirm'; title?: string; message: string; confirm: string; cancel: string; danger: boolean; resolve: (v: boolean) => void }
  | { kind: 'prompt'; title: string; message?: string; initial: string; placeholder?: string; confirm: string; resolve: (v: string | null) => void }
  | { kind: 'alert'; title?: string; message: string; resolve: () => void }

let queue: Dialog[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function push(d: Dialog) {
  queue = [...queue, d]
  emit()
}

function pop() {
  queue = queue.slice(1)
  emit()
}

export function confirmDialog(
  message: string,
  opts: { title?: string; confirm?: string; cancel?: string; danger?: boolean } = {},
): Promise<boolean> {
  return new Promise((resolve) =>
    push({
      kind: 'confirm',
      message,
      title: opts.title,
      confirm: opts.confirm ?? 'OK',
      cancel: opts.cancel ?? t('Abbrechen'),
      danger: opts.danger ?? false,
      resolve,
    }),
  )
}

export function promptDialog(
  title: string,
  opts: { message?: string; initial?: string; placeholder?: string; confirm?: string } = {},
): Promise<string | null> {
  return new Promise((resolve) =>
    push({ kind: 'prompt', title, message: opts.message, initial: opts.initial ?? '', placeholder: opts.placeholder, confirm: opts.confirm ?? t('Fertig'), resolve }),
  )
}

export function alertDialog(message: string, title?: string): Promise<void> {
  return new Promise((resolve) => push({ kind: 'alert', message, title, resolve }))
}

/** Einmal in der App einbinden – zeigt den jeweils nächsten Dialog */
export function DialogHost() {
  const current = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => queue[0],
  )
  if (!current) return null
  return createPortal(<DialogView key={queue.length + current.kind} dialog={current} />, document.body)
}

function DialogView({ dialog }: { dialog: Dialog }) {
  const [text, setText] = useState(dialog.kind === 'prompt' ? dialog.initial : '')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (dialog.kind === 'prompt') setTimeout(() => input.current?.focus(), 50)
  }, [dialog.kind])

  function close(result: 'ok' | 'cancel') {
    pop()
    if (dialog.kind === 'confirm') dialog.resolve(result === 'ok')
    else if (dialog.kind === 'prompt') dialog.resolve(result === 'ok' ? text.trim() || null : null)
    else dialog.resolve()
  }

  return (
    <div className="dialog-backdrop" onClick={() => close('cancel')}>
      <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {'title' in dialog && dialog.title && <h2>{dialog.title}</h2>}
        {dialog.message && <p>{dialog.message}</p>}
        {dialog.kind === 'prompt' && (
          <input
            ref={input}
            className="input"
            value={text}
            placeholder={dialog.placeholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && close('ok')}
          />
        )}
        <div className="dialog-actions">
          {dialog.kind !== 'alert' && (
            <button type="button" className="link-btn" onClick={() => close('cancel')}>
              {dialog.kind === 'confirm' ? dialog.cancel : t('Abbrechen')}
            </button>
          )}
          <button
            type="button"
            className={`link-btn strong ${dialog.kind === 'confirm' && dialog.danger ? 'danger' : ''}`}
            disabled={dialog.kind === 'prompt' && !text.trim()}
            onClick={() => close('ok')}
          >
            {dialog.kind === 'alert' ? 'OK' : dialog.confirm}
          </button>
        </div>
      </div>
    </div>
  )
}
