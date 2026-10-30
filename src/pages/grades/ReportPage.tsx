import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { ColorDot } from '../../components/ui'
import { formatAverage, reportGrade } from '../../lib/grades'
import { useGradeData } from '../../lib/useGradeData'
import { useHalfYearParam } from './GradesPage'

/** Alle Fächer mit voraussichtlicher Zeugnisnote auf einen Blick */
export function ReportPage() {
  const { half, set } = useHalfYearParam()
  const data = useGradeData(half)
  const [params] = useSearchParams()
  if (!data.loaded) return null
  const sys = data.settings.gradeSystem
  const q = params.get('hj') ? `?hj=${params.get('hj')}` : ''

  return (
    <div className="page">
      <PageHeader title="Zeugnis-Vorschau" back={{ to: `/noten${q}`, label: 'Noten' }} />
      <div className="date-nav">
        <button type="button" className="nav-btn" aria-label="Vorheriges Halbjahr" onClick={() => set(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="date-label">{half.label}</div>
        <button type="button" className="nav-btn" aria-label="Nächstes Halbjahr" onClick={() => set(1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="report">
        <div className="report-head">
          <span>Fach</span>
          <span>Schnitt</span>
          <span>Zeugnis</span>
        </div>
        {data.rows.map(({ subject, result }) => (
          <div key={subject.id} className="report-row">
            <span className="report-subject">
              <ColorDot color={subject.color} size={10} />
              {subject.name}
            </span>
            <span className="muted">{formatAverage(result.total, sys)}</span>
            <span className="report-grade">{reportGrade(result.total, sys)}</span>
          </div>
        ))}
        <div className="report-row total">
          <span className="report-subject">Durchschnitt</span>
          <span className="muted">{formatAverage(data.average, sys)}</span>
          <span className="report-grade">
            {data.withTotal.length
              ? formatAverage(
                  data.withTotal.reduce((s, r) => s + Number(reportGrade(r.result.total, sys).replace(' P', '')), 0) / data.withTotal.length,
                  sys,
                )
              : '–'}
          </span>
        </div>
      </div>
      <p className="section-footer">
        Zeugnisnoten sind hier mathematisch gerundet. Die endgültige Note legt die Lehrkraft fest – sie kann z. B. die Entwicklung im Halbjahr
        berücksichtigen. Der Durchschnitt rechts ist der Schnitt der gerundeten Zeugnisnoten.
      </p>
    </div>
  )
}
