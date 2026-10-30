import { confirmDialog, promptDialog } from '../../components/dialogs'
import { PageHeader } from '../../components/PageHeader'
import { DEFAULT_SETTINGS, updateSettings, useSettings } from '../../lib/settings'
import { ResetButton } from '../../components/ui'

/** Arten von Leistungsüberprüfungen verwalten (Klausur, Test, Sprechprüfung, …) */
export function ExamTypesPage() {
  const settings = useSettings()
  const types = settings.examTypes
  const save = (examTypes: string[]) => updateSettings(settings, { examTypes })

  async function add() {
    const name = (await promptDialog('Neuer Typ', { placeholder: 'z. B. Referat oder Vokabeltest', confirm: 'Hinzufügen' }))?.trim()
    if (name && !types.includes(name)) void save([...types, name])
  }

  async function rename(old: string) {
    const name = (await promptDialog('Typ umbenennen', { initial: old }))?.trim()
    if (name && name !== old && !types.includes(name)) void save(types.map((t) => (t === old ? name : t)))
  }

  async function del(t: string) {
    if (types.length > 1 && (await confirmDialog(`„${t}“ entfernen? Bestehende Einträge behalten ihren Typ.`, { confirm: 'Entfernen', danger: true }))) void save(types.filter((x) => x !== t))
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
      <p className="section-footer">Tippe auf einen Typ, um ihn umzubenennen. Wie stark jeder Typ in die Note zählt, stellst du bei „Gewichtung & Halbjahre“ ein.</p>
      <ResetButton what="Die Klausurtypen" onReset={() => save(DEFAULT_SETTINGS.examTypes)} />
    </div>
  )
}
