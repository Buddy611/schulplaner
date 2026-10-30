import { halfYearName } from '../../components/HalfYearPicker'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { Segmented } from '../../components/ui'
import { formatDate, parseISODate } from '../../lib/dates'
import { formatAverage, history, KIND_LABEL, requiredGrade, type Grade, type Part } from '../../lib/grades'
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
  
  function setWeight(v: string) {
    void patch<Subject>(C.subjects, subject.id, { writtenWeight: v === 'standard' ? undefined : Number(v) })
  }

  return (
    <div className="page">
      <PageHeader title={subject.name} back={{ to: `/noten${q}`, label: 'Noten' }} />
      <p className="subtitle">{halfYearName(half)}</p>

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

      <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => setEditing({ defaults: { subjectId: subject.id } })}>
        + Note eintragen
      </button>

      {result.besprechung && (
        <>
          <h2 className="section-title">Zwischenstand</h2>
          <div className="list">
            {row.grades
              .filter((g) => g.kind === 'besprechung')
              .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
              .map((b) => {
                const current = b.id === result.besprechung!.id
                return (
                  <button key={b.id} type="button" className="row" style={current ? undefined : { opacity: 0.5 }} onClick={() => setEditing({ grade: b })}>
                    <span className="label">
                      Notenbesprechung
                      <span className="sub">
                        {formatDate(parseISODate(b.date), { day: 'numeric', month: 'long' })} ·{' '}
                        {current
                          ? `ersetzt alle Noten davor · zählt wie ${data.settings.besprechungWeight.toLocaleString('de-DE')} Noten`
                          : 'durch neuere Besprechung ersetzt'}
                      </span>
                    </span>
                    <span className="grade-chip accent">{b.label}</span>
                  </button>
                )
              })}
          </div>
        </>
      )}

      <h2 className="section-title">{result.besprechung ? 'Schriftlich seit der Besprechung' : 'Schriftlich'}</h2>
      <PartList parts={result.writtenParts} sys={sys} empty="Noch keine schriftlichen Noten." onOpen={(g) => setEditing({ grade: g })} />

      <h2 className="section-title">{result.besprechung ? 'Mündlich seit der Besprechung' : 'Mündlich'}</h2>
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
  const needed = valid ? requiredGrade(row.grades, settings, row.writtenPercent, type === '__muendlich' ? null : type, t) : null
  const label = type === '__muendlich' ? 'mündlichen Note' : `nächsten Arbeit (${type})`

  let message = ''
  if (needed === 'unreachable') message = `Leider nicht mehr erreichbar – selbst mit ${sys === 'punkte' ? '15 Punkten' : 'einer 1'} reicht es nicht.`
  else if (needed === 'safe') message = `Schon sicher – selbst mit ${sys === 'punkte' ? '0 Punkten' : 'einer 6'} bleibst du bei ${formatAverage(t, sys)} oder besser.`
  else if (needed != null) message = `Du brauchst mindestens ${formatAverage(needed, sys)}${sys === 'punkte' ? ' Punkte' : ''} in der ${label}.`

  return (
    <>
      <h2 className="section-title">Zielnoten-Rechner</h2>
      <div className="list">
        <div className="row stack">
          <span className="field-label">Ich möchte im Fach auf …</span>
          <input className="input" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={sys === 'punkte' ? 'z. B. 11' : 'z. B. 2,0'} />
          <span className="field-label" style={{ marginTop: 12 }}>
            … kommen. Nächste Note:
          </span>
          <div className="chips">
            {settings.examTypes.map((x) => (
              <button key={x} type="button" className={`chip ${x === type ? 'active' : ''}`} onClick={() => setType(x)}>
                {x}
              </button>
            ))}
            <button type="button" className={`chip ${type === '__muendlich' ? 'active' : ''}`} onClick={() => setType('__muendlich')}>
              Mündlich
            </button>
          </div>
          {message && <p className="target-result">{message}</p>}
          {!valid && <p className="error-text">Bitte eine Zahl {sys === 'punkte' ? 'von 0 bis 15' : 'von 1 bis 6'} eingeben.</p>}
        </div>
      </div>
      <p className="section-footer">Rechnet mit allen bisherigen Noten in diesem Halbjahr inklusive Zwischenstand und Gewichtung.</p>
    </>
  )
}
