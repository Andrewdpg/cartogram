import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LoginPage } from './LoginPage'

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}))

import { supabase } from '../lib/supabaseClient'

describe('LoginPage', () => {
  it('sends a magic link on submit', async () => {
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'me@example.com' } })
    fireEvent.click(screen.getByText('Send magic link'))
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'me@example.com' })
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument()
  })
})
