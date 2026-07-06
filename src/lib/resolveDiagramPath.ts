import type { Diagram } from './types'
import { DiagramNotFoundError } from './types'

export interface ResolvedDiagramPath {
  chain: Diagram[]
}

export function resolveDiagramPath(
  segments: string[],
  loadFn: (id: string) => Diagram
): ResolvedDiagramPath {
  const root = loadFn('deployment')
  const chain: Diagram[] = [root]
  let current = root

  for (const nodeId of segments) {
    const node = current.nodes.find((n) => n.id === nodeId)
    if (!node || !node.childDiagram) {
      throw new DiagramNotFoundError(nodeId)
    }
    current = loadFn(node.childDiagram)
    chain.push(current)
  }

  return { chain }
}
