// Supabase Edge Function: verschickt Erinnerungen als Web-Push-Nachricht.
// Wird alle 15 Minuten per pg_cron aufgerufen (siehe supabase/push.sql).
// Geheimnisse (VAPID-Schlüssel, CRON_SECRET) kommen aus den Supabase-Secrets, nie aus dem Code.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:noreply@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotifySettings {
  enabled?: boolean
  time?: string
  homework?: boolean
  examDays?: number[]
  excuses?: boolean
}

interface Sub {
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

/** Aktuelles Datum und Uhrzeit in Deutschland */
function berlinNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

function toMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

async function send(subs: Sub[], payload: { title: string; body: string; url?: string }) {
  let sent = 0
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload))
      sent++
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      // Abgemeldetes Gerät: Anmeldung entfernen
      if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
    }
  }
  return sent
}

// Texte der Erinnerungen auf Deutsch und Englisch (Sprache aus den Einstellungen der App)
const TEXTS = {
  de: {
    hw1: 'Hausaufgabe für morgen',
    hwN: (n: number) => `${n} Hausaufgaben für morgen`,
    more: (n: number) => `… und ${n} weitere`,
    subject: 'Fach',
    topics: (done: number, total: number) => ` · ${done}/${total} Themen gelernt`,
    tomorrow: 'morgen',
    inDays: (n: number) => `in ${n} Tagen`,
    exam: (subject: string, type: string, when: string) => `${subject}-${type} ${when}`,
    both: 'Hausaufgaben & Klausuren',
    examTitle: 'Klausur-Erinnerung',
    excuses: (n: number) => (n > 1 ? `${n} Entschuldigungen noch nicht abgegeben` : '1 Entschuldigung noch nicht abgegeben'),
    excuseTitle: 'Entschuldigung abgeben',
    test: 'Test: Benachrichtigungen funktionieren.',
  },
  en: {
    hw1: 'Homework for tomorrow',
    hwN: (n: number) => `${n} homework items for tomorrow`,
    more: (n: number) => `… and ${n} more`,
    subject: 'Subject',
    topics: (done: number, total: number) => ` · ${done}/${total} topics studied`,
    tomorrow: 'tomorrow',
    inDays: (n: number) => `in ${n} days`,
    exam: (subject: string, type: string, when: string) => `${subject} ${EXAM_TYPES_EN[type] ?? type} ${when}`,
    both: 'Homework & exams',
    examTitle: 'Exam reminder',
    excuses: (n: number) => (n > 1 ? `${n} excuse notes not handed in yet` : '1 excuse note not handed in yet'),
    excuseTitle: 'Hand in your excuse note',
    test: 'Test: notifications are working.',
  },
}
const EXAM_TYPES_EN: Record<string, string> = { Klausur: 'exam', Test: 'test', Sprechprüfung: 'oral exam' }

