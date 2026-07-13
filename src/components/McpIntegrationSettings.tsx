import { useEffect, useState } from 'react'
import { listProjects } from '../lib/diagramRepo'
import { listMcpGrants, setMcpGrant } from '../lib/mcpGrantRepo'
import { listMcpSessions, revokeMcpSession, type McpSession } from '../lib/mcpSessionRepo'

interface Project {
  id: string
  name: string
}

function formatRelative(iso: string): string {
  const diffMin = Math.round((new Date(iso).getTime() - Date.now()) / 60000)
  const future = diffMin >= 0
  const abs = Math.abs(diffMin)
  if (abs < 60) return `${abs}m ${future ? 'from now' : 'ago'}`
  return `${Math.round(abs / 60)}h ${future ? 'from now' : 'ago'}`
}

export function McpIntegrationSettings() {
  const [projects, setProjects] = useState<Project[]>([])
  const [granted, setGranted] = useState<Set<string>>(new Set())
  const [sessions, setSessions] = useState<McpSession[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch((err) => setError((err as Error).message))
    listMcpGrants()
      .then(setGranted)
      .catch((err) => setError((err as Error).message))
    listMcpSessions()
      .then(setSessions)
      .catch((err) => setError((err as Error).message))
  }, [])

  async function handleToggle(projectId: string, next: boolean) {
    try {
      await setMcpGrant(projectId, next)
      setGranted((prev) => {
        const updated = new Set(prev)
        if (next) updated.add(projectId)
        else updated.delete(projectId)
        return updated
      })
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleRevoke(sessionId: string) {
    try {
      await revokeMcpSession(sessionId)
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId))
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="dashboard-body">
      <h1>Settings</h1>
      <p className="dashboard-hint">MCP integrations and account security</p>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}

      <section className="dashboard-section">
        <h2 className="dashboard-section-title">MCP-connected projects</h2>
        <p className="settings-section-hint">
          Choose which projects an MCP-connected AI agent (e.g. Claude Code) can read and write.
        </p>
        <div className="settings-list">
          {projects.map((p) => (
            <div key={p.id} className="settings-row">
              <span className="settings-row-label">{p.name}</span>
              <label className="toggle">
                <input
                  type="checkbox"
                  aria-label={p.name}
                  checked={granted.has(p.id)}
                  onChange={(e) => handleToggle(p.id, e.target.checked)}
                />
                <span className="toggle-track" />
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Active connections</h2>
        {sessions.length === 0 ? (
          <p className="settings-section-hint">No MCP agent is currently connected to your account.</p>
        ) : (
          <div className="settings-list">
            {sessions.map((s) => (
              <div key={s.sessionId} className="settings-row">
                <span className="settings-row-label">
                  Connected {formatRelative(s.createdAt)}
                  <span className="settings-row-meta"> · expires {formatRelative(s.expiresAt)}</span>
                </span>
                <button className="btn" onClick={() => handleRevoke(s.sessionId)}>
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
