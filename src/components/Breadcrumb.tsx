export interface BreadcrumbProps {
  labels: string[]
  onNavigate: (index: number) => void
}

export function Breadcrumb({ labels, onNavigate }: BreadcrumbProps) {
  return (
    <nav
      aria-label="breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '10px 16px',
        background: '#1b1d24',
        borderBottom: '1px solid #2d303b',
        fontSize: 13,
      }}
    >
      {labels.map((label, index) => {
        const isCurrent = index === labels.length - 1
        return (
          <span key={index} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {index > 0 && <span style={{ color: '#5c6273' }}>/</span>}
            <button
              onClick={() => onNavigate(index)}
              disabled={isCurrent}
              style={{
                border: 'none',
                background: 'none',
                padding: '4px 6px',
                borderRadius: 4,
                font: 'inherit',
                color: isCurrent ? '#e7e8ed' : '#9096a8',
                fontWeight: isCurrent ? 600 : 400,
                cursor: isCurrent ? 'default' : 'pointer',
                transition: 'color 150ms, background 150ms',
              }}
              onMouseEnter={(e) => {
                if (!isCurrent) e.currentTarget.style.background = '#22252e'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none'
              }}
            >
              {label}
            </button>
          </span>
        )
      })}
    </nav>
  )
}
