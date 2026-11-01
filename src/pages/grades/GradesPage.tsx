import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { ColorDot } from '../../components/ui'
import { belowGoal, formatAverage, goalLabel, halfYearOf, reportGrade, shiftHalfYear, type HalfYear } from '../../lib/grades'
import { HalfYearPicker } from '../../components/HalfYearPicker'
import { toISODate } from '../../lib/dates'
import { useHalfYearSettings } from '../../lib/useHalfYears'
import { useGradeData } from '../../lib/useGradeData'
import { subjectCategory } from '../../lib/models'
import { GradeSheet } from './GradeSheet'

/** Halbjahr aus der Adresse (?hj=2026-1) oder das aktuelle */
export function useHalfYearParam() {
  const settings = useHalfYearSettings()
  const [params, setParams] = useSearchParams()
  const today = halfYearOf(toISODate(new Date()), settings)
  const key = params.get('hj')
  let half = today
  if (key) {
    const [y, h] = key.split('-').map(Number)
    half = halfYearOf(h === 1 ? `${y}-${settings.schoolYearStart}` : `${y + 1}-${settings.secondHalfStart}`, settings)
  }
  const set = (dir: 1 | -1) => select(shiftHalfYear(half, dir, settings))
  const select = (next: HalfYear) => setParams(next.key === today.key ? {} : { hj: next.key }, { replace: true })
  return { half, set, select, settings, isCurrent: half.key === today.key }
}

export function GradesPage() {
  const { half, select, settings: halfSettings } = useHalfYearParam()
  const data = useGradeData(half)
  const [adding, setAdding] = useState(false)
  if (!data.loaded) return null
  const sys = data.settings.gradeSystem
  const groups = [
    { title: 'Hauptfächer', rows: data.rows.filter((r) => subjectCategory(r.subject) === 'haupt') },
    { title: 'Nebenfächer', rows: data.rows.filter((r) => subjectCategory(r.subject) === 'neben') },
  ].filter((g) => g.rows.length > 0)
  const q = half.key === halfYearOf(toISODate(new Date()), data.settings).key ? '' : `?hj=${half.key}`

  return (
    <div className="page">
      <PageHeader title="Noten">
        <button type="button" className="link-btn no-print" onClick={() => window.print()}>
          PDF
        </button>
        <button type="button" className="icon-btn" aria-label="Note eintragen" onClick={() => setAdding(true)}>
          +
        </button>
      </PageHeader>

      <HalfYearPicker value={half} settings={halfSettings} onChange={select} />
      {sys === 'punkte' && <p className="section-footer">Dieses Halbjahr wird in Punkten angezeigt.</p>}

      <div className="grade-hero">
        <div>
          <div className="hero-label">Gesamtdurchschnitt</div>
          <div className="grade-big">{formatAverage(data.average, sys)}</div>
          <div className="muted" style={{ fontSize: '0.875rem' }}>
            {data.withTotal.length} von {data.rows.length} Fächern mit Noten
          </div>
        </div>
        <Link to={`/noten/zeugnis${q}`} className="btn secondary" style={{ width: 'auto', textDecoration: 'none' }}>
          Zeugnis-Vorschau
        </Link>
      </div>

      {data.rows.length === 0 && <p className="hint">Lege zuerst unter Einstellungen → Fächer deine Fächer an.</p>}

      {groups.map(({ title, rows }) => (
        <div key={title}>
          {groups.length > 1 && <h2 className="section-title">{title}</h2>}
          <div className="list">
            {rows.map(({ subject, result }) => (
              <Link key={subject.id} to={`/noten/${subject.id}${q}`} className="row">
                <ColorDot color={subject.color} size={14} />
                <span className="label">
                  {subject.name}
                  <span className="sub">
                    {result.total == null
                      ? 'Noch keine Noten'
                      : `schriftlich ${formatAverage(result.written, sys)} · mündlich ${formatAverage(result.oral, sys)}`}
                  </span>
                </span>
                <span className={`grade-chip ${belowGoal(result.total, subject.goal, sys) ? 'warn' : ''}`} title={subject.goal ? 'Ziel: ' + goalLabel(subject.goal, sys) : undefined}>
                  {formatAverage(result.total, sys)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}
      {data.withTotal.length > 0 && (
        <p className="section-footer">
          Der Gesamtdurchschnitt ist der Mittelwert aller Fächer mit Noten. Zeugnisnoten (gerundet): {data.withTotal.map((r) => `${r.subject.short} ${reportGrade(r.result.total, sys)}`).join(', ')}
        </p>
      )}

      {adding && <GradeSheet onClose={() => setAdding(false)} />}
    </div>
  )
}
