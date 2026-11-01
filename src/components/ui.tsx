import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Hct, hexFromArgb } from '@material/material-color-utilities'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { IconBubble, type IconName, type Tone } from './Icons'
import { confirmDialog } from './dialogs'
import { ColorWheel } from './ColorWheel'

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={`segmented ${className}`}>
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

/** Große Farbpalette (Farbkreis × Helligkeit) für den eigenen Farbwähler */
const PALETTE: string[][] = (() => {
  const tones = [30, 45, 60, 75]
  const rows: string[][] = []
  for (let h = 0; h < 360; h += 24) rows.push(tones.map((t) => hexFromArgb(Hct.from(h, 60, t).toInt())))
  rows.push([25, 45, 65, 85].map((t) => hexFromArgb(Hct.from(0, 0, t).toInt())))
  return rows
})()

export function ColorPicker({ value, colors, onChange }: { value: string; colors: string[]; onChange: (c: string) => void }) {
  const isPreset = colors.includes(value)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'palette' | 'wheel'>('palette')
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
      <button
        type="button"
        className={`swatch custom ${!isPreset ? 'active has-color' : ''}`}
        style={!isPreset ? { background: value } : undefined}
        aria-label="Weitere Farben"
        onClick={() => setOpen(true)}
      >
        +
      </button>
      {open && (
        <Sheet title="Farbe wählen" onClose={() => setOpen(false)}>
          <div style={{ margin: '4px 0 16px' }}>
            <Segmented<'palette' | 'wheel'>
              value={mode}
              onChange={setMode}
              options={[
                { value: 'palette', label: 'Palette' },
                { value: 'wheel', label: 'Farbrad & Code' },
              ]}
            />
          </div>
          {mode === 'wheel' && (
            <ColorWheel
              value={value}
              onPick={(c) => {
                onChange(c)
                setOpen(false)
              }}
            />
          )}
          {mode === 'palette' && <div className="palette">
            {PALETTE.map((row, i) => (
              <div key={i} className="palette-row">
                {row.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    className={`swatch ${value.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
                    style={{ background: c }}
                    onClick={() => {
                      onChange(c)
                      setOpen(false)
                    }}
                  />
                ))}
              </div>
            ))}
          </div>}
        </Sheet>
      )}
    </div>
  )
}

let scrollLocks = 0
function lockScroll() {
  scrollLocks++
  document.documentElement.classList.add('scroll-locked')
}
function unlockScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1)
  if (scrollLocks === 0) document.documentElement.classList.remove('scroll-locked')
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
  // Hintergrund nicht scrollen, solange mindestens ein Fenster offen ist (Zähler, damit
  // verschachtelte Fenster die Seite beim Schließen nicht gesperrt zurücklassen)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    lockScroll()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => {
      unlockScroll()
      window.removeEventListener('keydown', onKey)
    }
  }, [])

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

/** "Auf Standard zurücksetzen" mit Nachfrage */
export function ResetButton({ what, onReset }: { what: string; onReset: () => void | Promise<void> }) {
  return (
    <div className="list" style={{ marginTop: 24 }}>
      <button
        type="button"
        className="row action reset-row"
        onClick={async () => {
          if (await confirmDialog(`${what} auf die Standardwerte zurücksetzen?`, { title: 'Zurücksetzen?', confirm: 'Zurücksetzen' })) await onReset()
        }}
      >
        Auf Standard zurücksetzen
      </button>
    </div>
  )
}

export interface SelectOption {
  value: string
  label: string
  color?: string
  /** kleine zweite Zeile, z. B. "3. Stunde · 10:00" */
  sub?: string
}

/** Vorschläge ganz oben in der Auswahl (z. B. die Stunden von heute) */
export interface SelectSuggestions {
  heading: string
  options: SelectOption[]
}

/**
 * Eigene Auswahl statt Browser-Dropdown: zeigt den gewählten Wert,
 * beim Antippen öffnet sich eine Liste von unten (wie bei Android).
 */
export function Select({
  value,
  options,
  onChange,
  title,
  placeholder = 'Bitte wählen …',
  extra,
  suggested,
  allHeading = 'Alle',
}: {
  value: string | undefined
  options: SelectOption[]
  onChange: (v: string) => void
  title: string
  placeholder?: string
  /** zusätzlicher Eintrag am Ende, z. B. "Neuer Raum …" */
  extra?: { label: string; onSelect: () => void }
  suggested?: SelectSuggestions
  /** Überschrift der vollständigen Liste, wenn es Vorschläge gibt */
  allHeading?: string
}) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === (value ?? ''))
  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
  }
  const showSuggested = suggested && suggested.options.length > 0
  return (
    <>
      <button type="button" className="row-input select-btn" onClick={() => setOpen(true)}>
        {current?.color && <ColorDot color={current.color} size={10} />}
        <span className={current ? '' : 'muted'}>{current?.label ?? placeholder}</span>
      </button>
      {open && (
        <Sheet title={title} onClose={() => setOpen(false)}>
          {showSuggested && (
            <>
              <h3 className="section-title select-heading">{suggested.heading}</h3>
              <div className="list">
                {suggested.options.map((o, i) => (
                  <button key={o.value + i} type="button" className="row" onClick={() => pick(o.value)}>
                    {o.color && <ColorDot color={o.color} size={14} />}
                    <span className="label">
                      {o.label}
                      {o.sub && <span className="sub">{o.sub}</span>}
                    </span>
                  </button>
                ))}
              </div>
              <h3 className="section-title select-heading">{allHeading}</h3>
            </>
          )}
          <div className="list">
            {options.map((o) => (
              <button key={o.value} type="button" className="row" onClick={() => pick(o.value)}>
                {o.color && <ColorDot color={o.color} size={14} />}
                <span className="label">{o.label}</span>
                {o.value === (value ?? '') && <span className="check">✓</span>}
              </button>
            ))}
            {extra && (
              <button
                type="button"
                className="row action"
                onClick={() => {
                  setOpen(false)
                  extra.onSelect()
                }}
              >
                {extra.label}
              </button>
            )}
          </div>
        </Sheet>
      )}
    </>
  )
}

/** Auswahl für Lehrer/Räume/Fächer mit Eintrag "Neu …" zum schnellen Anlegen */
export function EntitySelect({
  value,
  items,
  onChange,
  emptyLabel = 'Keine Angabe',
  onCreate,
  createLabel = 'Neu …',
  title = 'Auswählen',
  suggested,
  allHeading,
}: {
  value: string | undefined
  items: { id: string; name: string; color?: string }[]
  onChange: (id: string | undefined) => void
  emptyLabel?: string
  onCreate?: () => Promise<string | undefined>
  createLabel?: string
  title?: string
  suggested?: SelectSuggestions
  allHeading?: string
}) {
  return (
    <Select
      title={title}
      suggested={suggested}
      allHeading={allHeading}
      value={value ?? ''}
      options={[{ value: '', label: emptyLabel }, ...items.map((i) => ({ value: i.id, label: i.name, color: i.color }))]}
      onChange={(v) => onChange(v || undefined)}
      extra={
        onCreate
          ? {
              label: createLabel,
              onSelect: async () => {
                const id = await onCreate()
                if (id) onChange(id)
              },
            }
          : undefined
      }
    />
  )
}
