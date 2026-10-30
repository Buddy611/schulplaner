import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { Segmented } from '../../components/ui'
import { formatDate, parseISODate } from '../../lib/dates'
import { better, formatAverage, history, KIND_LABEL, requiredWrittenGrade, type Grade, type GradeKind, type Part } from '../../lib/grades'
import { C, type Subject } from '../../lib/models'
import { patch, type Item } from '../../lib/repo'
import { useGradeData } from '../../lib/useGradeData'
import type { Settings } from '../../lib/settings'
import { GradeChart } from './GradeChart'
import { useHalfYearParam } from './GradesPage'
import { GradeSheet, type GradeDefaults } from './GradeSheet'

export function SubjectGradesPage() {
  const { subjectId } = useParams()
  const { half } = useHalfYearParam()
  const data = useGradeData(half)
  const [editing, setEditing] = useState<{ grade?: Item<Grade>; defaults?: GradeDefaults } | null>(null)
  const [params] = useSearchParams()
  if (!data.loaded) return null
  const row = data.rows.find((r) => r.subject.id === subjectId)
  const q = params.get('hj') ? `?hj=${params.get('hj')}` : ''
  if (!row) {
    return (
      <div className="page">
        <PageHeader title="Fach" back={{ to: `/noten${q}`, label: 'Noten' }} />
        <p className="hint">Fach nicht gefunden.</p>
      </div>
    )
  }

  const { subject, result, writtenPercent } = row
  const sys = data.settings.gradeSystem
  const usesDefault = subject.writtenWeight == null
  const add = (kind: GradeKind) => setEditing({ defaults: { subjectId: subject.id, kind } })

  function setWeight(v: string) {
    void patch<Subject>(C.subjects, subject.id, { writtenWeight: v === 'standard' ? undefined : Number(v) })
  }

  return (
    <div className="page">
      <PageHeader title={subject.name} back={{ to: `/noten${q}`, label: 'Noten' }} />
      <p className="subtitle">{half.label}</p>

      <div className="grade-hero" style={{ borderLeft: `6px solid ${subject.color}` }}>
        <div>
          <div className="hero-label">Aktueller Stand</div>
          <div className="grade-big">{formatAverage(result.total, sys)}</div>
        </div>
        <div className="grade-split">
          <span>
            Schriftlich <strong>{formatAverage(result.written, sys)}</strong>
          </span>
          <span>
            Mündlich <strong>{formatAverage(result.oral, sys)}</strong>
          </span>
        </div>
      </div>

      <div className="btn-row" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn secondary" style={{ flex: 1 }} onClick={() => add('schriftlich')}>
          + Schriftlich
        </button>
        <button type="button" className="btn secondary" style={{ flex: 1 }} onClick={() => add('muendlich')}>
          + Mündlich
        </button>
        <button type="button" className="btn secondary" style={{ flex: '1 1 100%' }} onClick={() => add('besprechung')}>
          + Notenbesprechung
        </button>
      </div>

      <h2 className="section-title">Schriftlich</h2>
      <PartList parts={result.writtenParts} sys={sys} empty="Noch keine schriftlichen Noten." onOpen={(g) => setEditing({ grade: g })} />

      <h2 className="section-title">Mündlich</h2>
      <PartList parts={result.oralParts} sys={sys} empty="Noch keine mündlichen Noten." onOpen={(g) => setEditing({ grade: g })} />

      <h2 className="section-title">Gewichtung schriftlich / mündlich</h2>
      <div className="list">
        <div className="row stack">
          <Segmented<string>
            value={usesDefault ? 'standard' : String(subject.writtenWeight)}
            onChange={setWeight}
            options={[
              { value: 'standard', label: 'Standard' },
              { value: '40', label: '40/60' },
              { value: '50', label: '50/50' },
              { value: '60', label: '60/40' },
              { value: '70', label: '70/30' },
            ]}
          />
        </div>
      </div>
      <p className="section-footer">
        Standard ist {data.settings.writtenWeight} % schriftlich / {100 - data.settings.writtenWeight} % mündlich (Einstellungen → Noten).
      </p>

      <TargetCalculator key={sys} row={row} settings={data.settings} />

      <h2 className="section-title">Verlauf</h2>
      <div className="card">
        <GradeChart points={history(row.grades, data.settings, writtenPercent)} system={sys} color={subject.color} />
      </div>

      <h2 className="section-title">So wird gerechnet</h2>
      <div className="card explain">
        {result.explanation.length === 0 ? (
          <p className="muted">Sobald du Noten einträgst, steht hier der Rechenweg.</p>
        ) : (
          result.explanation.map((line, i) => <p key={i}>{line}</p>)
        )}
        <p className="muted">
          Gewichte: {Object.entries(data.settings.typeWeights).map(([t, w]) => `${t} ×${w.toLocaleString('de-DE')}`).join(', ')} – änderbar unter Einstellungen → Noten.
        </p>
      </div>

      {editing && <GradeSheet grade={editing.grade} defaults={editing.defaults} onClose={() => setEditing(null)} />}
    </div>
  )
}

