import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()
vi.mock('./supabaseClient', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}))

import { listCollaborators, inviteCollaborator } from './collaboratorRepo'

beforeEach(() => {
  mockRpc.mockReset()
})

describe('listCollaborators', () => {
  it('returns member rows with email and role via the list_collaborators_with_email rpc', async () => {
    mockRpc.mockResolvedValue({
      data: [{ user_id: 'u1', email: 'a@example.com', role: 'viewer' }],
      error: null,
    })
    const result = await listCollaborators('proj-1')
    expect(mockRpc).toHaveBeenCalledWith('list_collaborators_with_email', { p_project_id: 'proj-1' })
    expect(result).toEqual([{ userId: 'u1', email: 'a@example.com', role: 'viewer' }])
  })

  it('throws when the rpc errors (e.g. caller lacks access to the project)', async () => {
    mockRpc.mockResolvedValue({ error: { message: "not authorized to view this project's collaborators" } })
    await expect(listCollaborators('proj-1')).rejects.toThrow(
      "not authorized to view this project's collaborators"
    )
  })
})

describe('inviteCollaborator', () => {
  it('calls the invite_collaborator_by_email rpc', async () => {
    mockRpc.mockResolvedValue({ error: null })
    await inviteCollaborator('proj-1', 'new@example.com', 'editor')
    expect(mockRpc).toHaveBeenCalledWith('invite_collaborator_by_email', {
      p_project_id: 'proj-1',
      p_email: 'new@example.com',
      p_role: 'editor',
    })
  })

  it('throws when the rpc errors (e.g. no matching user)', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'No user with that email' } })
    await expect(inviteCollaborator('proj-1', 'nobody@example.com', 'viewer')).rejects.toThrow(
      'No user with that email'
    )
  })
})
