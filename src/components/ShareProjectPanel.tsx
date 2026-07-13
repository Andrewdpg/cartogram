import { useEffect, useState } from 'react'
import { listCollaborators, inviteCollaborator, type Collaborator } from '../lib/collaboratorRepo'

export function ShareProjectPanel({ projectId }: { projectId: string }) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [email, setEmail] = useState('')

  useEffect(() => {
    listCollaborators(projectId).then(setCollaborators)
  }, [projectId])

  async function handleInvite(role: 'viewer' | 'editor') {
    if (!email.trim()) return
    await inviteCollaborator(projectId, email, role)
    const refreshed = await listCollaborators(projectId)
    setCollaborators(refreshed)
    setEmail('')
  }

  return (
    <div>
      <h2>Collaborators</h2>
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
