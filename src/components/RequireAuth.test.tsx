import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { RequireAuth } from './RequireAuth'

vi.mock('../lib/useSession', () => ({
  useSession: vi.fn(),
}))

import { useSession } from '../lib/useSession'

describe('RequireAuth', () => {
  it('renders children when a session exists', () => {
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as any,
      loading: false,
    })
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<RequireAuth><p>secret</p></RequireAuth>} />
          <Route path="/login" element={<p>login page</p>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('secret')).toBeInTheDocument()
  })

  it('redirects to /login when there is no session', () => {
    vi.mocked(useSession).mockReturnValue({ session: null, loading: false })
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<RequireAuth><p>secret</p></RequireAuth>} />
          <Route path="/login" element={<p>login page</p>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('login page')).toBeInTheDocument()
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })

  it('renders nothing while loading', () => {
    vi.mocked(useSession).mockReturnValue({ session: null, loading: true })
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<RequireAuth><p>secret</p></RequireAuth>} />
          <Route path="/login" element={<p>login page</p>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
    expect(screen.queryByText('login page')).not.toBeInTheDocument()
  })
})
