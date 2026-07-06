import { Handle, Position } from '@xyflow/react'
import type { DiagramNodeData } from '../lib/types'
import { NODE_SHAPES } from './nodeShapes'
import { getTechIcon } from '../lib/techIcons'

export interface DiagramNodeProps {
  data: DiagramNodeData & { onOpenDetail?: (nodeId: string) => void }
}

// ponytail: typed against our own DiagramNodeData, not @xyflow/react's
// NodeProps — React Flow calls this with more props at runtime (id,
// selected, dragging, ...), which we simply don't declare or use. Avoids
// coupling to a type shape that has changed across major versions of the
// library.
export function DiagramNode({ data }: DiagramNodeProps) {
  const Shape = NODE_SHAPES[data.kind]

  return (
    <Shape node={data}>
      <Handle type="target" position={Position.Left} />
      {data.onOpenDetail && (
        <button
          aria-label={`View details for ${data.label}`}
          onClick={(e) => {
            e.stopPropagation()
            data.onOpenDetail?.(data.id)
          }}
          style={{
            position: 'absolute',
            top: -6,
            right: -6,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 12,
            lineHeight: 1,
            padding: 2,
          }}
        >
          👁
        </button>
      )}
      <span style={{ fontWeight: 600, fontSize: 13 }}>{data.label}</span>
      {data.responsibility && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{data.responsibility}</span>
      )}
      {data.techStack && data.techStack.length > 0 && (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 4 }}>
          {data.techStack.map((id) => {
            const icon = getTechIcon(id)
            return (
              <span
                key={id}
                title={icon.label}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: icon.bg,
                  color: icon.fg,
                  fontSize: 8,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {icon.short}
              </span>
            )
          })}
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </Shape>
  )
}
