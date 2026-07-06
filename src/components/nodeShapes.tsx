import type { CSSProperties, ReactNode } from 'react'
import type { DiagramNodeData, NodeKind } from '../lib/types'

export interface ShapeProps {
  node: DiagramNodeData
  children: ReactNode
}

const baseBoxStyle = (kind: NodeKind): CSSProperties => ({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  padding: '10px 14px',
  minWidth: 160,
  color: 'var(--text)',
  fontFamily: 'var(--font-ui)',
  background: `var(--kind-${kind}-bg)`,
  border: `1px solid var(--kind-${kind}-fg)`,
})

function SystemShape({ children }: ShapeProps) {
  return (
    <div data-shape="system" style={{ ...baseBoxStyle('system'), borderRadius: 16 }}>
      {children}
    </div>
  )
}

function ContainerShape({ children }: ShapeProps) {
  return (
    <div data-shape="container" style={{ ...baseBoxStyle('container'), borderRadius: 8, borderBottomWidth: 4 }}>
      {children}
    </div>
  )
}

function ComponentShape({ children }: ShapeProps) {
  return (
    <div data-shape="component" style={{ ...baseBoxStyle('component'), borderRadius: 4, paddingLeft: 20 }}>
      <span
        style={{
          position: 'absolute',
          left: -4,
          top: 8,
          width: 12,
          height: 6,
          background: 'var(--kind-component-fg)',
          borderRadius: 2,
        }}
      />
      <span
        style={{
          position: 'absolute',
          left: -4,
          top: 20,
          width: 12,
          height: 6,
          background: 'var(--kind-component-fg)',
          borderRadius: 2,
        }}
      />
      {children}
    </div>
  )
}

function ServiceShape({ children }: ShapeProps) {
  return (
    <div data-shape="service" style={{ ...baseBoxStyle('service'), borderRadius: 8, borderTopWidth: 4 }}>
      {children}
    </div>
  )
}

function ServerShape({ children }: ShapeProps) {
  return (
    <div data-shape="server" style={{ ...baseBoxStyle('server'), borderRadius: 2, paddingLeft: 22 }}>
      <div
        style={{
          position: 'absolute',
          left: 6,
          top: 8,
          bottom: 8,
          width: 8,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ height: 2, background: 'var(--kind-server-fg)' }} />
        <span style={{ height: 2, background: 'var(--kind-server-fg)' }} />
        <span style={{ height: 2, background: 'var(--kind-server-fg)' }} />
      </div>
      {children}
    </div>
  )
}

function DatabaseShape({ children }: ShapeProps) {
  return (
    <div data-shape="database" style={{ position: 'relative', minWidth: 160, color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
      <svg width="100%" height="16" style={{ position: 'absolute', top: -8, left: 0 }} viewBox="0 0 100 16" preserveAspectRatio="none">
        <ellipse cx="50" cy="8" rx="49" ry="7" fill="var(--kind-database-bg)" stroke="var(--kind-database-fg)" />
      </svg>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--kind-database-bg)',
          borderLeft: '1px solid var(--kind-database-fg)',
          borderRight: '1px solid var(--kind-database-fg)',
          padding: '14px 14px 10px',
        }}
      >
        {children}
      </div>
      <svg width="100%" height="16" style={{ position: 'absolute', bottom: -8, left: 0 }} viewBox="0 0 100 16" preserveAspectRatio="none">
        <path d="M1 0 A49 7 0 0 0 99 0 L99 8 A49 7 0 0 1 1 8 Z" fill="var(--kind-database-bg)" stroke="var(--kind-database-fg)" />
      </svg>
    </div>
  )
}

function ClassShape({ node, children }: ShapeProps) {
  return (
    <div data-shape="class" style={{ ...baseBoxStyle('class'), borderRadius: 2, padding: 0 }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--kind-class-fg)' }}>{children}</div>
      {node.attributes && node.attributes.length > 0 && (
        <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--kind-class-fg)', fontSize: 11 }}>
          {node.attributes.map((a, i) => (
            <div key={i}>{a}</div>
          ))}
        </div>
      )}
      {node.operations && node.operations.length > 0 && (
        <div style={{ padding: '6px 12px', fontSize: 11 }}>
          {node.operations.map((o, i) => (
            <div key={i}>{o}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function ExternalShape({ children }: ShapeProps) {
  return (
    <div data-shape="external" style={{ ...baseBoxStyle('external'), borderRadius: 16, borderStyle: 'dashed' }}>
      {children}
    </div>
  )
}

function BridgeShape({ children }: ShapeProps) {
  return (
    <div data-shape="bridge" style={{ ...baseBoxStyle('bridge'), borderRadius: 4, paddingLeft: 20, paddingRight: 20 }}>
      <span
        style={{
          position: 'absolute',
          left: -6,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 0,
          height: 0,
          borderTop: '6px solid transparent',
          borderBottom: '6px solid transparent',
          borderRight: '6px solid var(--kind-bridge-fg)',
        }}
      />
      <span
        style={{
          position: 'absolute',
          right: -6,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 0,
          height: 0,
          borderTop: '6px solid transparent',
          borderBottom: '6px solid transparent',
          borderLeft: '6px solid var(--kind-bridge-fg)',
        }}
      />
      {children}
    </div>
  )
}

export const NODE_SHAPES: Record<NodeKind, (props: ShapeProps) => JSX.Element> = {
  system: SystemShape,
  container: ContainerShape,
  component: ComponentShape,
  service: ServiceShape,
  server: ServerShape,
  database: DatabaseShape,
  class: ClassShape,
  external: ExternalShape,
  bridge: BridgeShape,
}
