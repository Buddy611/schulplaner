import { alertDialog } from '../../components/dialogs'
import { useState } from 'react'
import { Field, Sheet } from '../../components/ui'
import { supabase } from '../../lib/supabase'

const MIN_LENGTH = 8

/** Passwort ändern: altes Passwort wird zur Sicherheit erst geprüft */
export function PasswordSheet({ email, onClose }: { email: string; onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const problem =
    next.length > 0 && next.length < MIN_LENGTH
      ? `Mindestens ${MIN_LENGTH} Zeichen.`
      : repeat.length > 0 && next !== repeat
        ? 'Die beiden neuen Passwörter stimmen nicht überein.'
        : ''
  const canSave = current.length > 0 && next.length >= MIN_LENGTH && next === repeat && !busy

  async function save() {
    if (!navigator.onLine) {
      setError('Zum Ändern des Passworts wird Internet benötigt.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const check = await supabase.auth.signInWithPassword({ email, password: current })
      if (check.error) throw new Error('Das aktuelle Passwort ist falsch.')
      const { error: updateError } = await supabase.auth.updateUser({ password: next })
      if (updateError) throw updateError
      await alertDialog('Dein neues Passwort gilt ab sofort.', 'Passwort geändert')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="Passwort ändern" onClose={onClose} onSave={save} saveLabel={busy ? 'Speichern …' : 'Speichern'} saveDisabled={!canSave}>
      <div className="list">
        <Field label="Aktuelles Passwort">
          <input className="row-input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
        </Field>
      </div>
      <div className="list" style={{ marginTop: 16 }}>
        <Field label="Neues Passwort">
          <input className="row-input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Neues Passwort wiederholen">
          <input className="row-input" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </Field>
      </div>
      {(problem || error) && <p className="error-text">{error || problem}</p>}
      <p className="section-footer">Auf deinen anderen Geräten bleibst du angemeldet.</p>
    </Sheet>
  )
}
