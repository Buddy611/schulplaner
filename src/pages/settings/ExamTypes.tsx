import { confirmDialog, promptDialog } from '../../components/dialogs'
import { PageHeader } from '../../components/PageHeader'
import { DEFAULT_SETTINGS, updateSettings, useSettings } from '../../lib/settings'
import { ResetButton } from '../../components/ui'
import { t } from '../../lib/i18n'

/** Arten von Leistungsüberprüfungen verwalten (Klausur, Test, Sprechprüfung, …) */
export function ExamTypesPage() {
  const settings = useSettings()
  const types = settings.examTypes
  const save = (examTypes: string[]) => updateSettings(settings, { examTypes })

  async function add() {
    const name = (await promptDialog(t('Neuer Typ'), { placeholder: t('z. B. Referat oder Vokabeltest'), confirm: t('Hinzufügen') }))?.trim()
    if (name && !types.includes(name)) void save([...types, name])
  }

  async function rename(old: string) {
    const name = (await promptDialog(t('Typ umbenennen'), { initial: old }))?.trim()
    if (name && name !== old && !types.includes(name)) void save(types.map((tp) => (tp === old ? name : tp)))
  }

  async function del(tp: string) {
    if (types.length > 1 && (await confirmDialog(t('„{name}“ entfernen? Bestehende Einträge behalten ihren Typ.', { name: t(tp) }), { confirm: t('Entfernen'), danger: true }))) void save(types.filter((x) => x !== tp))
  }

  return (
    <div className="page">
      <PageHeader title={t('Klausurtypen')} back={{ to: '/einstellungen', label: t('Einstellungen') }}>
        <button type="button" className="icon-btn" aria-label={t('Typ hinzufügen')} onClick={add}>
          +
        </button>
      </PageHeader>
      <div className="list">
        {types.map((tp) => (
          <div key={tp} className="row" style={{ padding: 0 }}>
            <button type="button" className="row" style={{ flex: 1 }} onClick={() => rename(tp)}>
              <span className="label">{t(tp)}</span>
            </button>
            {types.length > 1 && (
              <button type="button" className="link-btn" style={{ color: 'var(--red)', marginRight: 8 }} onClick={() => del(tp)}>
                {t('Entfernen')}
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="section-footer">{t('Tippe auf einen Typ, um ihn umzubenennen. Wie stark jeder Typ in die Note zählt, stellst du bei „Gewichtung & Halbjahre“ ein.')}</p>
      <ResetButton what={t('Die Klausurtypen')} onReset={() => save(DEFAULT_SETTINGS.examTypes)} />
    </div>
  )
}
