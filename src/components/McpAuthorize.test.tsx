import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { McpAuthorize } from './McpAuthorize'

const mockGetSession = vi.fn()
vi.mock('../lib/supabaseClient', () => ({
  supabase: { auth: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/mcp-authorize" element={<McpAuthorize />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  mockGetSession.mockReset()
  mockFetch.mockReset()
  // jsdom doesn't implement navigation — McpAuthorize sets
  // window.location.href on success, which would throw "not implemented"
  // in jsdom if left untouched.
  delete (window as any).location
  ;(window as any).location = { href: '' }
})

describe('McpAuthorize', () => {
  it('shows an error and does not call fetch when the flow query param is missing', () => {
    renderAt('/mcp-authorize')
    expect(screen.getByText(/missing or invalid authorization request/i)).toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('posts the real session access_token to the mcp-server and redirects on success', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'real-supabase-token' } } })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ redirect_uri: 'https://claude.ai/callback?code=abc123' }),
    })

    renderAt('/mcp-authorize?flow=flow-123')
    fireEvent.click(screen.getByText('Authorize'))

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8787/oauth/authorize/flow-123/complete',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ access_token: 'real-supabase-token' }),
      })
    ))
    await waitFor(() => expect(window.location.href).toBe('https://claude.ai/callback?code=abc123'))
  })

  it('shows an error instead of redirecting when there is no active session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    renderAt('/mcp-authorize?flow=flow-123')
    fireEvent.click(screen.getByText('Authorize'))

    expect(await screen.findByText(/no active session/i)).toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('shows the server error instead of redirecting when the mcp-server rejects the request', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'real-supabase-token' } } })
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'invalid_grant', error_description: 'invalid Supabase session' }),
    })

    renderAt('/mcp-authorize?flow=flow-123')
    fireEvent.click(screen.getByText('Authorize'))

    expect(await screen.findByText('invalid Supabase session')).toBeInTheDocument()
  })
})
