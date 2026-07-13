import type { ReactNode } from 'react'

export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r="6" fill="var(--accent)" />
      <circle cx="36" cy="36" r="16" fill="none" stroke="var(--accent)" strokeWidth="2" opacity="0.75" />
      <circle cx="36" cy="36" r="26" fill="none" stroke="var(--accent)" strokeWidth="1.4" opacity="0.4" />
    </svg>
  )
}

export function AppHeader({ context, actions }: { context?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="app-header">
      <div className="app-header-left">
        <div className="app-header-brand">
          <BrandMark />
          <span>cartogram</span>
        </div>
        {context}
      </div>
      {actions && <div className="app-header-actions">{actions}</div>}
    </header>
  )
}
