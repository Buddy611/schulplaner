import { useRef, useState, type PointerEvent } from 'react'
import { t } from '../lib/i18n'

function hexToHsv(hex: string) {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16) / 255
  const g = parseInt(m.slice(2, 4), 16) / 255
  const b = parseInt(m.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
  }
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max }
}

function hsvToHex(h: number, s: number, v: number) {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255)
  }
  return '#' + [f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

export const isHex = (v: string) => /^#?[0-9a-f]{6}$/i.test(v.trim())
export const normalizeHex = (v: string) => '#' + v.trim().replace('#', '').toLowerCase()

/**
 * Farbrad: Richtung = Farbton, Abstand zur Mitte = Sättigung, Regler = Helligkeit.
 * Dazu ein Feld für Farbcodes (z. B. #4285F4).
 */
export function ColorWheel({ value, onPick }: { value: string; onPick: (hex: string) => void }) {
  const start = isHex(value) ? hexToHsv(normalizeHex(value)) : { h: 210, s: 0.7, v: 0.9 }
  const [hsv, setHsv] = useState(start)
  const [code, setCode] = useState(hsvToHex(start.h, start.s, start.v))
  const wheel = useRef<HTMLDivElement>(null)
  const current = hsvToHex(hsv.h, hsv.s, hsv.v)

  function update(next: typeof hsv) {
    setHsv(next)
    setCode(hsvToHex(next.h, next.s, next.v))
  }

  function pick(e: PointerEvent<HTMLDivElement>) {
    const el = wheel.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const dx = e.clientX - (rect.left + rect.width / 2)
    const dy = e.clientY - (rect.top + rect.height / 2)
    const radius = rect.width / 2
    const h = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
    const s = Math.min(1, Math.hypot(dx, dy) / radius)
    update({ ...hsv, h, s })
  }

  // Position der Markierung im Rad
  const angle = (hsv.h * Math.PI) / 180
  const markerX = 50 + Math.sin(angle) * hsv.s * 50
  const markerY = 50 - Math.cos(angle) * hsv.s * 50

  return (
    <div className="color-wheel-wrap">
      <div
        ref={wheel}
        className="color-wheel"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          pick(e)
        }}
        onPointerMove={(e) => e.buttons && pick(e)}
      >
        <div className="color-wheel-dark" style={{ opacity: 1 - hsv.v }} />
        <span className="color-wheel-marker" style={{ left: `${markerX}%`, top: `${markerY}%`, background: current }} />
      </div>

      <label className="brightness">
        <span className="field-label">{t('Helligkeit')}</span>
        <input
          type="range"
          min={10}
          max={100}
          value={Math.round(hsv.v * 100)}
          onChange={(e) => update({ ...hsv, v: Number(e.target.value) / 100 })}
          style={{ background: `linear-gradient(to right, #000, ${hsvToHex(hsv.h, hsv.s, 1)})` }}
        />
      </label>

      <div className="color-code-row">
        <span className="color-preview" style={{ background: isHex(code) ? normalizeHex(code) : current }} />
        <input
          className="input"
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            if (isHex(e.target.value)) setHsv(hexToHsv(normalizeHex(e.target.value)))
          }}
          placeholder="#4285F4"
          autoCapitalize="off"
          spellCheck={false}
          aria-label={t('Farbcode')}
        />
        <button type="button" className="btn" style={{ width: 'auto' }} disabled={!isHex(code)} onClick={() => onPick(normalizeHex(code))}>
          {t('Übernehmen')}
        </button>
      </div>
    </div>
  )
}
