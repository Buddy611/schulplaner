import type { CSSProperties, ReactNode } from 'react'
import { toMinutes } from '../lib/dates'
import { periodTitle, slotTime, type Period } from '../lib/models'
import { t } from '../lib/i18n'

/** Eine Kachel im Raster, von Platz `start` bis `end` (Halbstunden-Plätze, siehe lessonSlots) */
export interface GridBlock {
  key: string
  start: number
  end: number
  content: ReactNode
  className?: string
  style?: CSSProperties
  onClick?: () => void
}

/**
 * Wochenraster: Jede Unterrichtsstunde besteht aus zwei Zeilen (1. und 2. Hälfte),
 * Pausen aus einer schmalen Zeile. So können Kacheln halbe Stunden belegen oder
 * über mehrere Stunden (inkl. Pausen dazwischen) gehen.
 */
export function WeekGrid({
  periods,
  heads,
  blocks,
  onEmpty,
  emptyClass,
  emptyContent,
}: {
  periods: Period[]
  heads: ReactNode[]
  blocks: GridBlock[][]
  /** Tippen auf eine freie Stelle: Spalte, Unterrichtsstunde (Index) und Hälfte (undefined = ganze Stunde) */
  onEmpty?: (col: number, lessonIndex: number, half?: 0 | 1) => void
  emptyClass?: (col: number) => string
  emptyContent?: ReactNode
}) {
  const lessonPeriods = periods.filter((p) => p.kind === 'lesson')
  // Zeilen aufbauen
  const rows: string[] = ['auto']
  const slotRow: number[] = []
  const timeCells: ReactNode[] = []
  for (const p of periods) {
    const minutes = toMinutes(p.end) - toMinutes(p.start)
    if (p.kind === 'break') {
      const r = rows.length + 1
      rows.push('auto')
      timeCells.push(
        <div key={p.id + 't'} className="tt-break-time" style={{ gridRow: r, gridColumn: 1 }}>
          {p.start}
        </div>,
        <div key={p.id} className="tt-break" style={{ gridRow: r, gridColumn: `2 / ${heads.length + 2}` }}>
          {periodTitle(periods, p)}
        </div>,
      )
      continue
    }
    const r = rows.length + 1
    const half = `max(30px, calc(var(--tt-px-per-min) * ${minutes / 2}))`
    rows.push(half, half)
    slotRow.push(r, r + 1)
    timeCells.push(
      <div key={p.id + 't'} className="tt-time" style={{ gridRow: `${r} / span 2`, gridColumn: 1 }}>
        <span>{p.start}</span>
        <strong>{periodTitle(periods, p).replace('. Stunde', '.')}</strong>
        <span>{p.end}</span>
      </div>,
    )
  }

  const cells: ReactNode[] = []
  blocks.forEach((list, col) => {
    const covered = new Set<number>()
    for (const b of list) {
      for (let s = b.start; s <= b.end; s++) covered.add(s)
      const Tag = b.onClick ? 'button' : 'div'
      cells.push(
        <Tag
          key={b.key}
          type={b.onClick ? 'button' : undefined}
          className={`tt-cell filled ${b.end - b.start === 0 ? 'half' : ''} ${b.className ?? ''}`}
          style={{ ...b.style, gridColumn: col + 2, gridRow: `${slotRow[b.start]} / ${slotRow[b.end] + 1}` }}
          onClick={b.onClick}
          title={`${slotTime(lessonPeriods, b.start, 'start')}–${slotTime(lessonPeriods, b.end, 'end')}`}
        >
          {b.content}
        </Tag>,
      )
    }
    // Freie Stellen: ganze Stunde oder einzelne Hälfte
    lessonPeriods.forEach((_, i) => {
      const a = covered.has(i * 2)
      const b = covered.has(i * 2 + 1)
      if (a && b) return
      const cls = `tt-cell blank ${onEmpty ? 'empty' : ''} ${emptyClass?.(col) ?? ''}`
      const make = (half: 0 | 1 | undefined, rowStyle: string) => {
        const Tag = onEmpty ? 'button' : 'div'
        return (
          <Tag
            key={`e${col}-${i}-${half ?? 'f'}`}
            type={onEmpty ? 'button' : undefined}
            className={cls}
            style={{ gridColumn: col + 2, gridRow: rowStyle }}
            onClick={onEmpty ? () => onEmpty(col, i, half) : undefined}
            aria-label={t('Freie Stunde eintragen')}
          >
            {onEmpty && emptyContent}
          </Tag>
        )
      }
      if (!a && !b) cells.push(make(undefined, `${slotRow[i * 2]} / span 2`))
      else if (!a) cells.push(make(0, `${slotRow[i * 2]}`))
      else cells.push(make(1, `${slotRow[i * 2 + 1]}`))
    })
  })

  return (
    <div className="tt-grid" style={{ gridTemplateRows: rows.join(' '), gridTemplateColumns: `var(--tt-time-col) repeat(${heads.length}, minmax(0, 1fr))` }}>
      <div style={{ gridRow: 1, gridColumn: 1 }} />
      {heads.map((h, i) => (
        <div key={i} style={{ gridRow: 1, gridColumn: i + 2 }}>
          {h}
        </div>
      ))}
      {timeCells}
      {cells}
    </div>
  )
}
