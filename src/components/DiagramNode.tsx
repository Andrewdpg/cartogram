import { Handle, Position } from '@xyflow/react'

export interface DiagramNodeData {
  label: string
  kind: string
}

export interface DiagramNodeProps {
  data: DiagramNodeData
}

const KIND_STYLES: Record<string, { background: string; border: string }> = {
  service: { background: '#e8f0fe', border: '#4f8cff' },
  bridge: { background: '#fdf3e3', border: '#f5a623' },
  database: { background: '#eaf7e3', border: '#7ed321' },
  component: { background: '#f6e8fd', border: '#bd10e0' },
  external: { background: '#f0f0f0', border: '#9b9b9b' },
}
const DEFAULT_STYLE = { background: '#f0f0f0', border: '#9b9b9b' }

// ponytail: typed against our own minimal DiagramNodeProps, not
// @xyflow/react's NodeProps — React Flow calls this with more props at
// runtime (id, selected, dragging, ...), which we simply don't declare or
// use. Avoids coupling to a type shape that has changed across major
// versions of the library.
export function DiagramNode({ data }: DiagramNodeProps) {
  const { label, kind } = data
  const style = KIND_STYLES[kind] ?? DEFAULT_STYLE

  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: 6,
        border: `2px solid ${style.border}`,
        background: style.background,
        fontSize: 13,
        minWidth: 140,
        textAlign: 'center',
      }}
    >
      <Handle type="target" position={Position.Left} />
      {label}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
