import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { supabaseConfigured } from '../lib/supabase'

export function Login({ onDone }: { onDone?: () => void }) {
  const { signIn, user } = useAuth()
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!navigator.onLine) {
      setError('Für die erste Anmeldung wird Internet benötigt.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await signIn(email.trim(), password)
      onDone?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg.includes('Invalid login') ? 'E-Mail oder Passwort falsch.' : msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="login" onSubmit={submit}>
      <img src={`${import.meta.env.BASE_URL}pwa-192x192.png`} alt="" />
      <h1>Schulplaner</h1>
      {!supabaseConfigured && (
        <p className="error-text">Supabase ist noch nicht eingerichtet (VITE_SUPABASE_URL / VITE_SUPABASE_KEY fehlen).</p>
      )}
      <input
        className="input"
        type="email"
        autoComplete="username"
        placeholder="E-Mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        className="input"
        type="password"
        autoComplete="current-password"
        placeholder="Passwort"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && <p className="error-text">{error}</p>}
      <button className="btn" disabled={busy}>
        {busy ? 'Anmelden…' : 'Anmelden'}
      </button>
    </form>
  )
}
