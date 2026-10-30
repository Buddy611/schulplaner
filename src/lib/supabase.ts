import { createClient } from '@supabase/supabase-js'

// Beide Werte sind öffentlich (publishable Key) und durch Row Level Security abgesichert.
// Sie kommen aus .env.local (lokal) bzw. aus den GitHub-Repository-Variablen (Build).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined

export const supabaseConfigured = Boolean(url && key)

export const supabase = createClient(url ?? 'https://invalid.supabase.co', key ?? 'missing', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'schulplaner-auth',
  },
})

export const ATTACHMENT_BUCKET = 'attachments'
