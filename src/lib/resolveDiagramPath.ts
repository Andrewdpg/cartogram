import type { Diagram } from './types'
import { DiagramNotFoundError } from './types'

export interface LoadedDiagram {
  diagram: Diagram
  version: number
}

export interface ResolvedDiagramPath {
  chain: LoadedDiagram[]
}

export async function resolveDiagramPath(
  projectId: string,
  segments: string[],
  loadFn: (projectId: string, slug: string) => Promise<LoadedDiagram>
): Promise<ResolvedDiagramPath> {
  const root = await loadFn(projectId, 'deployment')
  const chain: LoadedDiagram[] = [root]
  let current = root.diagram

  for (const nodeId of segments) {
    const node = current.nodes.find((n) => n.id === nodeId)
    if (!node || !node.childDiagram) {
      throw new DiagramNotFoundError(nodeId)
    }
    const loaded = await loadFn(projectId, node.childDiagram)
    chain.push(loaded)
    current = loaded.diagram
  }

  return { chain }
}
