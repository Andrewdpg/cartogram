import { Link, Outlet, useLocation } from 'react-router-dom'
import { AppHeader } from './AppHeader'
import { UserMenu } from './UserMenu'

export function AppShell() {
  const location = useLocation()
  const showBackLink = location.pathname !== '/projects'

  return (
    <div className="app-shell">
      <AppHeader
        context={
          showBackLink && (
            <Link to="/projects" className="btn">
              ← All projects
            </Link>
          )
        }
        actions={<UserMenu />}
      />
      <div className="app-shell-content">
        <Outlet />
      </div>
    </div>
  )
}
