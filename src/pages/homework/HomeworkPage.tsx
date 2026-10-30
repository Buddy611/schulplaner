import { useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { useSnackbar } from '../../components/Snackbar'
import { Segmented } from '../../components/ui'
import { currentSubjectId, dayHeading, daysUntil, openHomework, setDone, useHomework, type Homework } from '../../lib/homework'
import { useLookups } from '../../lib/models'
import type { Item } from '../../lib/repo'
import { useSchedule } from '../../lib/schedule'
import { HomeworkRow } from './HomeworkCard'
import { HomeworkSheet, type HomeworkDefaults } from './HomeworkSheet'

type Tab = 'offen' | 'erledigt'

/** Gruppiert Hausaufgaben nach Fälligkeitstag */
function groupByDay(list: Item<Homework>[]) {
  const groups = new Map<string, Item<Homework>[]>()
  for (const h of list) groups.set(h.dueDate, [...(groups.get(h.dueDate) ?? []), h])
  return [...groups.entries()]
}

export function HomeworkPage() {
  const all = useHomework()
  const schedule = useSchedule()
  const { subjectMap } = useLookups()
  const [tab, setTab] = useState<Tab>('offen')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<{ hw?: Item<Homework>; defaults?: HomeworkDefaults } | null>(null)
  const snackbar = useSnackbar()

  if (!all) return null
  const open = openHomework(all)
  const q = query.trim().toLowerCase()
  const matches = (h: Homework) =>
    !q || [h.title, h.notes, subjectMap.get(h.subjectId)?.name].some((t) => t?.toLowerCase().includes(q))

  const list =
    tab === 'offen'
      ? open.filter(matches)
      : all
          .filter((h) => h.done && matches(h))
          .sort((a, b) => b.dueDate.localeCompare(a.dueDate) || (b.doneAt ?? 0) - (a.doneAt ?? 0))

  const overdue = tab === 'offen' ? list.filter((h) => daysUntil(h.dueDate) < 0) : []
  const rest = tab === 'offen' ? list.filter((h) => daysUntil(h.dueDate) >= 0) : list

  async function toggle(h: Item<Homework>) {
    await setDone(h, !h.done)
    if (!h.done) snackbar.show('Erledigt', { label: 'Rückgängig', run: () => void setDone({ ...h, done: true }, false) })
  }

  function addNew() {
    // Schnell-Eintrag: läuft gerade eine Stunde, ist ihr Fach schon ausgewählt
    setEditing({ defaults: { subjectId: currentSubjectId(schedule) } })
  }

  return (
    <div className="page">
      <PageHeader title="Hausaufgaben">
        <button type="button" className="icon-btn" aria-label="Hausaufgabe hinzufügen" onClick={addNew}>
          +
        </button>
      </PageHeader>
      <p className="subtitle">
        {open.length === 0 ? 'Alles erledigt' : `${open.length} offene Hausaufgabe${open.length > 1 ? 'n' : ''}`}
      </p>

      <div className="toolbar">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'offen', label: 'Offen' },
            { value: 'erledigt', label: 'Erledigt' },
          ]}
        />
      </div>
      <input className="input search" type="search" placeholder="Suchen" value={query} onChange={(e) => setQuery(e.target.value)} />

      {list.length === 0 && (
        <p className="hint">
          {q ? 'Nichts gefunden.' : tab === 'offen' ? 'Keine offenen Hausaufgaben. Tippe auf +, um eine einzutragen.' : 'Noch nichts erledigt.'}
        </p>
      )}

      {overdue.length > 0 && (
        <>
          <h2 className="section-title overdue">Überfällig</h2>
          <div className="list">
            {overdue.map((h) => (
              <HomeworkRow key={h.id} hw={h} onToggle={() => toggle(h)} onOpen={() => setEditing({ hw: h })} />
            ))}
          </div>
        </>
      )}

      {groupByDay(rest).map(([day, items]) => (
        <div key={day}>
          <h2 className="section-title">{dayHeading(day)}</h2>
          <div className="list">
            {items.map((h) => (
              <HomeworkRow key={h.id} hw={h} onToggle={() => toggle(h)} onOpen={() => setEditing({ hw: h })} />
            ))}
          </div>
        </div>
      ))}

      {editing && <HomeworkSheet homework={editing.hw} defaults={editing.defaults} onClose={() => setEditing(null)} />}
      {snackbar.element}
    </div>
  )
}
