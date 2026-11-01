import { alertDialog } from '../../components/dialogs'
import { useState } from 'react'
import { Field, Sheet } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { t } from '../../lib/i18n'

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
      ? t('Mindestens {n} Zeichen.', { n: MIN_LENGTH })
      : repeat.length > 0 && next !== repeat
        ? t('Die beiden neuen Passwörter stimmen nicht überein.')
        : ''
  const canSave = current.length > 0 && next.length >= MIN_LENGTH && next === repeat && !busy

  async function save() {
    if (!navigator.onLine) {
      setError(t('Zum Ändern des Passworts wird Internet benötigt.'))
      return
    }
    setBusy(true)
    setError('')
    try {
      const check = await supabase.auth.signInWithPassword({ email, password: current })
      if (check.error) throw new Error(t('Das aktuelle Passwort ist falsch.'))
      const { error: updateError } = await supabase.auth.updateUser({ password: next })
      if (updateError) throw updateError
      await alertDialog(t('Dein neues Passwort gilt ab sofort.'), t('Passwort geändert'))
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={t('Passwort ändern')} onClose={onClose} onSave={save} saveLabel={busy ? t('Speichern …') : t('Speichern')} saveDisabled={!canSave}>
      <div className="list">
        <Field label={t('Aktuelles Passwort')}>
          <input className="row-input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
        </Field>
      </div>
      <div className="list" style={{ marginTop: 16 }}>
        <Field label={t('Neues Passwort')}>
          <input className="row-input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label={t('Neues Passwort wiederholen')}>
          <input className="row-input" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </Field>
      </div>
      {(problem || error) && <p className="error-text">{error || problem}</p>}
      <p className="section-footer">{t('Auf deinen anderen Geräten bleibst du angemeldet.')}</p>
    </Sheet>
  )
}
