import { NavLink } from 'react-router-dom'
import { useActiveTimetable } from '../lib/models'
import { Icon } from './Icons'

const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const icons = {
  today: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" />
      <path d="M9.5 20.5v-6h5v6" />
    </svg>
  ),
  timetable: (
    <svg viewBox="0 0 24 24" {...s}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2" />
    </svg>
  ),
  homework: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M4 6.5l1.8 1.8L9 5M4 15.5l1.8 1.8L9 14M12.5 7h7.5M12.5 16h7.5" />
    </svg>
  ),
  exams: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M15.5 4.5l4 4L9 19H5v-4z" />
      <path d="M13 7l4 4" />
    </svg>
  ),
  grades: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M2.5 9 12 4.5 21.5 9 12 13.5z" />
      <path d="M6.5 11v4.5c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3V11M21.5 9v5" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" {...s}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  ),
}

const sections = [
  { to: '/', label: 'Heute', icon: icons.today },
  { to: '/stundenplan', label: 'Stundenplan', short: 'Plan', icon: icons.timetable },
  { to: '/hausaufgaben', label: 'Hausaufgaben', short: 'Aufgaben', icon: icons.homework },
  { to: '/klausuren', label: 'Klausuren', icon: icons.exams },
  { to: '/noten', label: 'Noten', icon: icons.grades },
]

/** Handy: Navigationsleiste unten (Einstellungen über das Zahnrad oben rechts) */
export function TabBar() {
  return (
    <nav className="tabbar">
      {sections.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'}>
          <span className="indicator">{t.icon}</span>
          {t.short ?? t.label}
        </NavLink>
      ))}
    </nav>
  )
}

/** iPad / großer Bildschirm: Seitenleiste links */
export function SideNav() {
  const { timetable } = useActiveTimetable()
  return (
    <aside className="sidenav">
      <div className="sidenav-title">{timetable?.name ?? 'Schulplaner'}</div>
      <nav>
        {[...sections, { to: '/einstellungen', label: 'Einstellungen', icon: icons.settings }].map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'}>
            {t.icon}
            {t.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidenav-sub">Mehr</div>
      <nav>
        <NavLink to="/fehlstunden">
          <Icon name="absence" />
          Fehlstunden
        </NavLink>
        <NavLink to="/vertretungen">
          <Icon name="swap" />
          Vertretungen
        </NavLink>
      </nav>
    </aside>
  )
}
