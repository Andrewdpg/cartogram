import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LoginPage } from './components/LoginPage'
import { RequireAuth } from './components/RequireAuth'
import { DiagramPage } from './components/DiagramPage'
import { ProjectDashboard } from './components/ProjectDashboard'
import { McpIntegrationSettings } from './components/McpIntegrationSettings'
import { ShareProjectPanel } from './components/ShareProjectPanel'

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
        <Route
          path="/projects/:projectId/share"
          element={
            <RequireAuth>
              <ShareProjectPanel />
            </RequireAuth>
          }
        />
        <Route
          path="/settings/integrations"
          element={
            <RequireAuth>
              <McpIntegrationSettings />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
