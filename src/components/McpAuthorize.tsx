import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { BrandMark } from './AppHeader'

const mcpServerUrl = import.meta.env.VITE_MCP_SERVER_URL ?? 'http://localhost:8787'

const SCOPE_DESCRIPTIONS: Record<'read' | 'write' | 'admin', string> = {
  read: 'View your projects and diagrams',
  write: 'Create and edit projects and diagrams',
  admin: 'Manage project collaborators and lifecycle',
}

type Status = 'loading' | 'idle' | 'authorizing' | 'error'

export function McpAuthorize() {
  const [searchParams] = useSearchParams()
  const flowId = searchParams.get('flow')
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [requestedScope, setRequestedScope] = useState<string | null>(null)
  const [grantedScopes, setGrantedScopes] = useState<Set<'read' | 'write' | 'admin'>>(new Set(['read']))

  useEffect(() => {
    if (!flowId) return
    fetch(`${mcpServerUrl}/oauth/authorize/${flowId}`)
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) {
          setError(body.error_description ?? body.error ?? 'Failed to load authorization request')
          setStatus('error')
          return
        }
        setRequestedScope(body.requested_scope)
        // Pre-check what the client requested (still just a hint — the
        // user can uncheck anything below before granting).
        setGrantedScopes(
          new Set(
            (body.requested_scope as string)
              .split(' ')
              .filter((s): s is 'read' | 'write' | 'admin' => s === 'read' || s === 'write' || s === 'admin')
          )
        )
        setStatus('idle')
      })
      .catch((err) => {
        setError((err as Error).message)
        setStatus('error')
      })
  }, [flowId])

  function toggleScope(scope: 'read' | 'write' | 'admin') {
    setGrantedScopes((prev) => {
      const next = new Set(prev)
      if (next.has(scope)) next.delete(scope)
      else next.add(scope)
      return next
    })
  }

  async function handleAuthorize() {
    if (!flowId || grantedScopes.size === 0) return
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
        body: JSON.stringify({ access_token: session.access_token, scopes: Array.from(grantedScopes) }),
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
      <div className="auth-shell">
        <div className="auth-card">
          <p role="alert" className="alert">
            Missing or invalid authorization request.
          </p>
        </div>
      </div>
    )
  }

  if (status === 'loading') return null

  return (
    <div className="auth-shell">
      <div className="auth-card auth-card-wide">
        <BrandMark size={32} />
        <h1>Authorize access</h1>
        <p className="auth-card-copy">
          An MCP-connected AI agent (e.g. Claude Code) is requesting access to your Cartogram account
          {requestedScope && (
            <>
              {' '}
              — requested <code>{requestedScope}</code>
            </>
          )}
          . Choose what to grant it — it will only reach projects you explicitly grant from Settings.
        </p>
        <div className="scope-list">
          {(Object.keys(SCOPE_DESCRIPTIONS) as Array<'read' | 'write' | 'admin'>).map((scope) => (
            <label key={scope} className="scope-item">
              <input
                type="checkbox"
                checked={grantedScopes.has(scope)}
                onChange={() => toggleScope(scope)}
              />
              <span>
                <span className="scope-item-name">{scope}</span>
                <span className="scope-item-desc">{SCOPE_DESCRIPTIONS[scope]}</span>
              </span>
            </label>
          ))}
        </div>
        {error && (
          <p role="alert" className="alert">
            {error}
          </p>
        )}
        <button
          className="btn btn-primary"
          onClick={handleAuthorize}
          disabled={status === 'authorizing' || grantedScopes.size === 0}
        >
          {status === 'authorizing' ? 'Authorizing…' : 'Authorize'}
        </button>
      </div>
    </div>
  )
}
