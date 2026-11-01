import { useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { ColorDot } from '../../components/ui'
import { absenceUnits, ABSENCES, useAbsences, type Absence } from '../../lib/changes'
import { formatDate, parseISODate, toISODate } from '../../lib/dates'
import { halfYearOf, type HalfYear } from '../../lib/grades'
import { HalfYearPicker } from '../../components/HalfYearPicker'
import { useLookups } from '../../lib/models'
import { put, type Item } from '../../lib/repo'
import { useHalfYearSettings } from '../../lib/useHalfYears'
import { AbsenceSheet } from './AbsenceSheet'
import { t } from '../../lib/i18n'

export function AbsencesPage() {
  const settings = useHalfYearSettings()
  const all = useAbsences()
  const { subjectMap } = useLookups()
  const [selected, setHalf] = useState<HalfYear | null>(null)
  // Ohne Auswahl immer das aktuelle Halbjahr (neu berechnet, sobald die Ferien geladen sind)
  const half = selected ?? halfYearOf(toISODate(new Date()), settings)
  const [editing, setEditing] = useState<Item<Absence> | 'new' | null>(null)
  if (!all) return null

  const list = all.filter((a) => a.date >= half.start && a.date <= half.end).sort((a, b) => b.date.localeCompare(a.date))
  const total = list.reduce((s, a) => s + absenceUnits(a), 0)
  const openUnits = list.filter((a) => !a.excused).reduce((s, a) => s + absenceUnits(a), 0)
  const openEntries = list.filter((a) => !a.excused).length

  // Fehlstunden pro Fach
  const perSubject = new Map<string, number>()
  for (const a of list) for (const l of a.lessons) if (l.subjectId) perSubject.set(l.subjectId, (perSubject.get(l.subjectId) ?? 0) + l.units)

  async function toggleExcused(a: Item<Absence>) {
    const { id, ...data } = a
    await put<Absence>(ABSENCES, id, { ...data, excused: !a.excused })
  }

  return (
    <div className="page">
      <PageHeader title={t('Fehlstunden')} back={{ to: '/', label: t('Heute') }}>
        <button type="button" className="icon-btn" aria-label={t('Fehlstunden eintragen')} onClick={() => setEditing('new')}>
          +
        </button>
      </PageHeader>

      <HalfYearPicker value={half} settings={settings} onChange={setHalf} />

      <div className="stat-row">
        <div className="stat">
          <span className="stat-value">{total}</span>
          <span className="stat-label">{t('Fehlstunden')}</span>
        </div>
        <div className={`stat ${openUnits ? 'warn' : ''}`}>
          <span className="stat-value">{openUnits}</span>
          <span className="stat-label">
            {t('unentschuldigt')}
            {openEntries ? ` (${openEntries > 1 ? t('{n} Entschuldigungen offen', { n: openEntries }) : t('1 Entschuldigung offen')})` : ''}
          </span>
        </div>
      </div>

      {list.length === 0 && <p className="hint">{t('Keine Fehlstunden in diesem Halbjahr.')}</p>}

      {list.length > 0 && (
        <>
          <h2 className="section-title">{t('Einträge')}</h2>
          <div className="list">
            {list.map((a) => {
              const subjects = [...new Set(a.lessons.map((l) => (l.subjectId && subjectMap.get(l.subjectId)?.short) || '?'))]
              return (
                <div key={a.id} className="row" style={{ padding: 0 }}>
                  <button type="button" className="row" style={{ flex: 1 }} onClick={() => setEditing(a)}>
                    <span className="label">
                      {formatDate(parseISODate(a.date), { weekday: 'short', day: 'numeric', month: 'long' })} · {t('{n} Std.', { n: absenceUnits(a) })}
                      <span className="sub">
                        {a.reason} · {subjects.join(', ')}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`status-chip ${a.excused ? 'ok' : 'open'}`}
                    onClick={() => toggleExcused(a)}
                    title={t('Status umschalten')}
                  >
                    {a.excused ? t('entschuldigt') : t('offen')}
                  </button>
                </div>
              )
            })}
          </div>
          <p className="section-footer">{t('Tippe auf „offen“, sobald du die Entschuldigung abgegeben hast.')}</p>

          <h2 className="section-title">{t('Pro Fach')}</h2>
          <div className="list">
            {[...perSubject.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([id, n]) => {
                const s = subjectMap.get(id)
                return (
                  <div key={id} className="row">
                    <ColorDot color={s?.color ?? 'var(--outline)'} size={12} />
                    <span className="label">{s?.name ?? t('Fach gelöscht')}</span>
                    <span className="value">{t('{n} Std.', { n })}</span>
                  </div>
                )
              })}
          </div>
        </>
      )}

      {editing && <AbsenceSheet absence={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
