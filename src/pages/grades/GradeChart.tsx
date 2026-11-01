import { parseISODate } from '../../lib/dates'
import type { GradeSystem } from '../../lib/grades'
import { locale, t } from '../../lib/i18n'

export interface ChartPoint {
  date: string
  value: number
  average: number
}

/**
 * Notenverlauf: Punkte = einzelne Noten, Linie = Schnitt nach jeder Note.
 * Bessere Noten stehen immer oben (bei Noten 1 oben, bei Punkten 15 oben).
 */
export function GradeChart({ points, system, color }: { points: ChartPoint[]; system: GradeSystem; color: string }) {
  if (points.length < 2) return <p className="hint">Der Verlauf erscheint ab zwei Noten.</p>
  const W = 600
  const H = 200
  const pad = { l: 34, r: 12, t: 12, b: 26 }
  const [best, worst] = system === 'punkte' ? [15, 0] : [1, 6]
  const t0 = parseISODate(points[0].date).getTime()
  const t1 = parseISODate(points[points.length - 1].date).getTime()
  const x = (d: string) => pad.l + ((parseISODate(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + ((v - best) / (worst - best)) * (H - pad.t - pad.b)
  const ticks = system === 'punkte' ? [15, 12, 9, 6, 3, 0] : [1, 2, 3, 4, 5, 6]
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.average).toFixed(1)}`).join(' ')

  return (
    <svg className="grade-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Notenverlauf')}>
      {ticks.map((tp) => (
        <g key={tp}>
          <line x1={pad.l} x2={W - pad.r} y1={y(tp)} y2={y(tp)} className="grid" />
          <text x={pad.l - 8} y={y(tp) + 4} textAnchor="end" className="axis">
            {tp}
          </text>
        </g>
      ))}
      <path d={line} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(p.date)} cy={y(p.value)} r="5" fill="var(--card)" stroke={color} strokeWidth="2.5" />
      ))}
      <text x={pad.l} y={H - 6} className="axis">
        {parseISODate(points[0].date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
      </text>
      <text x={W - pad.r} y={H - 6} textAnchor="end" className="axis">
        {parseISODate(points[points.length - 1].date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
      </text>
    </svg>
  )
}
