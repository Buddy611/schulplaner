import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { ColorDot, EntitySelect, Field } from '../../components/ui'
import { addDays, mondayOf, toISODate } from '../../lib/dates'
import { useLookups } from '../../lib/models'
import { newId, put, useCollection } from '../../lib/repo'

/** Gespeicherte Lernzeit (synchronisiert) */
export const SESSIONS = 'studySessions'
export interface StudySession {
  subjectId?: string
  minutes: number
  date: string
  createdAt: number
}

type Phase = 'lernen' | 'pause'
interface TimerState {
  phase: Phase
  /** Endzeitpunkt der laufenden Phase (ms) – null = pausiert */
  endsAt: number | null
  /** verbleibende ms, wenn pausiert */
  remaining: number
  focusMin: number
  breakMin: number
  subjectId?: string
  /** Beginn der aktuellen Lernphase (für die Statistik) */
  phaseMinutes: number
}

const KEY = 'schulplaner-timer'

function load(): TimerState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as TimerState | null
    if (s) return s
  } catch {
    // egal
  }
  return { phase: 'lernen', endsAt: null, remaining: 25 * 60_000, focusMin: 25, breakMin: 5, phaseMinutes: 25 }
}

function save(s: TimerState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // egal
  }
}

/** Kurzer Ton + Vibration + (falls erlaubt) Benachrichtigung am Ende einer Phase */
async function signal(text: string) {
  try {
    navigator.vibrate?.([200, 100, 200])
    const ctx = new AudioContext()
    for (const [i, f] of [880, 660, 880].entries()) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = f
      g.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.25)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.25 + 0.22)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + i * 0.25)
      o.stop(ctx.currentTime + i * 0.25 + 0.24)
    }
  } catch {
    // egal
  }
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      const reg = await navigator.serviceWorker?.ready
      await reg?.showNotification('Lern-Timer', { body: text, icon: 'pwa-192x192.png' })
    }
  } catch {
    // egal
  }
}

