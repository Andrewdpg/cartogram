import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ShareProjectPanel } from './ShareProjectPanel'

vi.mock('../lib/collaboratorRepo', () => ({
  listCollaborators: vi.fn(),
  inviteCollaborator: vi.fn(),
}))

import { listCollaborators, inviteCollaborator } from '../lib/collaboratorRepo'

describe('ShareProjectPanel', () => {
  it('lists current collaborators', async () => {
    vi.mocked(listCollaborators).mockResolvedValue([
      { userId: 'u1', email: 'friend@example.com', role: 'viewer' },
    ])
    render(<ShareProjectPanel projectId="proj-1" />)
    expect(await screen.findByText('friend@example.com')).toBeInTheDocument()
    expect(screen.getByText('viewer')).toBeInTheDocument()
  })

  it('invites a new collaborator', async () => {
    vi.mocked(listCollaborators).mockResolvedValue([])
    vi.mocked(inviteCollaborator).mockResolvedValue(undefined)
    render(<ShareProjectPanel projectId="proj-1" />)
    await waitFor(() => expect(listCollaborators).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('Collaborator email'), {
      target: { value: 'new@example.com' },
    })
    fireEvent.click(screen.getByText('Invite as viewer'))

    await waitFor(() =>
      expect(inviteCollaborator).toHaveBeenCalledWith('proj-1', 'new@example.com', 'viewer')
    )
  })
})
