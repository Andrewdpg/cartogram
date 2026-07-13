import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProjectDashboard } from './ProjectDashboard'

vi.mock('../lib/diagramRepo', () => ({
  listProjects: vi.fn(),
  createProject: vi.fn(),
}))

vi.mock('../lib/useSession', () => ({
  useSession: () => ({ session: { user: { id: 'me' } }, loading: false }),
}))

import { listProjects, createProject } from '../lib/diagramRepo'

describe('ProjectDashboard', () => {
  it('lists existing projects', async () => {
    vi.mocked(listProjects).mockResolvedValue([{ id: 'p1', name: 'My Repo', owner_id: 'me' }])
    render(<MemoryRouter><ProjectDashboard /></MemoryRouter>)
    expect(await screen.findByText('My Repo')).toBeInTheDocument()
  })

  it('creates a new project and adds it to the list', async () => {
    vi.mocked(listProjects).mockResolvedValue([])
    vi.mocked(createProject).mockResolvedValue({ id: 'p2', name: 'New One', owner_id: 'me' })
    render(<MemoryRouter><ProjectDashboard /></MemoryRouter>)
    await waitFor(() => expect(listProjects).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'New One' } })
    fireEvent.click(screen.getByText('Create project'))

    expect(await screen.findByText('New One')).toBeInTheDocument()
    expect(createProject).toHaveBeenCalledWith('New One')
  })

  it('separates owned projects from projects shared by someone else', async () => {
    vi.mocked(listProjects).mockResolvedValue([
      { id: 'p1', name: 'Mine', owner_id: 'me' },
      { id: 'p2', name: 'Theirs', owner_id: 'someone-else' },
    ])
    render(<MemoryRouter><ProjectDashboard /></MemoryRouter>)

    expect(await screen.findByText('Mine')).toBeInTheDocument()
    expect(screen.getByText('Theirs')).toBeInTheDocument()
    expect(screen.getByText('Your projects')).toBeInTheDocument()
    expect(screen.getByText('Shared with you')).toBeInTheDocument()

    const mineCard = screen.getByText('Mine').closest('a')
    const theirsCard = screen.getByText('Theirs').closest('a')
    // Regression guard: both cards existing isn't enough — they must land
    // in different <section> groups, or the split is cosmetic-only.
    expect(mineCard?.closest('section')).not.toBe(theirsCard?.closest('section'))
  })

  it('hides the "Shared with you" section when nothing is shared', async () => {
    vi.mocked(listProjects).mockResolvedValue([{ id: 'p1', name: 'Mine', owner_id: 'me' }])
    render(<MemoryRouter><ProjectDashboard /></MemoryRouter>)

    await screen.findByText('Mine')
    expect(screen.queryByText('Shared with you')).not.toBeInTheDocument()
  })
})
