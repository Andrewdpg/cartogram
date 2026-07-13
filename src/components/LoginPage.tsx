import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

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

  if (sent) {
    return <p>Check your email for a magic link to sign in.</p>
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <button type="submit">Send magic link</button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
