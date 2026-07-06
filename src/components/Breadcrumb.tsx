export interface BreadcrumbProps {
  labels: string[]
  onNavigate: (index: number) => void
}

export function Breadcrumb({ labels, onNavigate }: BreadcrumbProps) {
  return (
    <nav aria-label="breadcrumb" style={{ padding: '8px 12px', borderBottom: '1px solid #ddd' }}>
      {labels.map((label, index) => (
        <span key={index}>
          {index > 0 && <span style={{ margin: '0 6px' }}>/</span>}
          <button
            onClick={() => onNavigate(index)}
            disabled={index === labels.length - 1}
            style={{ border: 'none', background: 'none', cursor: 'pointer', font: 'inherit' }}
          >
            {label}
          </button>
        </span>
      ))}
    </nav>
  )
}
