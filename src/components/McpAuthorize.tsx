import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const mcpServerUrl = import.meta.env.VITE_MCP_SERVER_URL ?? 'http://localhost:8787'

type Status = 'idle' | 'authorizing' | 'error'

export function McpAuthorize() {
  const [searchParams] = useSearchParams()
  const flowId = searchParams.get('flow')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleAuthorize() {
    if (!flowId) return
    setStatus('authorizing')
    setError(null)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        setError('No active session — please log in again.')
        setStatus('error')
        return
      }

      const res = await fetch(`${mcpServerUrl}/oauth/authorize/${flowId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: session.access_token }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error_description ?? body.error ?? 'Authorization failed')
        setStatus('error')
        return
      }

      window.location.href = body.redirect_uri
    } catch (err) {
      setError((err as Error).message)
      setStatus('error')
    }
  }

  if (!flowId) {
    return (
      <div style={{ padding: 24 }}>
        <p role="alert">Missing or invalid authorization request.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 480 }}>
      <h1>Authorize MCP access</h1>
      <p>
        An MCP-connected AI agent (e.g. Claude Code) is requesting access to your
        architecture-map account. It will only be able to reach projects you
        explicitly grant it from <code>/settings/integrations</code>.
      </p>
      {error && <p role="alert">{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={handleAuthorize} disabled={status === 'authorizing'}>
          {status === 'authorizing' ? 'Authorizing…' : 'Authorize'}
        </button>
      </div>
    </div>
  )
}
