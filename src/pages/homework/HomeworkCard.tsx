import { useLookups, periodTitle, sortPeriods, useActiveTimetable } from '../../lib/models'
import { dueLabel, daysUntil, type Homework } from '../../lib/homework'
import type { Item } from '../../lib/repo'
import { t } from '../../lib/i18n'

/** Eine Hausaufgabe als Listenzeile mit Kreis zum Abhaken */
export function HomeworkRow({
  hw,
  onToggle,
  onOpen,
  showDue = true,
}: {
  hw: Item<Homework>
  onToggle: () => void
  onOpen: () => void
  showDue?: boolean
}) {
  const { subjectMap } = useLookups()
  const { timetable } = useActiveTimetable()
  const subject = subjectMap.get(hw.subjectId)
  const color = subject?.color ?? 'var(--outline)'
  const period = hw.duePeriodId && timetable?.periods.find((p) => p.id === hw.duePeriodId)
  const overdue = !hw.done && daysUntil(hw.dueDate) < 0

  return (
    <div className="hw-row">
      <button
        type="button"
        className={`hw-check ${hw.done ? 'done' : ''}`}
        style={{ borderColor: color, background: hw.done ? color : undefined }}
        aria-label={hw.done ? 'Als offen markieren' : 'Als erledigt markieren'}
        onClick={onToggle}
      >
        {hw.done && '✓'}
      </button>
      <button type="button" className="hw-body" onClick={onOpen}>
        <span className="hw-top">
          <span className="hw-subject">{subject?.name ?? t('Fach gelöscht')}</span>
          {period && timetable && (
            <span className="hw-time">
              {periodTitle(sortPeriods(timetable.periods), period)} · {period.start}
            </span>
          )}
        </span>
        <span className={`hw-title ${hw.done ? 'striked' : ''}`}>{hw.title}</span>
        {hw.notes && <span className="hw-notes">{hw.notes}</span>}
        <span className="hw-meta">
          {showDue && <span className={overdue ? 'overdue' : ''}>{hw.done ? t('Erledigt') : dueLabel(hw.dueDate)}</span>}
          {hw.attachments?.length > 0 && <span>· {t('{n} Anhang', { n: hw.attachments.length })}</span>}
          {hw.repeatWeekly && <span>· {t('jede Woche')}</span>}
        </span>
      </button>
    </div>
  )
}
