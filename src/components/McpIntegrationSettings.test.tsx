import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { McpIntegrationSettings } from './McpIntegrationSettings'

vi.mock('../lib/diagramRepo', () => ({ listProjects: vi.fn() }))
vi.mock('../lib/mcpGrantRepo', () => ({ listMcpGrants: vi.fn(), setMcpGrant: vi.fn() }))

import { listProjects } from '../lib/diagramRepo'
import { listMcpGrants, setMcpGrant } from '../lib/mcpGrantRepo'

describe('McpIntegrationSettings', () => {
  it('shows a toggle per project reflecting current grant state', async () => {
    vi.mocked(listProjects).mockResolvedValue([
      { id: 'p1', name: 'Granted Repo' },
      { id: 'p2', name: 'Ungranted Repo' },
    ])
    vi.mocked(listMcpGrants).mockResolvedValue(new Set(['p1']))

    render(<McpIntegrationSettings />)

    const granted = await screen.findByLabelText('Granted Repo')
    const ungranted = screen.getByLabelText('Ungranted Repo')
    expect(granted).toBeChecked()
    expect(ungranted).not.toBeChecked()
  })

  it('toggling a project calls setMcpGrant', async () => {
    vi.mocked(listProjects).mockResolvedValue([{ id: 'p1', name: 'Repo' }])
    vi.mocked(listMcpGrants).mockResolvedValue(new Set())
    vi.mocked(setMcpGrant).mockResolvedValue(undefined)

    render(<McpIntegrationSettings />)
    const toggle = await screen.findByLabelText('Repo')
    fireEvent.click(toggle)

    await waitFor(() => expect(setMcpGrant).toHaveBeenCalledWith('p1', true))
  })
})
