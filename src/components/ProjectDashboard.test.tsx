import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProjectDashboard } from './ProjectDashboard'

vi.mock('../lib/diagramRepo', () => ({
  listProjects: vi.fn(),
  createProject: vi.fn(),
}))

import { listProjects, createProject } from '../lib/diagramRepo'

describe('ProjectDashboard', () => {
  it('lists existing projects', async () => {
    vi.mocked(listProjects).mockResolvedValue([{ id: 'p1', name: 'My Repo' }])
    render(<MemoryRouter><ProjectDashboard /></MemoryRouter>)
    expect(await screen.findByText('My Repo')).toBeInTheDocument()
  })

  it('creates a new project and adds it to the list', async () => {
    vi.mocked(listProjects).mockResolvedValue([])
    vi.mocked(createProject).mockResolvedValue({ id: 'p2', name: 'New One' })
    render(<MemoryRouter><ProjectDashboard /></MemoryRouter>)
    await waitFor(() => expect(listProjects).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'New One' } })
    fireEvent.click(screen.getByText('Create project'))

    expect(await screen.findByText('New One')).toBeInTheDocument()
    expect(createProject).toHaveBeenCalledWith('New One')
  })
})
