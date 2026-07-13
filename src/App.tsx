import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LoginPage } from './components/LoginPage'
import { RequireAuth } from './components/RequireAuth'
import { DiagramPage } from './components/DiagramPage'
import { ProjectDashboard } from './components/ProjectDashboard'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/projects"
          element={
            <RequireAuth>
              <ProjectDashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/projects/:projectId/*"
          element={
            <RequireAuth>
              <DiagramPage />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
