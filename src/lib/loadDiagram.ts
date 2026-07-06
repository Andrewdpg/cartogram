import type { Diagram } from './types'
import { DiagramNotFoundError } from './types'
import { validateDiagramShape } from './validateDiagram'

// ponytail: eager glob bundles every diagram JSON at build time. Fine for a
// local, single-user tool — no need for per-file async fetching or code
// splitting here.
const modules = import.meta.glob('/diagrams/*.json', { eager: true }) as Record<
  string,
  { default: unknown }
>

const rawDiagramsById = new Map<string, unknown>()
for (const path in modules) {
  const id = path.replace('/diagrams/', '').replace(/\.json$/, '')
  rawDiagramsById.set(id, modules[path].default)
}

export function loadDiagram(id: string): Diagram {
  const raw = rawDiagramsById.get(id)
  if (raw === undefined) {
    throw new DiagramNotFoundError(id)
  }
  return validateDiagramShape(raw, id)
}
