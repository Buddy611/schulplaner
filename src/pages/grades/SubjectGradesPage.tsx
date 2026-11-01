import { halfYearName } from '../../components/HalfYearPicker'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { WeightPicker } from '../../components/WeightPicker'
import { Segmented } from '../../components/ui'
import { formatDate, parseISODate } from '../../lib/dates'
import { convert, formatAverage, goalLabel, goalThreshold, history, KIND_LABEL, requiredGrade, type Goal, type Grade, type Part } from '../../lib/grades'
import { C, subjectCategory, type Subject } from '../../lib/models'
import { patch, type Item } from '../../lib/repo'
import { categoryWrittenPercent, useGradeData } from '../../lib/useGradeData'
import type { Settings } from '../../lib/settings'
import { GradeChart } from './GradeChart'
import { useHalfYearParam } from './GradesPage'
import { GradeSheet, type GradeDefaults } from './GradeSheet'
import { locale, t } from '../../lib/i18n'

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
        <PageHeader title={t('Fach')} back={{ to: `/noten${q}`, label: t('Noten') }} />
        <p className="hint">{t('Fach nicht gefunden.')}</p>
      </div>
    )
  }

  const { subject, result, writtenPercent } = row
  const sys = data.settings.gradeSystem

  return (
    <div className="page">
      <PageHeader title={subject.name} back={{ to: `/noten${q}`, label: t('Noten') }} />
      <p className="subtitle">{halfYearName(half)}</p>

      <div className="grade-hero" style={{ borderLeft: `6px solid ${subject.color}` }}>
        <div>
          <div className="hero-label">Aktueller Stand</div>
          <div className="grade-big">{formatAverage(result.total, sys)}</div>
        </div>
        <div className="grade-split">
          <span>
            {t('Schriftlich')} <strong>{formatAverage(result.written, sys)}</strong>
          </span>
          <span>
            {t('Mündlich')} <strong>{formatAverage(result.oral, sys)}</strong>
          </span>
        </div>
      </div>

      <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => setEditing({ defaults: { subjectId: subject.id } })}>
        + {t('Note eintragen')}
      </button>

      {result.besprechung && (
        <>
          <h2 className="section-title">{t('Zwischenstand')}</h2>
          <div className="list">
            {row.grades
              .filter((g) => g.kind === 'besprechung')
              .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
              .map((b) => {
                const current = b.id === result.besprechung!.id
                return (
                  <button key={b.id} type="button" className="row" style={current ? undefined : { opacity: 0.5 }} onClick={() => setEditing({ grade: b })}>
                    <span className="label">
                      {t('Notenbesprechung')}
                      <span className="sub">
                        {formatDate(parseISODate(b.date), { day: 'numeric', month: 'long' })} ·{' '}
                        {current
                          ? t('ersetzt alle Noten davor · zählt wie {n} Noten', { n: data.settings.besprechungWeight.toLocaleString(locale) })
                          : t('durch neuere Besprechung ersetzt')}
                      </span>
                    </span>
                    <span className="grade-chip accent">{b.label}</span>
                  </button>
                )
              })}
          </div>
        </>
      )}

      <h2 className="section-title">{result.besprechung ? t('Schriftlich seit der Besprechung') : t('Schriftlich')}</h2>
      <PartList parts={result.writtenParts} sys={sys} empty={t('Noch keine schriftlichen Noten.')} onOpen={(g) => setEditing({ grade: g })} />

      <h2 className="section-title">{result.besprechung ? t('Mündlich seit der Besprechung') : t('Mündlich')}</h2>
      <PartList parts={result.oralParts} sys={sys} empty={t('Noch keine mündlichen Noten.')} onOpen={(g) => setEditing({ grade: g })} />

      <h2 className="section-title">{t('Gewichtung schriftlich / mündlich')}</h2>
      <div className="list">
        <div className="row stack">
          <WeightPicker
            value={subject.writtenWeight}
            onChange={(writtenWeight) => void patch<Subject>(C.subjects, subject.id, { writtenWeight })}
            presets={[40, 50, 60]}
            standardLabel={t('Standard')}
          />
        </div>
      </div>
      <p className="section-footer">
        {t(subjectCategory(subject) === 'haupt' ? 'Standard für Hauptfächer ist {w} % schriftlich / {o} % mündlich (Einstellungen → Noten, Haupt-/Nebenfach unter Einstellungen → Fächer).' : 'Standard für Nebenfächer ist {w} % schriftlich / {o} % mündlich (Einstellungen → Noten, Haupt-/Nebenfach unter Einstellungen → Fächer).', {
          w: categoryWrittenPercent(subject, data.settings),
          o: 100 - categoryWrittenPercent(subject, data.settings),
        })}
      </p>

      <TargetCalculator key={sys} row={row} settings={data.settings} />

      <h2 className="section-title">{t('Verlauf')}</h2>
      <div className="card">
        <GradeChart points={history(row.grades, data.settings, writtenPercent)} system={sys} color={subject.color} />
      </div>

      <h2 className="section-title">{t('So wird gerechnet')}</h2>
      <div className="card explain">
        {result.explanation.length === 0 ? (
          <p className="muted">{t('Sobald du Noten einträgst, steht hier der Rechenweg.')}</p>
        ) : (
          result.explanation.map((line, i) => <p key={i}>{line}</p>)
        )}
        <p className="muted">
          {t('Gewichte: {list} – änderbar unter Einstellungen → Noten.', { list: Object.entries(data.settings.typeWeights).map(([tp, w]) => `${t(tp)} ×${w.toLocaleString(locale)}`).join(', ') })}
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
            {p.grade.kind === 'schriftlich' ? t(p.grade.type ?? 'Schriftlich') : KIND_LABEL[p.grade.kind]}
            <span className="sub">
              {formatDate(parseISODate(p.grade.date), { day: 'numeric', month: 'long' })}
              {p.weight !== 1 && ` · ${t('zählt ×{n}', { n: p.weight.toLocaleString(locale) })}`}
              {p.replaced && ` · ${t('durch Besprechung ersetzt')}`}
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

