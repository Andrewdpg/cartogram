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
})
