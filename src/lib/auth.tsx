import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { db } from './db'
import { supabase } from './supabase'
import { syncNow } from './sync'

/**
 * Login, der auch offline erhalten bleibt:
 * Nach der ersten Anmeldung merkt sich das Gerät den Nutzer dauerhaft. Die App
 * bleibt damit auch ohne Internet (und mit abgelaufenem Token) voll benutzbar.
 * Nur der Abgleich braucht eine gültige Supabase-Sitzung; die erneuert sich
 * automatisch, sobald wieder Internet da ist. Abgemeldet wird nur über den Button.
 */

interface LocalUser {
  id: string
  email: string
}

interface AuthContextValue {
  user: LocalUser | null
  /** false = Gerät kennt den Nutzer, aber die Supabase-Sitzung ist weg (erneut anmelden zum Synchronisieren) */
  sessionValid: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const USER_KEY = 'schulplaner-user'
const AuthContext = createContext<AuthContextValue | null>(null)

function loadUser(): LocalUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as LocalUser) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(loadUser)
  const [sessionValid, setSessionValid] = useState(true)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      // Offline ohne gespeicherte Sitzung ist kein Problem – nur online zählt das als "abgelaufen".
      setSessionValid(Boolean(data.session) || !navigator.onLine)
    })
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) setSessionValid(true)
      else if (event === 'SIGNED_OUT') setSessionValid(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const next = { id: data.user.id, email: data.user.email ?? email }
    // Anderes Konto als zuvor auf diesem Gerät? Dann alte lokale Daten entfernen.
    if (user && user.id !== next.id) await clearLocalData()
    localStorage.setItem(USER_KEY, JSON.stringify(next))
    setUser(next)
    setSessionValid(true)
    void syncNow()
  }

  async function signOut() {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
    await clearLocalData()
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, sessionValid, signIn, signOut }}>{children}</AuthContext.Provider>
}

async function clearLocalData() {
  await db.transaction('rw', db.records, db.files, db.meta, async () => {
    await db.records.clear()
    await db.files.clear()
    await db.meta.clear()
  })
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth außerhalb von AuthProvider')
  return ctx
}
