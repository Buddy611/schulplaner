import { IconBubble } from '../components/Icons'
import { PageHeader } from '../components/PageHeader'
import { usePendingCount } from '../components/StatusPill'
import { LinkRow, Segmented } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useActiveTimetable, useLookups } from '../lib/models'
import { STATES, updateSettings, useSettings, type Settings as SettingsType } from '../lib/settings'
import { useSyncState } from '../lib/sync'

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
  const stateName = STATES.find((s) => s.code === settings.state)?.name
  const themeName = { system: 'System', light: 'Hell', dark: 'Dunkel' }[settings.theme]

  return (
    <div className="page">
      <PageHeader title="Einstellungen" settingsButton={false} />

      <div className="list settings-group">
        <LinkRow
          to="/einstellungen/stundenplaene"
          icon="calendar"
          tone="blue"
          sub={timetable ? `${timetable.name}${timetables && timetables.length > 1 ? ` · ${timetables.length} Pläne` : ''}` : 'Noch keiner angelegt'}
        >
          Stundenpläne
        </LinkRow>
        <LinkRow to="/einstellungen/zeitraster" icon="clock" tone="blue" sub={lessonCount ? `${lessonCount} Stunden, Pausen` : 'Stunden und Pausen'}>
          Zeitraster
        </LinkRow>
      </div>

      <div className="list settings-group">
        <LinkRow
          to="/einstellungen/faecher"
          icon="book"
          tone="cyan"
          sub={subjects.length ? `${subjects.length} ${subjects.length === 1 ? 'Fach' : 'Fächer'}, Farben` : 'Fächer und Farben anlegen'}
        >
          Fächer
        </LinkRow>
        <LinkRow to="/einstellungen/lehrer" icon="person" tone="cyan" sub={teachers.length ? `${teachers.length} Lehrer` : 'Noch keine'}>
          Lehrer
        </LinkRow>
        <LinkRow to="/einstellungen/raeume" icon="door" tone="teal" sub={rooms.length ? `${rooms.length} ${rooms.length === 1 ? 'Raum' : 'Räume'}` : 'Noch keine'}>
          Räume
        </LinkRow>
      </div>

      <div className="list settings-group">
        <div className="row with-icon stack-icon">
          <IconBubble name="grade" tone="green" />
          <span className="label">
            <span className="row-title">Notensystem</span>
            <div style={{ marginTop: 10 }}>
              <Segmented<SettingsType['gradeSystem']>
                value={settings.gradeSystem}
                onChange={(gradeSystem) => set({ gradeSystem })}
                options={[
                  { value: 'noten', label: 'Noten 1–6' },
                  { value: 'punkte', label: 'Punkte 0–15' },
                ]}
              />
            </div>
          </span>
        </div>
        <LinkRow to="/einstellungen/noten" icon="tune" tone="green" sub="Schriftlich/mündlich, Notenbesprechung, Halbjahre">
          Gewichtung & Halbjahre
        </LinkRow>
        <LinkRow to="/einstellungen/klausurtypen" icon="exam" tone="lime" sub={settings.examTypes.join(', ')}>
          Klausurtypen
        </LinkRow>
      </div>

      <div className="list settings-group">
        <LinkRow to="/einstellungen/ferien" icon="sun" tone="yellow" sub={stateName ? `${stateName} · Ferien, Feiertage, freie Tage` : 'Bundesland wählen'}>
          Ferien & Feiertage
        </LinkRow>
        <LinkRow
          to="/einstellungen/benachrichtigungen"
          icon="bell"
          tone="orange"
          sub={settings.notifications.enabled ? `An · ${settings.notifications.time} Uhr` : 'Erinnerungen an Hausaufgaben und Klausuren'}
        >
          Benachrichtigungen
        </LinkRow>
      </div>

      <div className="list settings-group">
        <LinkRow to="/einstellungen/layout" icon="list" tone="red" sub="Reihenfolge auf „Heute“, Leiste unten und Seitenleiste">
          Startseite & Navigation
        </LinkRow>
        <LinkRow to="/einstellungen/darstellung" icon="palette" tone="pink" sub={`${themeName}, Farbschema, Schriftgröße`}>
          Darstellung
        </LinkRow>
        <LinkRow
          to="/einstellungen/konto"
          icon="cloud"
          tone="purple"
          sub={`${user?.email ?? ''} · ${!sync.online ? 'offline' : pending ? `${pending} ausstehend` : 'synchronisiert'}`}
        >
          Konto & Daten
        </LinkRow>
      </div>

      <p className="section-footer" style={{ textAlign: 'center', marginTop: 24 }}>
        Schulplaner · Version {__APP_VERSION__}
      </p>
    </div>
  )
}
