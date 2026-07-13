import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import type { Diagram } from './lib/types'

vi.mock('./lib/supabaseClient', () => ({
  supabase: { auth: { signInWithOtp: vi.fn() } },
}))

vi.mock('./lib/useSession', () => ({
  useSession: () => ({ session: { user: { id: 'u1' } }, loading: false }),
}))

vi.mock('./lib/diagramRepo', () => ({
  getDiagram: vi.fn(),
  updateDiagram: vi.fn(),
  listProjects: vi.fn().mockResolvedValue([]),
  createProject: vi.fn(),
  listDiagrams: vi.fn().mockResolvedValue([]),
}))

vi.mock('./lib/collaboratorRepo', () => ({
  listCollaborators: vi.fn().mockResolvedValue([]),
  inviteCollaborator: vi.fn(),
}))

import { getDiagram } from './lib/diagramRepo'

const deployment: Diagram = {
  id: 'deployment',
  title: 'Deployment',
  notation: 'c4',
  nodes: [{ id: 'api', label: 'API Service', kind: 'service' }],
  edges: [],
}

describe('App', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/projects/test-project-id/')
    vi.mocked(getDiagram).mockResolvedValue({ diagram: deployment, version: 1 })
  })

  it('renders the root deployment diagram by default', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('Home')).toBeInTheDocument())
    expect(await screen.findByText('API Service')).toBeInTheDocument()
  })

  it('redirects / to /projects instead of matching no route', async () => {
    // Regression guard: the root path "/" had no <Route> at all — hitting it
    // rendered a blank page with "No routes matched location /" in the
    // console, no error boundary, nothing user-visible.
    window.history.pushState({}, '', '/')
    render(<App />)
    expect(await screen.findByText('Your projects')).toBeInTheDocument()
  })

  it('opens the Share tab in the side panel instead of navigating to a separate screen', async () => {
    // Sharing used to be its own route (/projects/:projectId/share); it's
    // now a tab in the same SidePanel used for node details/JSON/legend,
    // so there's no page navigation and no way to get "stuck" off-canvas.
    // There's also no dedicated toolbar trigger anymore — the tab itself
    // is the only entry point.
    window.history.pushState({}, '', '/projects/test-project-id/')
    render(<App />)
    await waitFor(() => expect(screen.getByText('Home')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Share'))
    expect(await screen.findByLabelText('Collaborator email')).toBeInTheDocument()
  })
})
