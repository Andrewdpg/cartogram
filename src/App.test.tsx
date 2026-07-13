import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

  it('routes /projects/:projectId/share to ShareProjectPanel, not DiagramPage as a splat segment', async () => {
    // Regression guard: /projects/:projectId/* (DiagramPage's catch-all)
    // and /projects/:projectId/share are declared as siblings in the same
    // <Routes> tree. React Router v6 is documented to rank the static
    // "share" segment above the splat, but that ranking has had
    // inconsistent edge cases reported upstream — assert the actual
    // rendered component instead of trusting the ranking rules alone.
    window.history.pushState({}, '', '/projects/test-project-id/share')
    render(<App />)
    expect(await screen.findByText('Collaborators')).toBeInTheDocument()
    expect(screen.queryByText('Diagram not found')).not.toBeInTheDocument()
  })
})
