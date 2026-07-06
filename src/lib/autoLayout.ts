import dagre from 'dagre'
import type { DiagramNodeData, DiagramEdgeData } from './types'

export interface PositionedNode extends DiagramNodeData {
  x: number
  y: number
}

const BASE_WIDTH = 180
const BASE_HEIGHT = 60
const LINE_HEIGHT = 16

// ponytail: dagre needs a size estimate per node to pack the layout without
// overlap — the real DOM size varies with content (responsibility line, tech
// badges, class attributes/operations, database cap curves), so this
// approximates it instead of assuming every node is the same fixed box.
function estimateNodeSize(node: DiagramNodeData): { width: number; height: number } {
  const width = Math.max(BASE_WIDTH, node.label.length * 8 + 60)

  if (node.kind === 'class') {
    const attributeLines = node.attributes?.length ?? 0
    const operationLines = node.operations?.length ?? 0
    const height = 40 + (attributeLines > 0 ? 12 + attributeLines * LINE_HEIGHT : 0) + (operationLines > 0 ? 12 + operationLines * LINE_HEIGHT : 0)
    return { width, height: Math.max(BASE_HEIGHT, height) }
  }

  let height = BASE_HEIGHT
  if (node.responsibility) height += 18
  if (node.techStack && node.techStack.length > 0) height += 20
  if (node.kind === 'database') height += 16

  return { width, height }
}

export function layoutDiagram(nodes: DiagramNodeData[], edges: DiagramEdgeData[]): PositionedNode[] {
  const graph = new dagre.graphlib.Graph()
  graph.setGraph({ rankdir: 'LR', nodesep: 70, ranksep: 110 })
  graph.setDefaultEdgeLabel(() => ({}))

  for (const node of nodes) {
    graph.setNode(node.id, estimateNodeSize(node))
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
