import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './components/LoginPage'
import { RequireAuth } from './components/RequireAuth'
import { DiagramPage } from './components/DiagramPage'
import { ProjectDashboard } from './components/ProjectDashboard'
import { McpIntegrationSettings } from './components/McpIntegrationSettings'
import { ShareProjectPanel } from './components/ShareProjectPanel'
import { McpAuthorize } from './components/McpAuthorize'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/projects" replace />} />
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
        <Route
          path="/mcp-authorize"
          element={
            <RequireAuth>
              <McpAuthorize />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
