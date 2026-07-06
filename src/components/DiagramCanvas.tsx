import type { ComponentType } from 'react'
import { useEffect, useMemo } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { DiagramNode } from './DiagramNode'
import { RELATIONSHIP_MARKER_IDS, UmlMarkerDefs } from './umlMarkers'
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
  onNodeDetailRequest?: (nodeId: string) => void
}

function buildEdgeLabel(e: DiagramEdgeData): string | undefined {
  const parts = [
    e.order !== undefined ? `${e.order}.` : null,
    e.label ?? null,
    e.condition ? `[${e.condition}]` : null,
  ].filter((part): part is string => part !== null)
  return parts.length > 0 ? parts.join(' ') : undefined
}

export function DiagramCanvas({ nodes, edges, onNodeClick, onNodeDetailRequest }: DiagramCanvasProps) {
  // ponytail: React Flow needs its own node state to keep drag positions —
  // passing a freshly-computed `nodes` array straight into `<ReactFlow>`
  // resets positions to the auto-layout on every unrelated re-render (e.g.
  // opening the detail panel). Re-seed only when the diagram itself changes
  // (different node ids), not on every parent render.
  const diagramKey = useMemo(() => JSON.stringify(nodes), [nodes])

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<Node>([])

  useEffect(() => {
    setFlowNodes(
      nodes.map((n) => ({
        id: n.id,
        position: { x: n.x, y: n.y },
        data: {
          id: n.id,
          label: n.label,
          kind: n.kind,
          responsibility: n.responsibility,
          techStack: n.techStack,
          dataOwned: n.dataOwned,
          gotchas: n.gotchas,
          attributes: n.attributes,
          operations: n.operations,
          onOpenDetail: onNodeDetailRequest,
        },
        type: 'diagramNode',
      }))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagramKey, onNodeDetailRequest])

  const flowEdges: Edge[] = edges.map((e) => {
    const markerId = e.relationship ? RELATIONSHIP_MARKER_IDS[e.relationship] : undefined
    const dashed = e.relationship === 'dependency' || e.async === true
    return {
      id: `${e.from}->${e.to}`,
      source: e.from,
      target: e.to,
      label: buildEdgeLabel(e),
      markerEnd: markerId ? `url(#${markerId})` : undefined,
      style: { stroke: '#3a3e4b', strokeDasharray: dashed ? '4 3' : undefined },
      labelStyle: { fill: '#9096a8', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
      labelBgStyle: { fill: '#1b1d24' },
    }
  })

  return (
    <div style={{ width: '100%', height: '100%', background: '#14151a' }}>
      <UmlMarkerDefs />
      <ReactFlowProvider>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
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
