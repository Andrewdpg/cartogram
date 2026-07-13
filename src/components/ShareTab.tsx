import { useEffect, useState } from 'react'
import { listCollaborators, inviteCollaborator, type Collaborator } from '../lib/collaboratorRepo'

export function ShareTab({ projectId }: { projectId: string }) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listCollaborators(projectId)
      .then(setCollaborators)
      .catch((err) => setError((err as Error).message))
  }, [projectId])

  async function handleInvite(role: 'viewer' | 'editor') {
    if (!email.trim()) return
    try {
      await inviteCollaborator(projectId, email, role)
      const refreshed = await listCollaborators(projectId)
      setCollaborators(refreshed)
      setEmail('')
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div>
      <ul className="collab-list">
        {collaborators.map((c) => (
          <li key={c.userId} className="collab-item">
            <span>{c.email}</span>
            <span className="role-badge">{c.role}</span>
          </li>
        ))}
      </ul>
      <div className="field">
        <label htmlFor="collab-email">Collaborator email</label>
        <input id="collab-email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      <div className="collab-invite-actions">
        <button className="btn btn-primary" onClick={() => handleInvite('viewer')}>
          Invite as viewer
        </button>
        <button className="btn" onClick={() => handleInvite('editor')}>
          Invite as editor
        </button>
      </div>
    </div>
  )
}
