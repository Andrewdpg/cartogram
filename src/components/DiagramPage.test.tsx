import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { DiagramPage } from './DiagramPage'
import * as diagramRepo from '../lib/diagramRepo'
import { DiagramNotFoundError } from '../lib/types'
import type { Diagram } from '../lib/types'

const diagrams: Record<string, Diagram> = {
  deployment: {
    id: 'deployment',
    title: 'Deployment',
    notation: 'c4',
    nodes: [{ id: 'api', label: 'API Service', kind: 'service', childDiagram: 'api-components' }],
    edges: [],
  },
  'api-components': {
    id: 'api-components',
    title: 'API Service — Components',
    notation: 'c4',
    nodes: [{ id: 'auth', label: 'Auth Module', kind: 'component' }],
    edges: [],
  },
  orphaned: {
    id: 'orphaned',
    title: 'Orphaned Diagram',
    notation: 'c4',
    nodes: [{ id: 'lonely', label: 'Lonely Node', kind: 'service' }],
    edges: [],
  },
}

vi.mock('../lib/diagramRepo', () => ({
  getDiagram: vi.fn(),
  updateDiagram: vi.fn(),
  listDiagrams: vi.fn().mockResolvedValue([]),
}))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/projects/:projectId/*" element={<DiagramPage />} />
      </Routes>
    </MemoryRouter>
  )
}

// ponytail: same d3-drag/jsdom `event.view.document` gap as
// DiagramCanvas.test.tsx (see that file for the full explanation). Scoped
// to this file only; matched on the d3-drag stack frame so unrelated
// errors still surface. Upgrade path: remove once jsdom sets a
// browser-accurate `view` default for synthetic MouseEvents.
let onError: (event: ErrorEvent) => void
beforeEach(() => {
  onError = (event) => {
    if (
      event.error instanceof TypeError &&
      event.error.message === "Cannot read properties of null (reading 'document')" &&
      event.error.stack?.includes('d3-drag')
    ) {
      event.preventDefault()
    }
  }
  window.addEventListener('error', onError)

  vi.mocked(diagramRepo.getDiagram).mockImplementation(async (_projectId, slug) => {
    const diagram = diagrams[slug]
    if (!diagram) throw new DiagramNotFoundError(slug)
    return { diagram, version: 1 }
  })
})
afterEach(() => {
  window.removeEventListener('error', onError)
  vi.mocked(diagramRepo.getDiagram).mockReset()
})

describe('DiagramPage', () => {
  it('renders the root deployment diagram at the project root', async () => {
    renderAt('/projects/test-project-id/')
    await waitFor(() => expect(screen.getByText('Home')).toBeInTheDocument())
    expect(await screen.findByText('API Service')).toBeInTheDocument()
  })

  it('drills down into a child diagram by clicking a node', async () => {
    renderAt('/projects/test-project-id/')
    await waitFor(() => expect(screen.getByText('API Service')).toBeInTheDocument())
    await userEvent.click(screen.getByText('API Service'))
    expect(await screen.findByText('Auth Module')).toBeInTheDocument()
  })

  it('renders a not-found state for a bad path', async () => {
    renderAt('/projects/test-project-id/does-not-exist')
    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument())
  })

  it('shows a save-failed message (not the version-conflict message) when updateDiagram throws a non-conflict error', async () => {
    // Regression guard: updateDiagram only resolves { conflict: true } for
    // PGRST116 (stale version) and throws every other error. Before this
    // fix, handleApplyJson had no try/catch around the updateDiagram call,
    // so any real failure (network, unexpected Supabase error) propagated
    // as an unhandled rejection instead of surfacing to the user at all.
    vi.mocked(diagramRepo.updateDiagram).mockRejectedValue(new Error('network unreachable'))
    renderAt('/projects/test-project-id/')
    await waitFor(() => expect(screen.getByText('API Service')).toBeInTheDocument())

    await userEvent.click(screen.getByText('Edit JSON'))
    const textarea = screen.getByLabelText('Diagram JSON')
    fireEvent.change(textarea, {
      target: {
        value: JSON.stringify({
          id: 'deployment',
          title: 'Deployment',
          notation: 'c4',
          nodes: [{ id: 'api', label: 'API Service', kind: 'service' }],
          edges: [],
        }),
      },
    })
    await userEvent.click(screen.getByText('Apply'))

    expect(await screen.findByText(/Failed to save: network unreachable/)).toBeInTheDocument()
    expect(screen.queryByText(/Save conflict/)).not.toBeInTheDocument()
  })

  it('does not crash when the project has no "deployment" diagram at all, and offers the picker to escape', async () => {
    // The real-world case this was fixed from: a project whose only
    // diagram was created directly under a non-"deployment" slug (by the
    // MCP server) has nothing at the root route. getDiagram raised the raw
    // Supabase/PostgREST error (not a DiagramNotFoundError) for the
    // missing 'deployment' row — before the fix, that propagated
    // unhandled and crashed the page instead of landing in the normal
    // "not found" state where the picker is reachable.
    vi.mocked(diagramRepo.getDiagram).mockImplementation(async (_projectId, slug) => {
      if (slug === 'deployment') throw new Error('PGRST116: The result contains 0 rows')
      const diagram = diagrams[slug]
      if (!diagram) throw new DiagramNotFoundError(slug)
      return { diagram, version: 1 }
    })
    vi.mocked(diagramRepo.listDiagrams).mockResolvedValue([{ slug: 'orphaned', title: 'Orphaned Diagram' }])

    renderAt('/projects/test-project-id/')

    expect(await screen.findByText('Diagram not found')).toBeInTheDocument()
    const picker = await screen.findByLabelText('Diagram')
    fireEvent.change(picker, { target: { value: 'orphaned' } })

    expect(await screen.findByText('Lonely Node')).toBeInTheDocument()
  })

  it('lets the user open a diagram that is not linked into the deployment tree via the picker', async () => {
    // Regression guard: create_diagram (MCP or otherwise) can create a
    // diagram with no childDiagram anywhere pointing to it — before the
    // picker, that diagram was permanently unreachable from the UI short
    // of hand-constructing a URL. ?diagram=<slug> opens it directly,
    // bypassing the deployment-tree walk.
    // listDiagrams only ever returns orphans (deployment is excluded by
    // convention, see diagramRepo.ts) — DiagramPage adds the fixed
    // "Deployment" option to the picker itself.
    vi.mocked(diagramRepo.listDiagrams).mockResolvedValue([{ slug: 'orphaned', title: 'Orphaned Diagram' }])
    renderAt('/projects/test-project-id/')
    await waitFor(() => expect(screen.getByText('API Service')).toBeInTheDocument())

    const picker = await screen.findByLabelText('Diagram')
    fireEvent.change(picker, { target: { value: 'orphaned' } })

    expect(await screen.findByText('Lonely Node')).toBeInTheDocument()
  })

  it('always offers "Deployment" as a fixed picker option, so an orphan does not strand the user there', async () => {
    // listDiagrams excludes 'deployment' from its result (it's never an
    // orphan by definition), but the picker still needs a way back to the
    // main tree from wherever an orphan diagram left the user.
    vi.mocked(diagramRepo.listDiagrams).mockResolvedValue([{ slug: 'orphaned', title: 'Orphaned Diagram' }])
    renderAt('/projects/test-project-id/?diagram=orphaned')
    await waitFor(() => expect(screen.getByText('Lonely Node')).toBeInTheDocument())

    const picker = await screen.findByLabelText('Diagram')
    fireEvent.change(picker, { target: { value: 'deployment' } })

    expect(await screen.findByText('API Service')).toBeInTheDocument()
  })
})
