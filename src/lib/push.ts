import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type PushSupport = 'ok' | 'needs-homescreen' | 'unsupported' | 'not-configured'

/** Kann dieses Gerät Push-Nachrichten empfangen? */
export function pushSupport(): PushSupport {
  if (!VAPID_PUBLIC_KEY) return 'not-configured'
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  // Auf iPhone/iPad gibt es Web-Push nur in der App vom Home-Bildschirm (ab iOS 16.4)
  if (ios && !standalone) return 'needs-homescreen'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  return 'ok'
}

function keyToBytes(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export async function currentSubscription() {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

/** Dieses Gerät für Erinnerungen anmelden (braucht Internet) */
export async function enablePush() {
  if (!navigator.onLine) throw new Error('Zum Aktivieren wird Internet benötigt.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Benachrichtigungen wurden nicht erlaubt. Du kannst das in den Geräte-Einstellungen ändern.')
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY!) }))
  const json = sub.toJSON()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ endpoint: sub.endpoint, p256dh: json.keys!.p256dh, auth: json.keys!.auth }, { onConflict: 'endpoint' })
  if (error) throw new Error(error.message)
}

/** Dieses Gerät abmelden */
export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

/** Testnachricht an alle angemeldeten Geräte dieses Kontos */
export async function sendTestPush() {
  const { data, error } = await supabase.functions.invoke<{ sent: number }>('send-reminders', { body: { test: true } })
  if (error) throw new Error(error.message)
  return data?.sent ?? 0
}
