import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { ColorDot } from '../../components/ui'
import { formatAverage, reportGrade } from '../../lib/grades'
import { useGradeData } from '../../lib/useGradeData'
import { useHalfYearParam } from './GradesPage'
import { HalfYearPicker } from '../../components/HalfYearPicker'
import { t } from '../../lib/i18n'

/** Alle Fächer mit voraussichtlicher Zeugnisnote auf einen Blick */
export function ReportPage() {
  const { half, select, settings: halfSettings } = useHalfYearParam()
  const data = useGradeData(half)
  const [params] = useSearchParams()
  if (!data.loaded) return null
  const sys = data.settings.gradeSystem
  const q = params.get('hj') ? `?hj=${params.get('hj')}` : ''

  return (
    <div className="page">
      <PageHeader title={t('Zeugnis-Vorschau')} back={{ to: `/noten${q}`, label: t('Noten') }}>
        <button type="button" className="link-btn no-print" onClick={() => window.print()}>
          PDF
        </button>
      </PageHeader>
      <HalfYearPicker value={half} settings={halfSettings} onChange={select} />

      <div className="report">
        <div className="report-head">
          <span>{t('Fach')}</span>
          <span>{t('Schnitt')}</span>
          <span>{t('Zeugnis')}</span>
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
          <span className="report-subject">{t('Durchschnitt')}</span>
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
        {t('Zeugnisnoten sind hier mathematisch gerundet. Die endgültige Note legt die Lehrkraft fest – sie kann z. B. die Entwicklung im Halbjahr berücksichtigen. Der Durchschnitt rechts ist der Schnitt der gerundeten Zeugnisnoten.')}
      </p>
    </div>
  )
}
