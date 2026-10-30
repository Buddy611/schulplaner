import { useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { Segmented } from '../../components/ui'
import { CHANGE_LABEL, useChanges, type LessonChange } from '../../lib/changes'
import { formatDate, parseISODate, toISODate } from '../../lib/dates'
import { periodTitle, sortPeriods, useActiveTimetable, useLookups } from '../../lib/models'
import type { Item } from '../../lib/repo'
import { ChangeSheet } from './ChangeSheet'

type Tab = 'kommend' | 'vorbei'

/** Übersicht "Vertretungen / Ausfälle" */
export function ChangesPage() {
  const all = useChanges()
  const { timetable } = useActiveTimetable()
  const { subjectMap, teacherMap, roomMap } = useLookups()
  const [tab, setTab] = useState<Tab>('kommend')
  const [editing, setEditing] = useState<Item<LessonChange> | 'new' | null>(null)
  if (!all) return null

  const today = toISODate(new Date())
  const list = all
    .filter((c) => (tab === 'kommend' ? c.date >= today : c.date < today))
    .sort((a, b) => (tab === 'kommend' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)))
  const periods = timetable ? sortPeriods(timetable.periods) : []
  const groups = new Map<string, Item<LessonChange>[]>()
  for (const c of list) groups.set(c.date, [...(groups.get(c.date) ?? []), c])

  // Geplantes Fach der Stunde (aus dem aktiven Stundenplan)
  function plannedSubject(c: LessonChange) {
    if (!timetable) return undefined
    const p = periods.find((x) => x.id === c.periodId)
    return p ? periodTitle(periods, p) : undefined
  }

  return (
    <div className="page">
      <PageHeader title="Vertretungen" back={{ to: '/stundenplan', label: 'Stundenplan' }}>
        <button type="button" className="icon-btn" aria-label="Änderung eintragen" onClick={() => setEditing('new')}>
          +
        </button>
      </PageHeader>
      <p className="subtitle">Ausfälle, Vertretungen und Raumänderungen</p>

      <div className="toolbar">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'kommend', label: 'Heute & später' },
            { value: 'vorbei', label: 'Vorbei' },
          ]}
        />
      </div>

      {list.length === 0 && (
        <p className="hint">
          {tab === 'kommend' ? 'Keine Änderungen eingetragen. Tippe auf + oder in der Tagesansicht auf „+ Ausfall / Vertretung“.' : 'Noch nichts.'}
        </p>
      )}

      {[...groups.entries()].map(([date, items]) => (
        <div key={date}>
          <h2 className="section-title">{formatDate(parseISODate(date), { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          <div className="list">
            {items.map((c) => {
              const subject = c.subjectId ? subjectMap.get(c.subjectId) : undefined
              const details = [
                c.kind === 'vertretung' && c.teacherId && `bei ${teacherMap.get(c.teacherId)?.name ?? '?'}`,
                subject && `Fach: ${subject.name}`,
                c.roomId && `Raum ${roomMap.get(c.roomId)?.name ?? '?'}`,
                c.note,
              ].filter(Boolean)
              return (
                <button key={c.id} type="button" className="row" onClick={() => setEditing(c)}>
                  <span className={`change-pill big ${c.kind}`}>{CHANGE_LABEL[c.kind]}</span>
                  <span className="label">
                    {plannedSubject(c) ?? 'Stunde'}
                    {details.length > 0 && <span className="sub">{details.join(' · ')}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {editing && <ChangeSheet change={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
