import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from './AppShell'

vi.mock('../lib/supabaseClient', () => ({
  supabase: { auth: { signOut: vi.fn() } },
}))

vi.mock('../lib/useSession', () => ({
  useSession: () => ({ session: { user: { email: 'me@example.com' } }, loading: false }),
}))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/projects" element={<p>dashboard content</p>} />
          <Route path="/projects/:projectId/*" element={<p>diagram content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('AppShell', () => {
  it('renders the brand and the routed content', () => {
    renderAt('/projects')
    expect(screen.getByText('cartogram')).toBeInTheDocument()
    expect(screen.getByText('dashboard content')).toBeInTheDocument()
  })

  it('hides the "All projects" link outside a project', () => {
    renderAt('/projects')
    expect(screen.queryByText('← All projects')).not.toBeInTheDocument()
  })

  it('shows an "All projects" link when inside a project', () => {
    renderAt('/projects/p1/deployment')
    expect(screen.getByText('diagram content')).toBeInTheDocument()
    expect(screen.getByText('← All projects')).toBeInTheDocument()
  })
})
