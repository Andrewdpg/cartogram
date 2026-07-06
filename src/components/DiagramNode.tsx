import { Handle, Position } from '@xyflow/react'

export interface DiagramNodeData {
  label: string
  kind: string
}

export interface DiagramNodeProps {
  data: DiagramNodeData
}

const KIND_STYLES: Record<string, { fg: string; bg: string }> = {
  service: { fg: '#8b93f8', bg: '#23253a' },
  bridge: { fg: '#e0a45e', bg: '#2c2620' },
  database: { fg: '#6fbf8f', bg: '#1f2b24' },
  component: { fg: '#c98bd6', bg: '#2a2130' },
  external: { fg: '#9096a8', bg: '#23252c' },
}
const DEFAULT_STYLE = { fg: '#9096a8', bg: '#23252c' }

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
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        borderRadius: 8,
        border: `1px solid ${style.fg}`,
        background: style.bg,
        color: '#e7e8ed',
        fontFamily: "'Outfit', system-ui, sans-serif",
        fontSize: 13,
        fontWeight: 500,
        minWidth: 150,
        boxShadow: `0 2px 10px -4px ${style.fg}55`,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <span
        style={{
          width: 7,
          height: 7,
          flexShrink: 0,
          borderRadius: '50%',
          background: style.fg,
        }}
      />
      {label}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
