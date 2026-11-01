import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDate, toISODate } from '../lib/dates'
import type { useSchedule } from '../lib/schedule'
import { t } from '../lib/i18n'

const KEY = 'schulplaner-packed'

function loadPacked(day: string): string[] {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string[]>
    return all[day] ?? []
  } catch {
    return []
  }
}

function savePacked(day: string, items: string[]) {
  try {
    // Nur den aktuellen Tag behalten – ältere Häkchen braucht niemand mehr
    localStorage.setItem(KEY, JSON.stringify({ [day]: items }))
  } catch {
    // egal
  }
}

/**
 * Packliste für einen Schultag: Material aller Fächer, die an dem Tag stattfinden
 * (ohne ausgefallene Stunden). Häkchen werden nur auf diesem Gerät gemerkt.
 */
export function PackingList({ schedule, day }: { schedule: ReturnType<typeof useSchedule>; day: Date }) {
  const iso = toISODate(day)
  const [packed, setPacked] = useState<string[]>(() => loadPacked(iso))
  const lessons = schedule.activeLessonsOn(day)
  const items: { item: string; subjects: string[] }[] = []
  for (const l of lessons) {
    for (const m of l.subject.materials ?? []) {
      const existing = items.find((x) => x.item.toLowerCase() === m.toLowerCase())
      if (existing) {
        if (!existing.subjects.includes(l.subject.short)) existing.subjects.push(l.subject.short)
      } else items.push({ item: m, subjects: [l.subject.short] })
    }
  }
  const hasAnyMaterials = schedule.lookups.subjects.some((s) => s.materials?.length)

  function toggle(item: string) {
    const next = packed.includes(item) ? packed.filter((x) => x !== item) : [...packed, item]
    setPacked(next)
    savePacked(iso, next)
  }

  if (!hasAnyMaterials) {
    return (
      <div className="card empty" style={{ padding: 20 }}>
        {t('Trag bei deinen Fächern ein, was du mitbringen musst – dann steht hier, was in die Tasche gehört.')}{' '}
        <Link to="/einstellungen/faecher">{t('Zu den Fächern')}</Link>
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <div className="card empty" style={{ padding: 20 }}>
        {t('Für {day} brauchst du kein besonderes Material.', { day: formatDate(day, { weekday: 'long' }) })}
      </div>
    )
  }
  const done = items.filter((x) => packed.includes(x.item)).length
  return (
    <div className="list">
      {items.map(({ item, subjects }) => (
        <label key={item} className="row" style={{ cursor: 'pointer' }}>
          <input type="checkbox" className="checkbox" checked={packed.includes(item)} onChange={() => toggle(item)} />
          <span className="label" style={packed.includes(item) ? { textDecoration: 'line-through', color: 'var(--text-2)' } : undefined}>
            {item}
          </span>
          <span className="value">{subjects.join(', ')}</span>
        </label>
      ))}
      {done === items.length && <div className="row muted" style={{ justifyContent: 'center' }}>{t('Alles eingepackt')}</div>}
    </div>
  )
}
