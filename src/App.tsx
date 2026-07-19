import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { CoursePage } from './pages/CoursePage'
import { DirectoryPage } from './pages/DirectoryPage'
import { FacultyPage } from './pages/FacultyPage'

export default function App() {
  return (
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<DirectoryPage />} />
          <Route path="/faculty/:facultySlug" element={<FacultyPage />} />
          <Route path="/faculty/:facultySlug/course/:courseId" element={<CoursePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </HashRouter>
  )
}
