import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { IconBubble, type IconName, type Tone } from './Icons'

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} type="button" className={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Chevron() {
  return (
    <svg className="chevron" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 1l6 6-6 6" />
    </svg>
  )
}

/** Listenzeile, die zu einer Unterseite führt – optional mit farbigem Symbol und Unterzeile */
export function LinkRow({
  to,
  children,
  value,
  icon,
  tone = 'blue',
  sub,
}: {
  to: string
  children: ReactNode
  value?: ReactNode
  icon?: IconName
  tone?: Tone
  sub?: ReactNode
}) {
  return (
    <Link to={to} className={`row link ${icon ? 'with-icon' : ''}`}>
      {icon && <IconBubble name={icon} tone={tone} />}
      <span className="label">
        <span className="row-title">{children}</span>
        {sub && <span className="sub">{sub}</span>}
      </span>
      {value !== undefined && <span className="value">{value}</span>}
      {!icon && <Chevron />}
    </Link>
  )
}

/** Formularzeile: Beschriftung links, Eingabe rechts */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="row field">
      <span className="label">{label}</span>
      {children}
    </label>
  )
}

export function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <input type="checkbox" role="switch" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
  )
}

export function ColorDot({ color, size = 12 }: { color: string; size?: number }) {
  return <span className="color-dot" style={{ background: color, width: size, height: size }} />
}

export function ColorPicker({ value, colors, onChange }: { value: string; colors: string[]; onChange: (c: string) => void }) {
  const isPreset = colors.includes(value)
  return (
    <div className="swatches">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          className={`swatch ${value === c ? 'active' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
      <label
        className={`swatch custom ${!isPreset ? 'active has-color' : ''}`}
        style={!isPreset ? { background: value } : undefined}
        aria-label="Eigene Farbe"
        title="Eigene Farbe"
      >
        +
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  )
}

/** Fenster, das von unten hereinfährt (wie bei iOS) */
export function Sheet({
  title,
  onClose,
  onSave,
  saveLabel = 'Fertig',
  saveDisabled,
  children,
}: {
  title: string
  onClose: () => void
  onSave?: () => void
  saveLabel?: string
  saveDisabled?: boolean
  children: ReactNode
}) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-header">
          <button type="button" className="link-btn" onClick={onClose}>
            Abbrechen
          </button>
          <h2>{title}</h2>
          {onSave ? (
            <button type="button" className="link-btn strong" onClick={onSave} disabled={saveDisabled}>
              {saveLabel}
            </button>
          ) : (
            <span />
          )}
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

/** Dropdown für Lehrer/Räume/Fächer mit Eintrag "Neu …" zum schnellen Anlegen */
export function EntitySelect({
  value,
  items,
  onChange,
  emptyLabel = 'Keine Angabe',
  onCreate,
  createLabel = 'Neu …',
}: {
  value: string | undefined
  items: { id: string; name: string }[]
  onChange: (id: string | undefined) => void
  emptyLabel?: string
  onCreate?: () => Promise<string | undefined>
  createLabel?: string
}) {
  return (
    <select
      className="row-input"
      value={value ?? ''}
      onChange={async (e) => {
        const v = e.target.value
        if (v === '__new') {
          const id = await onCreate?.()
          if (id) onChange(id)
          return
        }
        onChange(v || undefined)
      }}
    >
      <option value="">{emptyLabel}</option>
      {items.map((i) => (
        <option key={i.id} value={i.id}>
          {i.name}
        </option>
      ))}
      {onCreate && <option value="__new">{createLabel}</option>}
    </select>
  )
}
