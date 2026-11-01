import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { StatusPill } from './StatusPill'
import { icons } from './TabBar'
import { t } from '../lib/i18n'

export function PageHeader({
  title,
  back,
  children,
  settingsButton = true,
}: {
  title: string
  /** Zurück-Link, z. B. { to: '/einstellungen', label: 'Einstellungen' } */
  back?: { to: string; label: string }
  children?: ReactNode
  /** Zahnrad zu den Einstellungen (nur auf dem Handy sichtbar) */
  settingsButton?: boolean
}) {
  if (back) {
    // Unterseite: kleine App-Leiste mit Zurück-Pfeil (wie bei Android)
    return (
      <header className="top-bar">
        <Link to={back.to} className="nav-btn" aria-label={t('Zurück zu {label}', { label: back.label })}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1>{title}</h1>
        <div className="header-actions">
          <StatusPill />
          {children}
        </div>
      </header>
    )
  }
  return (
    <header className="page-header">
      <h1 className="large-title">{title}</h1>
      <div className="header-actions">
        <StatusPill />
        {children}
        {settingsButton && (
          <Link to="/einstellungen" className="nav-btn mobile-only" aria-label={t('Einstellungen')}>
            {icons.settings}
          </Link>
        )}
      </div>
    </header>
  )
}
