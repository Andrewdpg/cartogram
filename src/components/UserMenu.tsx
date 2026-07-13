import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useSession } from '../lib/useSession'

export function UserMenu() {
  const { session } = useSession()
  if (!session) return null

  return (
    <details className="user-menu">
      <summary className="user-menu-trigger">{session.user.email}</summary>
      <div className="user-menu-dropdown">
        <Link to="/settings/integrations" className="user-menu-item">
          Settings
        </Link>
        <button className="user-menu-item" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    </details>
  )
}
