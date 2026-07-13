import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { BrandMark } from './AppHeader'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) {
      setError(error.message)
      return
    }
    setSent(true)
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <BrandMark size={32} />
        <h1>cartogram</h1>
        {sent ? (
          <p>Check your email for a magic link to sign in.</p>
        ) : (
          <>
            <p className="hint">Trace your system's territory</p>
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary">
                Send magic link
              </button>
              {error && (
                <p role="alert" className="alert">
                  {error}
                </p>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  )
}
