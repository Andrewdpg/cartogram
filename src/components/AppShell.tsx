import { Link, Outlet, useParams } from 'react-router-dom'
import { AppHeader } from './AppHeader'
import { UserMenu } from './UserMenu'

export function AppShell() {
  const { projectId } = useParams<{ projectId: string }>()

  return (
    <div className="app-shell">
      <AppHeader
        actions={
          <>
            {projectId && (
              <Link to="/projects" className="btn">
                ← All projects
              </Link>
            )}
            <UserMenu />
          </>
        }
      />
      <div className="app-shell-content">
        <Outlet />
      </div>
    </div>
  )
}
