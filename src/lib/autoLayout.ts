import dagre from 'dagre'
import type { DiagramNodeData, DiagramEdgeData } from './types'

export interface PositionedNode extends DiagramNodeData {
  x: number
  y: number
}

const NODE_WIDTH = 180
const NODE_HEIGHT = 60

export function layoutDiagram(nodes: DiagramNodeData[], edges: DiagramEdgeData[]): PositionedNode[] {
  const graph = new dagre.graphlib.Graph()
  graph.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 80 })
  graph.setDefaultEdgeLabel(() => ({}))

  for (const node of nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const edge of edges) {
    graph.setEdge(edge.from, edge.to)
  }

  dagre.layout(graph)

  return nodes.map((node) => {
    if (node.x !== undefined && node.y !== undefined) {
      return { ...node, x: node.x, y: node.y }
    }
    const computed = graph.node(node.id)
    return { ...node, x: computed.x, y: computed.y }
  })
}
