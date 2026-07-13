import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listProjects, createProject } from '../lib/diagramRepo'

interface Project {
  id: string
  name: string
}

export function ProjectDashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch((err) => setError((err as Error).message))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      const created = await createProject(newName)
      setProjects((prev) => [...prev, created])
      setNewName('')
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Your projects</h1>
      {error && <p role="alert">{error}</p>}
      <ul>
        {projects.map((p) => (
          <li key={p.id}>
            <Link to={`/projects/${p.id}/`}>{p.name}</Link>
          </li>
        ))}
      </ul>
      <form onSubmit={handleCreate}>
        <label htmlFor="project-name">Project name</label>
        <input id="project-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="submit">Create project</button>
      </form>
    </div>
  )
}
