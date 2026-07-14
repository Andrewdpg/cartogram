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
      <footer className="app-shell-footer">
        Cartogram is an active work in progress — expect rough edges, and treat this deployment as a
        demo rather than a stable service.{' '}
        <a href="https://github.com/Andrewdpg/cartogram" target="_blank" rel="noreferrer">
          Source and contributions welcome on GitHub
        </a>
        .
      </footer>
    </div>
  )
}