const MUENDLICH = '__muendlich'

/** Welche Noten brauche ich in den nächsten Arbeiten (eine oder mehrere) für mein Ziel? */
function TargetCalculator({ row, settings }: { row: ReturnType<typeof useGradeData>['rows'][number]; settings: Settings }) {
  const sys = settings.gradeSystem
  const goal = row.subject.goal
  // Ziel als Zeugnisnote ("eine 1") – oder, für Genaue, als Schnitt
  const [mode, setMode] = useState<'zeugnis' | 'schnitt'>(goal && goal.kind !== 'zeugnis' ? 'schnitt' : 'zeugnis')
  const [reportTarget, setReportTarget] = useState(() => {
    if (goal?.kind === 'zeugnis') return goal.system === sys ? goal.value : Math.round(convert(goal.value, goal.system, sys))
    return sys === 'punkte' ? 11 : 2
  })
  const [target, setTarget] = useState(goal && goal.kind !== 'zeugnis' ? String(Math.round(convert(goal.value, goal.system, sys) * 100) / 100).replace('.', ',') : sys === 'punkte' ? '11' : '2,0')
  // Wie viele Noten welcher Art kommen noch? (Klausurtypen + mündlich)
  const [counts, setCounts] = useState<Record<string, number>>({ [settings.examTypes[0] ?? MUENDLICH]: 1 })
  const kinds = [...settings.examTypes, MUENDLICH]
  const planned = kinds.flatMap((k) => Array<string | null>(counts[k] ?? 0).fill(k === MUENDLICH ? null : k))
  const exact = Number(target.replace(',', '.'))
  const chosen: Goal = mode === 'zeugnis' ? { value: reportTarget, system: sys, kind: 'zeugnis' } : { value: exact, system: sys, kind: 'schnitt' }
  const valid = mode === 'zeugnis' || (!Number.isNaN(exact) && (sys === 'punkte' ? exact >= 0 && exact <= 15 : exact >= 1 && exact <= 6))
  const tp = valid ? goalThreshold(chosen, sys) : NaN
  const reportOptions = sys === 'punkte' ? Array.from({ length: 15 }, (_, i) => 15 - i) : [1, 2, 3, 4, 5]
  const needed = valid && planned.length ? requiredGrade(row.grades, settings, row.writtenPercent, planned, tp) : null
  const unit = sys === 'punkte' ? ` ${t('Punkte')}` : ''
  const change = (k: string, d: number) => setCounts({ ...counts, [k]: Math.max(0, Math.min(10, (counts[k] ?? 0) + d)) })

  // Angezeigten Wert zur sicheren Seite runden (2,999 → 2,99), sonst stünde dort eine Note, die knapp nicht reicht
  const shown = (v: number) => formatAverage(sys === 'punkte' ? Math.ceil((v - 1e-7) * 10) / 10 : Math.floor((v + 1e-7) * 100) / 100, sys)
  let message = ''
  const one = planned.length === 1
  const goalText = mode === 'zeugnis' ? t('eine {grade} auf dem Zeugnis', { grade: goalLabel(chosen, sys) }) : t('einen Schnitt von {value}', { value: formatAverage(exact, sys) })
  if (needed === 'unreachable') message = t('{goal} ist leider nicht mehr erreichbar – selbst mit {best} reicht es nicht.', { goal: goalText[0].toUpperCase() + goalText.slice(1), best: sys === 'punkte' ? t('15 Punkten') : t('lauter Einsen') })
  else if (needed === 'safe') message = t('Schon sicher – selbst mit {worst} reicht es für {goal}.', { worst: sys === 'punkte' ? t('0 Punkten') : t('einer 6'), goal: goalText })
  else if (needed != null && one)
    message = t('Für {goal} brauchst du mindestens {value} in der nächsten {what}.', {
      goal: goalText,
      value: shown(needed) + unit,
      what: planned[0] ? t('Arbeit ({type})', { type: t(planned[0]) }) : t('mündlichen Note'),
    })
  else if (needed != null) message = t('Für {goal} brauchst du in den {n} Noten im Schnitt mindestens {value}.', { goal: goalText, n: planned.length, value: shown(needed) + unit })

  return (
    <>
      <h2 className="section-title">{t('Zielnoten-Rechner')}</h2>
      <div className="list">
        <div className="row stack">
          <Segmented<'zeugnis' | 'schnitt'>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'zeugnis', label: t('Zeugnisnote') },
              { value: 'schnitt', label: t('Genauer Schnitt') },
            ]}
          />
          {mode === 'zeugnis' ? (
            <>
              <span className="field-label" style={{ marginTop: 12 }}>
                {sys === 'punkte' ? t('Auf dem Zeugnis möchte ich mindestens …') : t('Auf dem Zeugnis möchte ich mindestens eine …')}
              </span>
              <div className="chips">
                {reportOptions.map((n) => (
                  <button key={n} type="button" className={`chip ${n === reportTarget ? 'active' : ''}`} onClick={() => setReportTarget(n)}>
                    {sys === 'punkte' ? `${n} P` : n}
                  </button>
                ))}
              </div>
              <span className="muted" style={{ fontSize: '0.8125rem' }}>
                {sys === 'punkte'
                  ? t('Dafür muss der Schnitt mindestens {value} sein (gerundet wie auf dem Zeugnis).', { value: formatAverage(reportTarget - 0.5, sys) })
                  : t('Dafür muss der Schnitt unter {value} sein (gerundet wie auf dem Zeugnis).', { value: formatAverage(reportTarget + 0.5, sys) })}
              </span>
            </>
          ) : (
            <>
              <span className="field-label" style={{ marginTop: 12 }}>
                {t('Ich möchte im Fach einen Schnitt von …')}
              </span>
              <input className="input" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={sys === 'punkte' ? 'z. B. 11' : 'z. B. 2,0'} />
            </>
          )}
          <span className="field-label" style={{ marginTop: 12 }}>
            {t('Bis zum Halbjahresende kommen noch:')}
          </span>
          <div className="planned-list">
            {kinds.map((k) => (
              <div key={k} className={`planned-row ${counts[k] ? 'active' : ''}`}>
                <span>{k === MUENDLICH ? t('Mündlich') : t(k)}</span>
                <button type="button" className="arrow-btn" aria-label={t('Eine weniger: {kind}', { kind: k === MUENDLICH ? t('Mündlich') : t(k) })} disabled={!counts[k]} onClick={() => change(k, -1)}>
                  −
                </button>
                <strong>{counts[k] ?? 0}</strong>
                <button type="button" className="arrow-btn" aria-label={t('Eine mehr: {kind}', { kind: k === MUENDLICH ? t('Mündlich') : t(k) })} onClick={() => change(k, 1)}>
                  +
                </button>
              </div>
            ))}
          </div>
          {valid && planned.length === 0 && <p className="target-result">{t('Wähle oben mindestens eine kommende Note.')}</p>}
          {message && <p className="target-result">{message}</p>}
          {valid && (
            <div className="goal-row">
              <span className="muted">
                {goal ? (goal.kind === 'zeugnis' ? t('Gespeichertes Ziel: Zeugnis {goal}', { goal: goalLabel(goal, sys) }) : t('Gespeichertes Ziel: Schnitt {goal}', { goal: goalLabel(goal, sys) })) : t('Kein Ziel gespeichert')}
              </span>
              <button type="button" className="link-btn strong" onClick={() => patch<Subject>(C.subjects, row.subject.id, { goal: chosen })}>
                {t('Als Ziel speichern')}
              </button>
              {goal && (
                <button type="button" className="link-btn" onClick={() => patch<Subject>(C.subjects, row.subject.id, { goal: undefined })}>
                  {t('Entfernen')}
                </button>
              )}
            </div>
          )}
          {!valid && <p className="error-text">{sys === 'punkte' ? t('Bitte eine Zahl von 0 bis 15 eingeben.') : t('Bitte eine Zahl von 1 bis 6 eingeben.')}</p>}
        </div>
      </div>
      <p className="section-footer">
        {t('Rechnet mit allen bisherigen Noten in diesem Halbjahr inklusive Zwischenstand und Gewichtung. Bei mehreren Noten ist es der Wert, den du in jeder davon brauchst – ist eine besser, darf eine andere schlechter sein.')}
      </p>
    </>
  )
}
