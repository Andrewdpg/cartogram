import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockRpc = vi.fn()
vi.mock('./supabaseClient', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args), rpc: (...args: unknown[]) => mockRpc(...args) },
}))

import { listCollaborators, inviteCollaborator } from './collaboratorRepo'

beforeEach(() => {
  mockFrom.mockReset()
  mockRpc.mockReset()
})

describe('listCollaborators', () => {
  it('returns member rows with email and role', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () =>
          Promise.resolve({
            data: [{ user_id: 'u1', role: 'viewer', users: { email: 'a@example.com' } }],
            error: null,
          }),
      }),
    })
    const result = await listCollaborators('proj-1')
    expect(result).toEqual([{ userId: 'u1', email: 'a@example.com', role: 'viewer' }])
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
