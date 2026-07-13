import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockAuth = { getUser: vi.fn() }
vi.mock('./supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getUser: (...args: unknown[]) => mockAuth.getUser(...args) },
  },
}))

import { listMcpGrants, setMcpGrant } from './mcpGrantRepo'

beforeEach(() => {
  mockFrom.mockReset()
  mockAuth.getUser.mockReset()
  mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'me' } } })
})

describe('listMcpGrants', () => {
  it('returns the set of granted project ids', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => Promise.resolve({ data: [{ project_id: 'p1' }], error: null }) }),
    })
    const result = await listMcpGrants()
    expect(result).toEqual(new Set(['p1']))
  })
})

describe('setMcpGrant', () => {
  it('inserts a grant when enabling', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ insert })
    await setMcpGrant('p1', true)
    expect(insert).toHaveBeenCalledWith({ project_id: 'p1', user_id: 'me' })
  })

  it('deletes the grant when disabling', async () => {
    const eq2 = vi.fn().mockResolvedValue({ error: null })
    const eq1 = vi.fn(() => ({ eq: eq2 }))
    mockFrom.mockReturnValue({ delete: () => ({ eq: eq1 }) })
    await setMcpGrant('p1', false)
    expect(eq1).toHaveBeenCalledWith('project_id', 'p1')
    expect(eq2).toHaveBeenCalledWith('user_id', 'me')
  })
})
