import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { SideNav, TabBar } from './components/TabBar'
import { DialogHost } from './components/dialogs'
import { AuthProvider, useAuth } from './lib/auth'
import { requestPersistentStorage } from './lib/db'
import { useSettings } from './lib/settings'
import { startAutoSync } from './lib/sync'
import { ensureHolidays } from './lib/holidays'
import { useApplyTheme } from './lib/theme'
import { Login } from './pages/Login'
import { Settings } from './pages/Settings'
import { Today } from './pages/Today'
import { TimetableEditor } from './pages/TimetableEditor'
import { SchedulePage } from './pages/Schedule'
import { HomeworkPage } from './pages/homework/HomeworkPage'
import { ExamsPage } from './pages/exams/ExamsPage'
import { ExamTypesPage } from './pages/settings/ExamTypes'
import { GradesPage } from './pages/grades/GradesPage'
import { ReportPage } from './pages/grades/ReportPage'
import { SubjectGradesPage } from './pages/grades/SubjectGradesPage'
import { GradeSettingsPage } from './pages/settings/GradeSettings'
import { HolidaysPage } from './pages/settings/HolidaysPage'
import { NotificationsPage } from './pages/settings/NotificationsPage'
import { DisplaySettingsPage } from './pages/settings/DisplaySettings'
import { AccountSettingsPage } from './pages/settings/AccountSettings'
import { AbsencesPage } from './pages/absences/AbsencesPage'
import { ChangesPage } from './pages/changes/ChangesPage'
import { NotesPage } from './pages/notes/NotesPage'
import { RoomsPage, TeachersPage } from './pages/settings/MasterData'
import { SubjectsPage } from './pages/settings/Subjects'
import { TimeGridPage } from './pages/settings/TimeGrid'
import { TimetablesPage } from './pages/settings/Timetables'

function ReLogin() {
  const navigate = useNavigate()
  return <Login onDone={() => navigate('/einstellungen')} />
}

function Shell() {
  const { user } = useAuth()
  const settings = useSettings()
  useApplyTheme(settings)

  useEffect(() => {
    if (!user) return
    void requestPersistentStorage()
    return startAutoSync()
  }, [user])

  // Ferien für das gewählte Bundesland im Voraus laden (und auffrischen, sobald wieder online)
  useEffect(() => {
    if (!user || !settings.state) return
    const load = () => void ensureHolidays(settings.state).catch(() => undefined)
    load()
    window.addEventListener('online', load)
    return () => window.removeEventListener('online', load)
  }, [user, settings.state])

  if (!user) return <Login />

  return (
    <div className="app">
      <SideNav />
      <main className="main">
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/stundenplan" element={<SchedulePage />} />
        <Route path="/stundenplan/bearbeiten" element={<TimetableEditor />} />
        <Route path="/hausaufgaben" element={<HomeworkPage />} />
        <Route path="/klausuren" element={<ExamsPage />} />
        <Route path="/einstellungen/klausurtypen" element={<ExamTypesPage />} />
        <Route path="/noten" element={<GradesPage />} />
        <Route path="/noten/zeugnis" element={<ReportPage />} />
        <Route path="/noten/:subjectId" element={<SubjectGradesPage />} />
        <Route path="/einstellungen/noten" element={<GradeSettingsPage />} />
        <Route path="/einstellungen/ferien" element={<HolidaysPage />} />
        <Route path="/einstellungen/benachrichtigungen" element={<NotificationsPage />} />
        <Route path="/einstellungen/darstellung" element={<DisplaySettingsPage />} />
        <Route path="/einstellungen/konto" element={<AccountSettingsPage />} />
        <Route path="/fehlstunden" element={<AbsencesPage />} />
        <Route path="/notizen" element={<NotesPage />} />
        <Route path="/vertretungen" element={<ChangesPage />} />
        <Route path="/einstellungen" element={<Settings />} />
        <Route path="/einstellungen/stundenplaene" element={<TimetablesPage />} />
        <Route path="/einstellungen/zeitraster" element={<TimeGridPage />} />
        <Route path="/einstellungen/faecher" element={<SubjectsPage />} />
        <Route path="/einstellungen/lehrer" element={<TeachersPage />} />
        <Route path="/einstellungen/raeume" element={<RoomsPage />} />
        <Route path="/anmelden" element={<ReLogin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </main>
      <TabBar />
      <DialogHost />
    </div>
  )
}

export default function App() {
  return (
    // HashRouter: Adressen wie .../schulplaner/#/einstellungen – Neuladen funktioniert so auch auf GitHub Pages.
    <HashRouter>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </HashRouter>
  )
}
