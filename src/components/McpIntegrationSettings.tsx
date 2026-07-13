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

  useEffect(() => {
    listProjects().then(setProjects)
    listMcpGrants().then(setGranted)
  }, [])

  async function handleToggle(projectId: string, next: boolean) {
    await setMcpGrant(projectId, next)
    setGranted((prev) => {
      const updated = new Set(prev)
      if (next) updated.add(projectId)
      else updated.delete(projectId)
      return updated
    })
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>MCP access</h1>
      <p>Choose which projects an MCP-connected AI agent (e.g. Claude Code) can read and write.</p>
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