function PartList({ parts, sys, empty, onOpen }: { parts: Part[]; sys: 'noten' | 'punkte'; empty: string; onOpen: (g: Item<Grade>) => void }) {
  if (parts.length === 0) return <p className="section-footer">{empty}</p>
  return (
    <div className="list">
      {[...parts].reverse().map((p) => (
        <button key={p.grade.id} type="button" className="row" style={p.replaced ? { opacity: 0.5 } : undefined} onClick={() => onOpen(p.grade)}>
          <span className="label">
            {p.grade.kind === 'schriftlich' ? p.grade.type ?? 'Schriftlich' : KIND_LABEL[p.grade.kind]}
            <span className="sub">
              {formatDate(parseISODate(p.grade.date), { day: 'numeric', month: 'long' })}
              {p.weight !== 1 && ` · zählt ×${p.weight.toLocaleString('de-DE')}`}
              {p.replaced && ' · durch Besprechung ersetzt'}
              {p.grade.note && ` · ${p.grade.note}`}
            </span>
          </span>
          <span className={`grade-chip ${p.grade.kind === 'besprechung' ? 'accent' : ''}`}>{p.grade.label}</span>
          {p.grade.system !== sys && <span className="value">≈ {formatAverage(p.value, sys)}</span>}
        </button>
      ))}
    </div>
  )
}

/** Welche Note brauche ich in der nächsten schriftlichen Arbeit für mein Ziel? */
function TargetCalculator({ row, settings }: { row: ReturnType<typeof useGradeData>['rows'][number]; settings: Settings }) {
  const sys = settings.gradeSystem
  const [target, setTarget] = useState(sys === 'punkte' ? '11' : '2,0')
  const [type, setType] = useState(settings.examTypes[0])
  const t = Number(target.replace(',', '.'))
  const valid = !Number.isNaN(t) && (sys === 'punkte' ? t >= 0 && t <= 15 : t >= 1 && t <= 6)
  const typeWeight = settings.typeWeights[type] ?? 1
  const needed = valid ? requiredWrittenGrade(row.result, t, typeWeight, row.writtenPercent) : null
  const [best, worst] = sys === 'punkte' ? [15, 0] : [1, 6]

  let message = ''
  if (needed != null) {
    if (better(needed, best, sys) && needed !== best) message = `Leider nicht mehr erreichbar – selbst mit ${sys === 'punkte' ? '15 Punkten' : 'einer 1'} reicht es nicht.`
    else if (!better(needed, worst, sys)) message = `Schon sicher – selbst mit ${sys === 'punkte' ? '0 Punkten' : 'einer 6'} bleibst du bei ${formatAverage(t, sys)} oder besser.`
    else message = `Du brauchst mindestens ${formatAverage(needed, sys)}${sys === 'punkte' ? ' Punkte' : ''} in der nächsten Arbeit (${type}).`
  }

  return (
    <>
      <h2 className="section-title">Zielnoten-Rechner</h2>
      <div className="list">
        <div className="row stack">
          <span className="field-label">Ich möchte im Fach auf …</span>
          <input className="input" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={sys === 'punkte' ? 'z. B. 11' : 'z. B. 2,0'} />
          <span className="field-label" style={{ marginTop: 12 }}>
            … kommen. Nächste Arbeit:
          </span>
          <div className="chips">
            {settings.examTypes.map((x) => (
              <button key={x} type="button" className={`chip ${x === type ? 'active' : ''}`} onClick={() => setType(x)}>
                {x}
              </button>
            ))}
          </div>
          {message && <p className="target-result">{message}</p>}
          {!valid && <p className="error-text">Bitte eine Zahl {sys === 'punkte' ? 'von 0 bis 15' : 'von 1 bis 6'} eingeben.</p>}
        </div>
      </div>
      <p className="section-footer">Rechnet mit deinen bisherigen Noten in diesem Halbjahr; mündliche Noten bleiben wie sie sind.</p>
    </>
  )
}
