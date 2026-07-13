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
  loadFn: (projectId: string, slug: string) => Promise<LoadedDiagram>,
  rootSlug: string = 'deployment'
): Promise<ResolvedDiagramPath> {
  // A project with no 'deployment' diagram (e.g. its only diagram was
  // created directly under a different slug, by the MCP server or
  // otherwise) must surface as a normal "not found" — not an unhandled
  // Supabase/PostgREST error that crashes the page before the user ever
  // sees the diagram picker they could use to open what actually exists.
  let root: LoadedDiagram
  try {
    root = await loadFn(projectId, rootSlug)
  } catch (err) {
    if (err instanceof DiagramNotFoundError) throw err
    throw new DiagramNotFoundError(rootSlug)
  }
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