/** Erinnerungen für einen Nutzer (einmal pro Tag, ab der eingestellten Uhrzeit) */
async function remindUser(userId: string, subs: Sub[], now: { date: string; minutes: number }) {
  const { data: rows } = await db
    .from('records')
    .select('id, collection, data')
    .eq('user_id', userId)
    .eq('deleted', false)
    .in('collection', ['settings', 'homework', 'exams', 'subjects', 'absences'])
  if (!rows) return 0

  const settings = rows.find((r) => r.collection === 'settings')?.data as { notifications?: NotifySettings; notifyLang?: string } | undefined
  const tx = TEXTS[settings?.notifyLang === 'en' ? 'en' : 'de']
  const cfg = settings?.notifications
  if (!cfg?.enabled) return 0
  const target = toMinutes(cfg.time ?? '18:00')
  // Nur im Zeitfenster bis 3 Stunden nach der Wunschzeit (falls der Zeitplan mal später läuft)
  if (now.minutes < target || now.minutes > target + 180) return 0

  // Pro Tag nur einmal – der Eintrag im Protokoll verhindert doppelte Nachrichten
  const { error: logError } = await db.from('reminder_log').insert({ user_id: userId, key: `daily:${now.date}` })
  if (logError) return 0

  const subjects = new Map(rows.filter((r) => r.collection === 'subjects').map((r) => [r.id, (r.data as { name: string }).name]))
  const lines: string[] = []
  let title = ''

  if (cfg.homework !== false) {
    const tomorrow = addDays(now.date, 1)
    const due = rows
      .filter((r) => r.collection === 'homework')
      .map((r) => r.data as { subjectId: string; title: string; dueDate: string; done: boolean })
      .filter((h) => !h.done && h.dueDate === tomorrow)
    if (due.length) {
      title = due.length === 1 ? tx.hw1 : tx.hwN(due.length)
      for (const h of due.slice(0, 4)) lines.push(`${subjects.get(h.subjectId) ?? tx.subject}: ${h.title}`)
      if (due.length > 4) lines.push(tx.more(due.length - 4))
    }
  }

  const examDays = cfg.examDays ?? [7, 3, 1]
  const exams = rows
    .filter((r) => r.collection === 'exams')
    .map((r) => r.data as { subjectId: string; type: string; date: string; topic?: string; studyTopics?: { done: boolean }[] })
  for (const e of exams) {
    for (const d of examDays) {
      if (e.date !== addDays(now.date, d)) continue
      const topics = e.studyTopics ?? []
      const progress = topics.length ? tx.topics(topics.filter((t) => t.done).length, topics.length) : ''
      const when = d === 1 ? tx.tomorrow : tx.inDays(d)
      lines.push(`${tx.exam(subjects.get(e.subjectId) ?? tx.subject, e.type, when)}${e.topic ? ` (${e.topic})` : ''}${progress}`)
      title = title ? tx.both : tx.examTitle
    }
  }

  // Offene Entschuldigungen (seit mindestens 3 Tagen nicht abgegeben)
  if (cfg.excuses !== false) {
    const limit = addDays(now.date, -3)
    const open = rows
      .filter((r) => r.collection === 'absences')
      .map((r) => r.data as { date: string; excused: boolean })
      .filter((a) => !a.excused && a.date <= limit).length
    if (open) {
      lines.push(tx.excuses(open))
      if (!title) title = tx.excuseTitle
    }
  }

  if (!lines.length) return 0
  return send(subs, { title, body: lines.join('\n'), url: '/schulplaner/#/' })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

  // 1) Aufruf durch den Zeitplan
  if (CRON_SECRET && req.headers.get('x-cron-secret') === CRON_SECRET) {
    const { data: subs } = await db.from('push_subscriptions').select('user_id, endpoint, p256dh, auth')
    const byUser = new Map<string, Sub[]>()
    for (const s of subs ?? []) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s])
    const now = berlinNow()
    let sent = 0
    for (const [userId, list] of byUser) sent += await remindUser(userId, list, now)
    return json({ ok: true, users: byUser.size, sent })
  }

  // 2) Testnachricht aus der App (angemeldeter Nutzer)
  const token = req.headers.get('authorization')?.replace(/^Bearer /i, '')
  if (token) {
    const { data, error } = await db.auth.getUser(token)
    if (error || !data.user) return json({ error: 'Nicht angemeldet' }, 401)
    const { data: subs } = await db.from('push_subscriptions').select('user_id, endpoint, p256dh, auth').eq('user_id', data.user.id)
    const { data: st } = await db.from('records').select('data').eq('user_id', data.user.id).eq('collection', 'settings').maybeSingle()
    const tx = TEXTS[(st?.data as { notifyLang?: string } | undefined)?.notifyLang === 'en' ? 'en' : 'de']
    const sent = await send(subs ?? [], { title: 'Schulplaner', body: tx.test, url: '/schulplaner/#/' })
    return json({ ok: true, sent })
  }

  return json({ error: 'Nicht erlaubt' }, 403)
})
