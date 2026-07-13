import { useEffect, useState } from 'react'
import { listProjects } from '../lib/diagramRepo'
import { listMcpGrants, setMcpGrant } from '../lib/mcpGrantRepo'

interface Project {
  id: string
  name: string
}

export function McpIntegrationSettings() {
  const [projects, setProjects] = useState<Project[]>([])
  const [granted, setGranted] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch((err) => setError((err as Error).message))
    listMcpGrants()
      .then(setGranted)
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

  return (
    <div style={{ padding: 24 }}>
      <h1>MCP access</h1>
      <p>Choose which projects an MCP-connected AI agent (e.g. Claude Code) can read and write.</p>
      {error && <p role="alert">{error}</p>}
      <ul>
        {projects.map((p) => (
          <li key={p.id}>
            <label htmlFor={`mcp-grant-${p.id}`}>{p.name}</label>
            <input
              id={`mcp-grant-${p.id}`}
              aria-label={p.name}
              type="checkbox"
              checked={granted.has(p.id)}
              onChange={(e) => handleToggle(p.id, e.target.checked)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
