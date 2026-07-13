import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listProjects, createProject } from '../lib/diagramRepo'
import { AppHeader } from './AppHeader'

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
    <div className="app-shell">
      <AppHeader />
      <div className="dashboard-body">
        <h1>Your projects</h1>
        <p className="dashboard-hint">
          {projects.length} {projects.length === 1 ? 'project' : 'projects'}
        </p>
        {error && (
          <p role="alert" className="alert">
            {error}
          </p>
        )}
        <div className="project-grid">
          {projects.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}/`} className="project-card">
              <h4>{p.name}</h4>
            </Link>
          ))}
          <form onSubmit={handleCreate} className="project-card-new">
            <div className="field">
              <label htmlFor="project-name">Project name</label>
              <input id="project-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary">
              Create project
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