export function StudyTimerPage() {
  const [state, setState] = useState<TimerState>(load)
  const [now, setNow] = useState(Date.now())
  const { subjects, subjectMap } = useLookups()
  const sessions = useCollection<StudySession>(SESSIONS) ?? []

  const update = (s: TimerState) => {
    setState(s)
    save(s)
  }
  const remaining = state.endsAt ? Math.max(0, state.endsAt - now) : state.remaining
  const running = state.endsAt !== null

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [running])

  // Phase vorbei → Lernzeit speichern, Signal, nächste Phase vorbereiten
  useEffect(() => {
    if (!running || remaining > 0) return
    if (state.phase === 'lernen') {
      void put<StudySession>(SESSIONS, newId(), { subjectId: state.subjectId, minutes: state.phaseMinutes, date: toISODate(new Date()), createdAt: Date.now() })
      void signal(`Geschafft! ${state.phaseMinutes} Minuten gelernt – jetzt ${state.breakMin} Minuten Pause.`)
      update({ ...state, phase: 'pause', endsAt: null, remaining: state.breakMin * 60_000, phaseMinutes: state.breakMin })
    } else {
      void signal('Pause vorbei – weiter geht’s!')
      update({ ...state, phase: 'lernen', endsAt: null, remaining: state.focusMin * 60_000, phaseMinutes: state.focusMin })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, remaining])

  function start() {
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
    update({ ...state, endsAt: Date.now() + state.remaining })
    setNow(Date.now())
  }
  function pause() {
    update({ ...state, endsAt: null, remaining })
  }
  function reset() {
    // Angefangene Lernzeit ab 1 Minute trotzdem zählen
    if (state.phase === 'lernen') {
      const done = Math.floor((state.phaseMinutes * 60_000 - remaining) / 60_000)
      if (done >= 1) void put<StudySession>(SESSIONS, newId(), { subjectId: state.subjectId, minutes: done, date: toISODate(new Date()), createdAt: Date.now() })
    }
    update({ ...state, phase: 'lernen', endsAt: null, remaining: state.focusMin * 60_000, phaseMinutes: state.focusMin })
  }
  function setDurations(focusMin: number, breakMin: number) {
    update({ ...state, focusMin, breakMin, phase: 'lernen', endsAt: null, remaining: focusMin * 60_000, phaseMinutes: focusMin })
  }

  const mm = String(Math.floor(remaining / 60_000)).padStart(2, '0')
  const ss = String(Math.floor((remaining % 60_000) / 1000)).padStart(2, '0')
  const total = state.phaseMinutes * 60_000
  const progress = 1 - remaining / total

  // Statistik
  const today = toISODate(new Date())
  const weekStart = toISODate(mondayOf(new Date()))
  const weekEnd = toISODate(addDays(mondayOf(new Date()), 6))
  const todayMin = sessions.filter((s) => s.date === today).reduce((a, s) => a + s.minutes, 0)
  const week = sessions.filter((s) => s.date >= weekStart && s.date <= weekEnd)
  const weekMin = week.reduce((a, s) => a + s.minutes, 0)
  const perSubject = new Map<string, number>()
  for (const s of week) perSubject.set(s.subjectId ?? '', (perSubject.get(s.subjectId ?? '') ?? 0) + s.minutes)
  const maxSubject = Math.max(1, ...perSubject.values())
  const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} Std. ${m % 60} Min.` : `${m} Min.`)

  return (
    <div className="page">
      <PageHeader title="Lern-Timer" back={{ to: '/lernen', label: 'Lernen' }} />

      <div className={`timer ${state.phase}`}>
        <svg viewBox="0 0 120 120" className="timer-ring">
          <circle cx="60" cy="60" r="54" className="timer-track" />
          <circle cx="60" cy="60" r="54" className="timer-progress" style={{ strokeDasharray: 339.3, strokeDashoffset: 339.3 * (1 - progress) }} />
        </svg>
        <div className="timer-center">
          <span className="timer-phase">{state.phase === 'lernen' ? 'Lernen' : 'Pause'}</span>
          <span className="timer-time">
            {mm}:{ss}
          </span>
          {state.subjectId && <span className="muted">{subjectMap.get(state.subjectId)?.name}</span>}
        </div>
      </div>

      <div className="btn-row">
        {running ? (
          <button type="button" className="btn secondary" style={{ flex: 1 }} onClick={pause}>
            Pause
          </button>
        ) : (
          <button type="button" className="btn" style={{ flex: 1 }} onClick={start}>
            {remaining < total ? 'Weiter' : 'Start'}
          </button>
        )}
        <button type="button" className="btn secondary" style={{ flex: 1 }} onClick={reset}>
          Zurücksetzen
        </button>
      </div>

      <h2 className="section-title">Einstellungen</h2>
      <div className="list">
        <Field label="Fach">
          <EntitySelect title="Fach" value={state.subjectId} items={subjects} onChange={(subjectId) => update({ ...state, subjectId })} emptyLabel="Ohne Fach" />
        </Field>
        <div className="row stack">
          <span className="field-label">Lernen / Pause</span>
          <div className="chips">
            {[
              [25, 5],
              [45, 10],
              [15, 3],
              [60, 10],
            ].map(([f, b]) => (
              <button key={f} type="button" className={`chip ${state.focusMin === f && state.breakMin === b ? 'active' : ''}`} onClick={() => setDurations(f, b)} disabled={running}>
                {f} / {b} Min.
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="section-footer">Der Timer läuft weiter, auch wenn du die App schließt. Am Ende vibriert das Handy und es kommt ein Ton.</p>

      <h2 className="section-title">Statistik</h2>
      <div className="stat-row">
        <div className="stat">
          <span className="stat-value">{fmtMin(todayMin)}</span>
          <span className="stat-label">heute gelernt</span>
        </div>
        <div className="stat">
          <span className="stat-value">{fmtMin(weekMin)}</span>
          <span className="stat-label">diese Woche</span>
        </div>
      </div>
      {perSubject.size > 0 && (
        <div className="list">
          {[...perSubject.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([id, m]) => {
              const s = subjectMap.get(id)
              return (
                <div key={id || 'none'} className="row">
                  <ColorDot color={s?.color ?? 'var(--outline)'} size={12} />
                  <span className="label">
                    {s?.name ?? 'Ohne Fach'}
                    <span className="study-bar">
                      <span style={{ width: `${(m / maxSubject) * 100}%`, background: s?.color ?? 'var(--outline)' }} />
                    </span>
                  </span>
                  <span className="value">{fmtMin(m)}</span>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
