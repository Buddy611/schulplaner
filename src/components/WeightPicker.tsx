import { useState } from 'react'
import { Segmented } from './ui'

const STANDARD = 'standard'
const EIGENE = 'eigene'

/**
 * Anteil schriftlich/mündlich: ein paar feste Werte zum Antippen plus "Eigene …",
 * dann lässt sich der genaue Prozentwert eintippen. Mit `standardLabel` gibt es
 * zusätzlich "Standard" (= kein eigener Wert, value undefined).
 */
export function WeightPicker({
  value,
  onChange,
  presets = [30, 40, 50, 60, 70],
  standardLabel,
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  presets?: number[]
  standardLabel?: string
}) {
  const isPreset = value != null && presets.includes(value)
  const [custom, setCustom] = useState(value != null && !isPreset)
  const [draft, setDraft] = useState(value != null ? String(value).replace('.', ',') : '')
  const selected = value == null ? STANDARD : custom || !isPreset ? EIGENE : String(value)

  function pick(v: string) {
    if (v === STANDARD) {
      setCustom(false)
      onChange(undefined)
    } else if (v === EIGENE) {
      setCustom(true)
      setDraft(value != null ? String(value).replace('.', ',') : '50')
      if (value == null) onChange(50)
    } else {
      setCustom(false)
      onChange(Number(v))
    }
  }

  function type(text: string) {
    setDraft(text)
    const v = Number(text.replace(',', '.'))
    if (text.trim() !== '' && !Number.isNaN(v) && v >= 0 && v <= 100) onChange(v)
  }

  const written = value ?? 50
  const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 })

  return (
    <>
      <Segmented<string>
        className="compact"
        value={selected}
        onChange={pick}
        options={[
          ...(standardLabel ? [{ value: STANDARD, label: standardLabel }] : []),
          ...presets.map((p) => ({ value: String(p), label: `${p}/${100 - p}` })),
          { value: EIGENE, label: selected === EIGENE ? `${fmt(written)}/${fmt(100 - written)}` : 'Eigene' },
        ]}
      />
      {selected === EIGENE && (
        <div className="weight-custom">
          <label>
            Schriftlich
            <input className="input" inputMode="decimal" value={draft} onChange={(e) => type(e.target.value)} onBlur={() => setDraft(fmt(written))} />%
          </label>
          <span>Mündlich {fmt(100 - written)} %</span>
        </div>
      )}
    </>
  )
}
