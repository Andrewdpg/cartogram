import type { DiagramNodeData, Notation } from '../lib/types'
import { getTechIcon } from '../lib/techIcons'

export interface DiagramDetailPanelProps {
  node: DiagramNodeData | null
  notation: Notation
  onClose: () => void
}

const sectionHeadingStyle = { fontSize: 12, textTransform: 'uppercase' as const, color: 'var(--text-muted)' }

export function DiagramDetailPanel({ node, notation, onClose }: DiagramDetailPanelProps) {
  if (!node) return null

  const showClassMembers = node.kind === 'class' && notation === 'uml-structural'

  return (
    <aside
      style={{
        width: 320,
        flexShrink: 0,
        borderLeft: '1px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--text)',
        padding: 16,
        overflowY: 'auto',
      }}
    >
      <button
        aria-label="Close details"
        onClick={onClose}
        style={{ float: 'right', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14 }}
      >
        ✕
      </button>
      <h2 style={{ fontSize: 16, marginTop: 0 }}>{node.label}</h2>
      {node.responsibility && <p>{node.responsibility}</p>}

      {node.techStack && node.techStack.length > 0 && (
        <section>
          <h3 style={sectionHeadingStyle}>Tech stack</h3>
          <ul>
            {node.techStack.map((id) => (
              <li key={id}>{getTechIcon(id).label}</li>
            ))}
          </ul>
        </section>
      )}

      {node.dataOwned && (
        <section>
          <h3 style={sectionHeadingStyle}>Data owned</h3>
          <p>{node.dataOwned}</p>
        </section>
      )}

      {node.gotchas && node.gotchas.length > 0 && (
        <section>
          <h3 style={sectionHeadingStyle}>Gotchas</h3>
          <ul>
            {node.gotchas.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </section>
      )}

      {showClassMembers && node.attributes && node.attributes.length > 0 && (
        <section>
          <h3 style={sectionHeadingStyle}>Attributes</h3>
          <ul>
            {node.attributes.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      {showClassMembers && node.operations && node.operations.length > 0 && (
        <section>
          <h3 style={sectionHeadingStyle}>Operations</h3>
          <ul>
            {node.operations.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  )
}
