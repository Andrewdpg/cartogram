import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { UserMenu } from './UserMenu'

vi.mock('../lib/supabaseClient', () => ({
  supabase: { auth: { signOut: vi.fn() } },
}))

vi.mock('../lib/useSession', () => ({
  useSession: vi.fn(),
}))

import { supabase } from '../lib/supabaseClient'
import { useSession } from '../lib/useSession'

describe('UserMenu', () => {
  it('renders nothing when there is no session', () => {
    vi.mocked(useSession).mockReturnValue({ session: null, loading: false })
    const { container } = render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the user email and signs out on click', () => {
    vi.mocked(useSession).mockReturnValue({
      session: { user: { email: 'me@example.com' } } as any,
      loading: false,
    })
    render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>
    )
    expect(screen.getByText('me@example.com')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Sign out'))
    expect(supabase.auth.signOut).toHaveBeenCalled()
  })
})
