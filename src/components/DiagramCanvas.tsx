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
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { DiagramNode } from './DiagramNode'
import { UmlMarkerDefs } from './umlMarkers'
import { buildFlowEdges } from './buildFlowEdges'
import { computeEdgeRouting } from '../lib/edgeGeometry'
import { estimateNodeSize } from '../lib/autoLayout'
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

  // ponytail: recomputed from `flowNodes`' LIVE positions (not the static
  // `nodes` prop) so dragging a box re-evaluates which side is actually
  // closest — keyed on a position-signature string, not the flowNodes array
  // reference, so it only recomputes when a position value actually changes.
  // Deliberately NOT stored back into flowNodes via a `setFlowNodes` effect:
  // that would make routing depend on flowNodes and flowNodes depend on
  // routing's output, ping-ponging forever. Instead it's merged into the
  // node list at render time, below.
  const positionSignature = flowNodes.map((n) => `${n.id}:${n.position.x}:${n.position.y}`).join('|')
  const routing = useMemo(() => {
    const sized = flowNodes.map((n) => {
      const original = nodes.find((orig) => orig.id === n.id)
      const size = original ? estimateNodeSize(original) : { width: 180, height: 60 }
      return { id: n.id, x: n.position.x, y: n.position.y, ...size }
    })
    return computeEdgeRouting(
      sized,
      edges.map((e) => ({ id: `${e.from}->${e.to}`, from: e.from, to: e.to }))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionSignature, edges, nodes])

  const renderedNodes: Node[] = flowNodes.map((n) => ({
    ...n,
    data: { ...n.data, handlePlacements: routing.nodeHandles.get(n.id) ?? [] },
  }))

  const flowEdges = buildFlowEdges(edges, routing)

  return (
    <div style={{ width: '100%', height: '100%', background: '#14151a' }}>
      <UmlMarkerDefs />
      <ReactFlowProvider>
        <ReactFlow
          nodes={renderedNodes}
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
