import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listProjects, createProject } from '../lib/diagramRepo'
import { useSession } from '../lib/useSession'

interface Project {
  id: string
  name: string
  owner_id: string
}

export function ProjectDashboard() {
  const { session } = useSession()
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

  const userId = session?.user.id
  const myProjects = projects.filter((p) => p.owner_id === userId)
  const sharedProjects = projects.filter((p) => p.owner_id !== userId)

  return (
    <div className="dashboard-body">
      <h1>Projects</h1>
      <p className="dashboard-hint">
        {projects.length} {projects.length === 1 ? 'project' : 'projects'}
      </p>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}

      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Your projects</h2>
        <div className="project-grid">
          {myProjects.map((p) => (
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
      </section>

      {sharedProjects.length > 0 && (
        <section className="dashboard-section">
          <h2 className="dashboard-section-title">Shared with you</h2>
          <div className="project-grid">
            {sharedProjects.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}/`} className="project-card">
                <h4>{p.name}</h4>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
