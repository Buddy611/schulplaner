import { IconBubble } from '../components/Icons'
import { PageHeader } from '../components/PageHeader'
import { usePendingCount } from '../components/StatusPill'
import { LinkRow, Segmented } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useActiveTimetable, useLookups } from '../lib/models'
import { STATES, updateSettings, useSettings, type Settings as SettingsType } from '../lib/settings'
import { useSyncState } from '../lib/sync'
import { t } from '../lib/i18n'

/** Einstellungen im Stil der Android-Einstellungen: Kategorien mit farbigen Symbolen */
export function Settings() {
  const settings = useSettings()
  const { timetable, all: timetables } = useActiveTimetable()
  const { subjects, teachers, rooms } = useLookups()
  const { user } = useAuth()
  const sync = useSyncState()
  const pending = usePendingCount()
  const set = (changes: Partial<SettingsType>) => updateSettings(settings, changes)
  const lessonCount = timetable?.periods.filter((p) => p.kind === 'lesson').length ?? 0
  const stateName = !settings.country ? STATES.find((s) => s.code === settings.state)?.name : (settings.regionName ?? settings.country)
  const themeName = { system: t('System'), light: t('Hell'), dark: t('Dunkel') }[settings.theme]

  return (
    <div className="page">
      <PageHeader title={t('Einstellungen')} settingsButton={false} />

      <div className="list settings-group">
        <LinkRow
          to="/einstellungen/stundenplaene"
          icon="calendar"
          tone="blue"
          sub={timetable ? `${timetable.name}${timetables && timetables.length > 1 ? ` · ${t('{n} Pläne', { n: timetables.length })}` : ''}` : t('Noch keiner angelegt')}
        >
          {t('Stundenpläne')}
        </LinkRow>
        <LinkRow to="/einstellungen/zeitraster" icon="clock" tone="blue" sub={lessonCount ? t('{n} Stunden, Pausen', { n: lessonCount }) : t('Stunden und Pausen')}>
          {t('Zeitraster')}
        </LinkRow>
      </div>

      <div className="list settings-group">
        <LinkRow
          to="/einstellungen/faecher"
          icon="book"
          tone="cyan"
          sub={subjects.length ? (subjects.length === 1 ? t('1 Fach, Farben') : t('{n} Fächer, Farben', { n: subjects.length })) : t('Fächer und Farben anlegen')}
        >
          {t('Fächer')}
        </LinkRow>
        <LinkRow to="/einstellungen/lehrer" icon="person" tone="cyan" sub={teachers.length ? t('{n} Lehrer', { n: teachers.length }) : t('Noch keine')}>
          {t('Lehrer')}
        </LinkRow>
        <LinkRow to="/einstellungen/raeume" icon="door" tone="teal" sub={rooms.length ? (rooms.length === 1 ? t('1 Raum') : t('{n} Räume', { n: rooms.length })) : t('Noch keine')}>
          {t('Räume')}
        </LinkRow>
      </div>

      <div className="list settings-group">
        <div className="row with-icon stack-icon">
          <IconBubble name="grade" tone="green" />
          <span className="label">
            <span className="row-title">{t('Notensystem')}</span>
            <div style={{ marginTop: 10 }}>
              <Segmented<SettingsType['gradeSystem']>
                value={settings.gradeSystem}
                onChange={(gradeSystem) => set({ gradeSystem })}
                options={[
                  { value: 'noten', label: t('Noten 1–6') },
                  { value: 'punkte', label: t('Punkte 0–15') },
                ]}
              />
            </div>
          </span>
        </div>
        <LinkRow to="/einstellungen/noten" icon="tune" tone="green" sub={t('Schriftlich/mündlich, Notenbesprechung, Halbjahre')}>
          {t('Gewichtung & Halbjahre')}
        </LinkRow>
        <LinkRow to="/einstellungen/klausurtypen" icon="exam" tone="lime" sub={settings.examTypes.map((x) => t(x)).join(', ')}>
          {t('Klausurtypen')}
        </LinkRow>
      </div>

      <div className="list settings-group">
        <LinkRow to="/einstellungen/ferien" icon="sun" tone="yellow" sub={stateName ? `${stateName} · ${t('Ferien, Feiertage, freie Tage')}` : t('Bundesland wählen')}>
          {t('Ferien & Feiertage')}
        </LinkRow>
        <LinkRow
          to="/einstellungen/benachrichtigungen"
          icon="bell"
          tone="orange"
          sub={settings.notifications.enabled ? t('An · {time} Uhr', { time: settings.notifications.time }) : t('Erinnerungen an Hausaufgaben und Klausuren')}
        >
          {t('Benachrichtigungen')}
        </LinkRow>
      </div>

      <div className="list settings-group">
        <LinkRow to="/einstellungen/layout" icon="list" tone="red" sub={t('Reihenfolge auf „Heute“, Leiste unten und Seitenleiste')}>
          {t('Startseite & Navigation')}
        </LinkRow>
        <LinkRow to="/einstellungen/darstellung" icon="palette" tone="pink" sub={`${themeName}, ${t('Farbschema, Schriftgröße, Sprache')}`}>
          {t('Darstellung')}
        </LinkRow>
        <LinkRow
          to="/einstellungen/konto"
          icon="cloud"
          tone="purple"
          sub={`${user?.email ?? ''} · ${!sync.online ? t('offline') : pending ? t('{n} ausstehend', { n: pending }) : t('synchronisiert')}`}
        >
          {t('Konto & Daten')}
        </LinkRow>
      </div>

      <p className="section-footer" style={{ textAlign: 'center', marginTop: 24 }}>
        Schulplaner · {t('Version')} {__APP_VERSION__}
      </p>
    </div>
  )
}
