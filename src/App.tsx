import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './components/LoginPage'
import { RequireAuth } from './components/RequireAuth'
import { AppShell } from './components/AppShell'
import { DiagramPage } from './components/DiagramPage'
import { ProjectDashboard } from './components/ProjectDashboard'
import { McpIntegrationSettings } from './components/McpIntegrationSettings'
import { McpAuthorize } from './components/McpAuthorize'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/projects" element={<ProjectDashboard />} />
          <Route path="/projects/:projectId/*" element={<DiagramPage />} />
          <Route path="/settings/integrations" element={<McpIntegrationSettings />} />
        </Route>
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
