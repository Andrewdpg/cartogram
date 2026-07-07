export type Side = 'top' | 'right' | 'bottom' | 'left'

export interface HandlePlacement {
  id: string
  type: 'source' | 'target'
  side: Side
  offsetFraction: number // 0..1, position along that side (0 = one corner, 1 = the other)
}

export interface EdgeRouting {
  edgeId: string
  sourceHandle: string
  targetHandle: string
}

export interface RoutingResult {
  edgeRouting: EdgeRouting[]
  nodeHandles: Map<string, HandlePlacement[]>
}

interface NodePosition {
  id: string
  x: number
  y: number
}

interface EdgeRef {
  id: string
  from: string
  to: string
}

// ponytail: this tool only ever lays out left-to-right (rankdir: 'LR' in
// autoLayout.ts). A forward edge (target at or right of source) uses the
// natural right→left flow every other edge on that rank uses. A back edge
// (a cyclic "calls back" relationship — common when two services call each
// other) is routed bottom→top instead of fighting for the same left/right
// anchor point the forward edges already occupy on that node — that's what
// actually separates a bidirectional pair visually instead of bunching every
// line through one spot per side.
function pickSides(fromX: number, toX: number): { sourceSide: Side; targetSide: Side } {
  if (toX >= fromX) {
    return { sourceSide: 'right', targetSide: 'left' }
  }
  return { sourceSide: 'bottom', targetSide: 'top' }
}

interface SideGroup {
  nodeId: string
  side: Side
  type: 'source' | 'target'
  handleIds: string[]
}

/**
 * Computes, for every edge, which side of its source/target node it should
 * connect to, and a distinct handle id per edge so multiple edges sharing
 * the same (node, side) get spread evenly along it instead of stacking on
 * the exact same point.
 */
export function computeEdgeRouting(nodes: NodePosition[], edges: EdgeRef[]): RoutingResult {
  const positionById = new Map(nodes.map((n) => [n.id, n]))
  const sideGroups = new Map<string, SideGroup>()

  function registerHandle(nodeId: string, side: Side, type: 'source' | 'target'): string {
    const key = `${nodeId}|${side}|${type}`
    let group = sideGroups.get(key)
    if (!group) {
      group = { nodeId, side, type, handleIds: [] }
      sideGroups.set(key, group)
    }
    const handleId = `${key}#${group.handleIds.length}`
    group.handleIds.push(handleId)
    return handleId
  }

  const edgeRouting: EdgeRouting[] = []

  for (const edge of edges) {
    const from = positionById.get(edge.from)
    const to = positionById.get(edge.to)
    if (!from || !to) continue // dangling reference — validateDiagramShape already guards this elsewhere

    const { sourceSide, targetSide } = pickSides(from.x, to.x)
    const sourceHandle = registerHandle(edge.from, sourceSide, 'source')
    const targetHandle = registerHandle(edge.to, targetSide, 'target')
    edgeRouting.push({ edgeId: edge.id, sourceHandle, targetHandle })
  }

  const nodeHandles = new Map<string, HandlePlacement[]>()
  for (const group of sideGroups.values()) {
    const placements = nodeHandles.get(group.nodeId) ?? []
    group.handleIds.forEach((handleId, i) => {
      placements.push({
        id: handleId,
        type: group.type,
        side: group.side,
        offsetFraction: (i + 1) / (group.handleIds.length + 1),
      })
    })
    nodeHandles.set(group.nodeId, placements)
  }

  return { edgeRouting, nodeHandles }
}
