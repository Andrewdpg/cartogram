import type { ComponentType } from 'react'
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, type Node, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { DiagramNode } from './DiagramNode'
import type { PositionedNode } from '../lib/autoLayout'
import type { DiagramEdgeData } from '../lib/types'

// ponytail: DiagramNode declares its own minimal prop type (just `data`)
// rather than @xyflow/react's NodeProps, so it's cast here at the one place
// that's wired into the library. See DiagramNode.tsx for why.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes = { diagramNode: DiagramNode as ComponentType<any> }

export interface DiagramCanvasProps {
  nodes: PositionedNode[]
  edges: DiagramEdgeData[]
  onNodeClick: (nodeId: string) => void
}

export function DiagramCanvas({ nodes, edges, onNodeClick }: DiagramCanvasProps) {
  const flowNodes: Node[] = nodes.map((n) => ({
    id: n.id,
    position: { x: n.x, y: n.y },
    data: { label: n.label, kind: n.kind },
    type: 'diagramNode',
  }))

  const flowEdges: Edge[] = edges.map((e) => ({
    id: `${e.from}->${e.to}`,
    source: e.from,
    target: e.to,
    label: e.label,
    labelStyle: { fill: '#9096a8', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
    labelBgStyle: { fill: '#1b1d24' },
    style: { stroke: '#3a3e4b' },
  }))

  return (
    <div style={{ width: '100%', height: '100%', background: '#14151a' }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => onNodeClick(node.id)}
          fitView
          defaultEdgeOptions={{ style: { stroke: '#3a3e4b' } }}
        >
          <Background variant={BackgroundVariant.Dots} color="#2d303b" gap={20} />
          <Controls style={{ filter: 'invert(0.9) hue-rotate(180deg)' }} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}
