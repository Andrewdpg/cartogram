import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { listCollaborators, inviteCollaborator, type Collaborator } from '../lib/collaboratorRepo'

export function ShareProjectPanel({ projectId: projectIdProp }: { projectId?: string }) {
  const params = useParams<{ projectId: string }>()
  const projectId = projectIdProp ?? params.projectId!
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
      <h2>Collaborators</h2>
      {error && <p role="alert">{error}</p>}
      <ul>
        {collaborators.map((c) => (
          <li key={c.userId}>
            <span>{c.email}</span> — <span>{c.role}</span>
          </li>
        ))}
      </ul>
      <label htmlFor="collab-email">Collaborator email</label>
      <input id="collab-email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button onClick={() => handleInvite('viewer')}>Invite as viewer</button>
      <button onClick={() => handleInvite('editor')}>Invite as editor</button>
    </div>
  )
}
