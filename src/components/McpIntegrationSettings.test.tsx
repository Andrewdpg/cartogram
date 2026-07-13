import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { McpIntegrationSettings } from './McpIntegrationSettings'

vi.mock('../lib/diagramRepo', () => ({ listProjects: vi.fn() }))
vi.mock('../lib/mcpGrantRepo', () => ({ listMcpGrants: vi.fn(), setMcpGrant: vi.fn() }))
vi.mock('../lib/mcpSessionRepo', () => ({ listMcpSessions: vi.fn(), revokeMcpSession: vi.fn() }))

import { listProjects } from '../lib/diagramRepo'
import { listMcpGrants, setMcpGrant } from '../lib/mcpGrantRepo'
import { listMcpSessions, revokeMcpSession } from '../lib/mcpSessionRepo'

describe('McpIntegrationSettings', () => {
  it('shows a toggle per project reflecting current grant state', async () => {
    vi.mocked(listProjects).mockResolvedValue([
      { id: 'p1', name: 'Granted Repo', owner_id: 'me' },
      { id: 'p2', name: 'Ungranted Repo', owner_id: 'me' },
    ])
    vi.mocked(listMcpGrants).mockResolvedValue(new Set(['p1']))
    vi.mocked(listMcpSessions).mockResolvedValue([])

    render(<McpIntegrationSettings />)

    const granted = await screen.findByLabelText('Granted Repo')
    const ungranted = screen.getByLabelText('Ungranted Repo')
    expect(granted).toBeChecked()
    expect(ungranted).not.toBeChecked()
  })

  it('toggling a project calls setMcpGrant', async () => {
    vi.mocked(listProjects).mockResolvedValue([{ id: 'p1', name: 'Repo', owner_id: 'me' }])
    vi.mocked(listMcpGrants).mockResolvedValue(new Set())
    vi.mocked(setMcpGrant).mockResolvedValue(undefined)
    vi.mocked(listMcpSessions).mockResolvedValue([])

    render(<McpIntegrationSettings />)
    const toggle = await screen.findByLabelText('Repo')
    fireEvent.click(toggle)

    await waitFor(() => expect(setMcpGrant).toHaveBeenCalledWith('p1', true))
  })

  it('shows a message when no MCP agent is connected', async () => {
    vi.mocked(listProjects).mockResolvedValue([])
    vi.mocked(listMcpGrants).mockResolvedValue(new Set())
    vi.mocked(listMcpSessions).mockResolvedValue([])

    render(<McpIntegrationSettings />)

    expect(await screen.findByText(/no mcp agent is currently connected/i)).toBeInTheDocument()
  })

  it('lists active sessions and revokes one on click', async () => {
    vi.mocked(listProjects).mockResolvedValue([])
    vi.mocked(listMcpGrants).mockResolvedValue(new Set())
    vi.mocked(listMcpSessions).mockResolvedValue([
      { sessionId: 's1', createdAt: '2026-07-13T00:00:00Z', expiresAt: '2026-07-14T00:00:00Z' },
    ])
    vi.mocked(revokeMcpSession).mockResolvedValue(undefined)

    render(<McpIntegrationSettings />)

    const revokeButton = await screen.findByText('Revoke')
    fireEvent.click(revokeButton)

    await waitFor(() => expect(revokeMcpSession).toHaveBeenCalledWith('s1'))
    await waitFor(() => expect(screen.queryByText('Revoke')).not.toBeInTheDocument())
  })
})
