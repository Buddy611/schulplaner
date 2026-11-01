import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { SideNav, TabBar } from './components/TabBar'
import { DialogHost } from './components/dialogs'
import { AuthProvider, useAuth } from './lib/auth'
import { requestPersistentStorage } from './lib/db'
import { useSettings } from './lib/settings'
import { startAutoSync } from './lib/sync'
import { ensureHolidays, regionKey } from './lib/holidays'
import { useApplyTheme } from './lib/theme'
import { useLanguagePref } from './lib/i18n'
import { Login } from './pages/Login'
import { Settings } from './pages/Settings'
import { Today } from './pages/Today'
import { TimetableEditor } from './pages/TimetableEditor'
import { SchedulePage } from './pages/Schedule'
import { LessonPage } from './pages/LessonPage'
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
import { LayoutPage } from './pages/settings/LayoutPage'
import { AccountSettingsPage } from './pages/settings/AccountSettings'
import { AbsencesPage } from './pages/absences/AbsencesPage'
import { ChangesPage } from './pages/changes/ChangesPage'
import { NotesPage } from './pages/notes/NotesPage'
import { StudyPage } from './pages/study/StudyPage'
import { SearchPage } from './pages/SearchPage'
import { SharePage } from './pages/SharePage'
import { WeeklyReview } from './pages/WeeklyReview'
import { VocabSetPage } from './pages/study/VocabSetPage'
import { VocabLearnPage } from './pages/study/VocabLearnPage'
import { StudySheetPage } from './pages/study/StudySheetPage'
import { StudyTimerPage } from './pages/study/StudyTimerPage'
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
  useLanguagePref(settings.language)

  useEffect(() => {
    if (!user) return
    void requestPersistentStorage()
    return startAutoSync()
  }, [user])

  // Ferien für das gewählte Bundesland im Voraus laden (und auffrischen, sobald wieder online)
  useEffect(() => {
    const region = regionKey(settings)
    if (!user || !region) return
    const load = () => void ensureHolidays(region).catch(() => undefined)
    load()
    window.addEventListener('online', load)
    return () => window.removeEventListener('online', load)
  }, [user, settings.state, settings.country])

  if (!user) return <Login />

  return (
    <div className="app">
      <SideNav />
      <main className="main">
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/stundenplan" element={<SchedulePage />} />
        <Route path="/stundenplan/bearbeiten" element={<TimetableEditor />} />
        <Route path="/stunde/:date/:lessonId" element={<LessonPage />} />
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
        <Route path="/einstellungen/layout" element={<LayoutPage />} />
        <Route path="/einstellungen/konto" element={<AccountSettingsPage />} />
        <Route path="/fehlstunden" element={<AbsencesPage />} />
        <Route path="/notizen" element={<NotesPage />} />
        <Route path="/lernen" element={<StudyPage />} />
        <Route path="/suche" element={<SearchPage />} />
        <Route path="/teilen" element={<SharePage />} />
        <Route path="/rueckblick" element={<WeeklyReview />} />
        <Route path="/lernen/timer" element={<StudyTimerPage />} />
        <Route path="/lernen/vokabeln/:id" element={<VocabSetPage />} />
        <Route path="/lernen/vokabeln/:id/lernen" element={<VocabLearnPage />} />
        <Route path="/lernen/zettel/:id" element={<StudySheetPage />} />
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
