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
import { t } from '../../lib/i18n'

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
    { title: t('Hauptfächer'), rows: data.rows.filter((r) => subjectCategory(r.subject) === 'haupt') },
    { title: t('Nebenfächer'), rows: data.rows.filter((r) => subjectCategory(r.subject) === 'neben') },
  ].filter((g) => g.rows.length > 0)
  const q = half.key === halfYearOf(toISODate(new Date()), data.settings).key ? '' : `?hj=${half.key}`

  return (
    <div className="page">
      <PageHeader title={t('Noten')}>
        <button type="button" className="link-btn no-print" onClick={() => window.print()}>
          PDF
        </button>
        <button type="button" className="icon-btn" aria-label={t('Note eintragen')} onClick={() => setAdding(true)}>
          +
        </button>
      </PageHeader>

      <HalfYearPicker value={half} settings={halfSettings} onChange={select} />
      {sys === 'punkte' && <p className="section-footer">{t('Dieses Halbjahr wird in Punkten angezeigt.')}</p>}

      <div className="grade-hero">
        <div>
          <div className="hero-label">{t('Gesamtdurchschnitt')}</div>
          <div className="grade-big">{formatAverage(data.average, sys)}</div>
          <div className="muted" style={{ fontSize: '0.875rem' }}>
            {t('{n} von {m} Fächern mit Noten', { n: data.withTotal.length, m: data.rows.length })}
          </div>
        </div>
        <Link to={`/noten/zeugnis${q}`} className="btn secondary" style={{ width: 'auto', textDecoration: 'none' }}>
          {t('Zeugnis-Vorschau')}
        </Link>
      </div>

      {data.rows.length === 0 && <p className="hint">{t('Lege zuerst unter Einstellungen → Fächer deine Fächer an.')}</p>}

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
                      ? t('Noch keine Noten')
                      : t('schriftlich {w} · mündlich {o}', { w: formatAverage(result.written, sys), o: formatAverage(result.oral, sys) })}
                  </span>
                </span>
                <span className={`grade-chip ${belowGoal(result.total, subject.goal, sys) ? 'warn' : ''}`} title={subject.goal ? t('Ziel: {goal}', { goal: goalLabel(subject.goal, sys) }) : undefined}>
                  {formatAverage(result.total, sys)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}
      {data.withTotal.length > 0 && (
        <p className="section-footer">
          {t('Der Gesamtdurchschnitt ist der Mittelwert aller Fächer mit Noten. Zeugnisnoten (gerundet):')} {data.withTotal.map((r) => `${r.subject.short} ${reportGrade(r.result.total, sys)}`).join(', ')}
        </p>
      )}

      {adding && <GradeSheet onClose={() => setAdding(false)} />}
    </div>
  )
}
