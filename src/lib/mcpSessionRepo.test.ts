import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()
vi.mock('./supabaseClient', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}))

import { listMcpSessions, revokeMcpSession } from './mcpSessionRepo'

beforeEach(() => {
  mockRpc.mockReset()
})

describe('listMcpSessions', () => {
  it('returns sessions via the list_my_mcp_sessions rpc', async () => {
    mockRpc.mockResolvedValue({
      data: [{ session_id: 's1', created_at: '2026-07-13T00:00:00Z', expires_at: '2026-07-14T00:00:00Z' }],
      error: null,
    })
    const result = await listMcpSessions()
    expect(mockRpc).toHaveBeenCalledWith('list_my_mcp_sessions')
    expect(result).toEqual([
      { sessionId: 's1', createdAt: '2026-07-13T00:00:00Z', expiresAt: '2026-07-14T00:00:00Z' },
    ])
  })

  it('throws when the rpc errors', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'network unreachable' } })
    await expect(listMcpSessions()).rejects.toThrow('network unreachable')
  })
})

describe('revokeMcpSession', () => {
  it('calls the revoke_mcp_session rpc', async () => {
    mockRpc.mockResolvedValue({ error: null })
    await revokeMcpSession('s1')
    expect(mockRpc).toHaveBeenCalledWith('revoke_mcp_session', { p_session_id: 's1' })
  })

  it('throws when the rpc errors', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'not found' } })
    await expect(revokeMcpSession('s1')).rejects.toThrow('not found')
  })
})
