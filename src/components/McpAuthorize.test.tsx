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

function mockLoadFlow(requestedScope: string) {
  mockFetch.mockImplementation((url: string) => {
    if (typeof url === 'string' && url.endsWith('/complete')) {
      return Promise.resolve({ ok: true, json: async () => ({ redirect_uri: 'https://claude.ai/callback?code=abc123' }) })
    }
    return Promise.resolve({ ok: true, json: async () => ({ requested_scope: requestedScope }) })
  })
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

  it('loads the requested scope and pre-checks it, letting the user grant only what they choose', async () => {
    mockLoadFlow('read write')
    renderAt('/mcp-authorize?flow=flow-123')

    const readBox = await screen.findByRole('checkbox', { name: /read/i })
    const writeBox = screen.getByRole('checkbox', { name: /write/i })
    const adminBox = screen.getByRole('checkbox', { name: /admin/i })
    expect(readBox).toBeChecked()
    expect(writeBox).toBeChecked()
    expect(adminBox).not.toBeChecked()
  })

  it('posts only the user-checked scopes, not whatever the client requested', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'real-supabase-token' } } })
    mockLoadFlow('read write admin')

    renderAt('/mcp-authorize?flow=flow-123')
    await screen.findByRole('checkbox', { name: /admin/i })

    // User unchecks admin before granting, even though the client asked for it.
    fireEvent.click(screen.getByRole('checkbox', { name: /admin/i }))
    fireEvent.click(screen.getByText('Authorize'))

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/oauth/authorize/flow-123/complete',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ access_token: 'real-supabase-token', scopes: ['read', 'write'] }),
        })
      )
    )
    await waitFor(() => expect(window.location.href).toBe('https://claude.ai/callback?code=abc123'))
  })

  it('disables the Authorize button when every scope is unchecked', async () => {
    mockLoadFlow('read')
    renderAt('/mcp-authorize?flow=flow-123')
    const readBox = await screen.findByRole('checkbox', { name: /read/i })

    fireEvent.click(readBox)

    expect(screen.getByText('Authorize')).toBeDisabled()
  })

  it('shows an error instead of redirecting when there is no active session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockLoadFlow('read')

    renderAt('/mcp-authorize?flow=flow-123')
    await screen.findByText('Authorize')
    fireEvent.click(screen.getByText('Authorize'))

    expect(await screen.findByText(/no active session/i)).toBeInTheDocument()
  })

  it('shows the server error instead of redirecting when the mcp-server rejects the request', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'real-supabase-token' } } })
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.endsWith('/complete')) {
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: 'invalid_grant', error_description: 'invalid Supabase session' }),
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({ requested_scope: 'read' }) })
    })

    renderAt('/mcp-authorize?flow=flow-123')
    await screen.findByText('Authorize')
    fireEvent.click(screen.getByText('Authorize'))

    expect(await screen.findByText('invalid Supabase session')).toBeInTheDocument()
  })
})
