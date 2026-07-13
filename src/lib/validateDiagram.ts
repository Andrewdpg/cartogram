import type { Diagram, NodeKind, Notation, UmlRelationship } from './types'
import { NODE_KINDS, NOTATIONS, UML_RELATIONSHIPS } from './types'

export class InvalidDiagramError extends Error {
  constructor(diagramId: string, reason: string) {
    super(`Invalid diagram "${diagramId}": ${reason}`)
    this.name = 'InvalidDiagramError'
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
}

const NODE_FIELDS = new Set([
  'id', 'label', 'kind', 'childDiagram', 'x', 'y', 'responsibility',
  'techStack', 'dataOwned', 'gotchas', 'attributes', 'operations', 'sourceRefs',
])
const EDGE_FIELDS = new Set(['from', 'to', 'label', 'relationship', 'order', 'async', 'condition'])

// Rejects any field not in the schema, instead of silently ignoring it —
// see mcp-server/src/validateDiagramShape.ts (kept in sync manually with
// this file) for the incident that motivated this: an undocumented field
// passing validation with no error gave no signal it wasn't a real
// mechanism.
function assertNoUnknownFields(
  obj: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  diagramId: string,
  context: string
): void {
  const unknown = Object.keys(obj).filter((k) => !allowed.has(k))
  if (unknown.length > 0) {
    throw new InvalidDiagramError(
      diagramId,
      `${context} has unrecognized field(s): ${unknown.join(', ')}. Valid fields: ${Array.from(allowed).join(', ')}`
    )
  }
}

export function validateDiagramShape(raw: unknown, diagramId: string): Diagram {
  if (typeof raw !== 'object' || raw === null) {
    throw new InvalidDiagramError(diagramId, 'not an object')
  }
  const d = raw as Partial<Diagram>

  if (typeof d.id !== 'string') throw new InvalidDiagramError(diagramId, 'missing "id"')
  if (typeof d.title !== 'string') throw new InvalidDiagramError(diagramId, 'missing "title"')
  if (d.notation !== undefined && !NOTATIONS.includes(d.notation as Notation)) {
    throw new InvalidDiagramError(diagramId, `invalid "notation": ${JSON.stringify(d.notation)}`)
  }
  if (!Array.isArray(d.nodes)) throw new InvalidDiagramError(diagramId, 'missing "nodes" array')
  if (!Array.isArray(d.edges)) throw new InvalidDiagramError(diagramId, 'missing "edges" array')

  d.nodes.forEach((n, i) => {
    if (typeof n !== 'object' || n === null) {
      throw new InvalidDiagramError(diagramId, `node at index ${i} is not an object`)
    }
    const node = n as unknown as Record<string, unknown>
    if (typeof node.id !== 'string') {
      throw new InvalidDiagramError(diagramId, `node at index ${i} missing "id"`)
    }
    if (typeof node.label !== 'string') {
      throw new InvalidDiagramError(diagramId, `node at index ${i} missing "label"`)
    }
    if (typeof node.kind !== 'string' || !NODE_KINDS.includes(node.kind as NodeKind)) {
      throw new InvalidDiagramError(
        diagramId,
        `node "${node.id ?? i}" has invalid "kind": ${JSON.stringify(node.kind)}`
      )
    }
    if (node.responsibility !== undefined && typeof node.responsibility !== 'string') {
      throw new InvalidDiagramError(diagramId, `node "${node.id}" has invalid "responsibility" (must be string)`)
    }
    if (node.dataOwned !== undefined && typeof node.dataOwned !== 'string') {
      throw new InvalidDiagramError(diagramId, `node "${node.id}" has invalid "dataOwned" (must be string)`)
    }
    for (const field of ['techStack', 'gotchas', 'attributes', 'operations', 'sourceRefs'] as const) {
      if (node[field] !== undefined && !isStringArray(node[field])) {
        throw new InvalidDiagramError(diagramId, `node "${node.id}" has invalid "${field}" (must be string[])`)
      }
    }
    assertNoUnknownFields(node, NODE_FIELDS, diagramId, `node "${node.id}"`)
  })

  d.edges.forEach((e, i) => {
    if (typeof e !== 'object' || e === null) {
      throw new InvalidDiagramError(diagramId, `edge at index ${i} is not an object`)
    }
    const edge = e as unknown as Record<string, unknown>
    if (typeof edge.from !== 'string') {
      throw new InvalidDiagramError(diagramId, `edge at index ${i} missing "from"`)
    }
    if (typeof edge.to !== 'string') {
      throw new InvalidDiagramError(diagramId, `edge at index ${i} missing "to"`)
    }
    if (edge.relationship !== undefined && !UML_RELATIONSHIPS.includes(edge.relationship as UmlRelationship)) {
      throw new InvalidDiagramError(
        diagramId,
        `edge "${edge.from}->${edge.to}" has invalid "relationship": ${JSON.stringify(edge.relationship)}`
      )
    }
    if (edge.order !== undefined && typeof edge.order !== 'number') {
      throw new InvalidDiagramError(diagramId, `edge "${edge.from}->${edge.to}" has invalid "order" (must be number)`)
    }
    if (edge.async !== undefined && typeof edge.async !== 'boolean') {
      throw new InvalidDiagramError(diagramId, `edge "${edge.from}->${edge.to}" has invalid "async" (must be boolean)`)
    }
    if (edge.condition !== undefined && typeof edge.condition !== 'string') {
      throw new InvalidDiagramError(
        diagramId,
        `edge "${edge.from}->${edge.to}" has invalid "condition" (must be string)`
      )
    }
    assertNoUnknownFields(edge, EDGE_FIELDS, diagramId, `edge "${edge.from}->${edge.to}"`)
  })

  const nodeIds = new Set(d.nodes.map((n) => (n as { id: string }).id))
  for (const edge of d.edges as Array<{ from: string; to: string }>) {
    if (!nodeIds.has(edge.from)) {
      throw new InvalidDiagramError(diagramId, `edge references unknown node "${edge.from}"`)
    }
    if (!nodeIds.has(edge.to)) {
      throw new InvalidDiagramError(diagramId, `edge references unknown node "${edge.to}"`)
    }
  }

  return d as Diagram
}

export function checkCrossFileReferences(diagrams: Record<string, Diagram>): string[] {
  const errors: string[] = []
  for (const [id, diagram] of Object.entries(diagrams)) {
    for (const node of diagram.nodes) {
      if (node.childDiagram && !(node.childDiagram in diagrams)) {
        errors.push(`${id}: node "${node.id}" references missing childDiagram "${node.childDiagram}"`)
      }
    }
  }
  return errors
}
