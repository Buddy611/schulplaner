import { PageHeader } from '../../components/PageHeader'
import { updateSettings, useSettings } from '../../lib/settings'

/** Arten von Leistungsüberprüfungen verwalten (Klausur, Test, Sprechprüfung, …) */
export function ExamTypesPage() {
  const settings = useSettings()
  const types = settings.examTypes
  const save = (examTypes: string[]) => updateSettings(settings, { examTypes })

  function add() {
    const name = prompt('Neuer Typ, z. B. „Referat“ oder „Vokabeltest“')?.trim()
    if (name && !types.includes(name)) void save([...types, name])
  }

  function rename(old: string) {
    const name = prompt('Typ umbenennen', old)?.trim()
    if (name && name !== old && !types.includes(name)) void save(types.map((t) => (t === old ? name : t)))
  }

  function del(t: string) {
    if (types.length > 1 && confirm(`„${t}“ entfernen? Bestehende Einträge behalten ihren Typ.`)) void save(types.filter((x) => x !== t))
  }

  return (
    <div className="page">
      <PageHeader title="Klausurtypen" back={{ to: '/einstellungen', label: 'Einstellungen' }}>
        <button type="button" className="icon-btn" aria-label="Typ hinzufügen" onClick={add}>
          +
        </button>
      </PageHeader>
      <div className="list">
        {types.map((t) => (
          <div key={t} className="row" style={{ padding: 0 }}>
            <button type="button" className="row" style={{ flex: 1 }} onClick={() => rename(t)}>
              <span className="label">{t}</span>
            </button>
            {types.length > 1 && (
              <button type="button" className="link-btn" style={{ color: 'var(--red)', marginRight: 8 }} onClick={() => del(t)}>
                Entfernen
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="section-footer">Tippe auf einen Typ, um ihn umzubenennen. Wie stark jeder Typ in die Note zählt, stellst du später bei den Noten ein.</p>
    </div>
  )
}
