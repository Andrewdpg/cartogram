export type NodeKind =
  | 'system'
  | 'container'
  | 'component'
  | 'service'
  | 'server'
  | 'database'
  | 'class'
  | 'external'
  | 'bridge'

export const NODE_KINDS: readonly NodeKind[] = [
  'system',
  'container',
  'component',
  'service',
  'server',
  'database',
  'class',
  'external',
  'bridge',
]

export type Notation = 'c4' | 'uml-structural' | 'uml-behavioral'

export const NOTATIONS: readonly Notation[] = ['c4', 'uml-structural', 'uml-behavioral']

export type UmlRelationship = 'association' | 'composition' | 'inheritance' | 'dependency'

export const UML_RELATIONSHIPS: readonly UmlRelationship[] = [
  'association',
  'composition',
  'inheritance',
  'dependency',
]

export interface DiagramNodeData {
  id: string
  label: string
  kind: NodeKind
  childDiagram?: string
  x?: number
  y?: number
  responsibility?: string
  techStack?: string[]
  dataOwned?: string
  gotchas?: string[]
  attributes?: string[]
  operations?: string[]
  sourceRefs?: string[]
}

export interface DiagramEdgeData {
  from: string
  to: string
  label?: string
  relationship?: UmlRelationship
  order?: number
  async?: boolean
  condition?: string
}

export interface Diagram {
  id: string
  title: string
  notation?: Notation
  nodes: DiagramNodeData[]
  edges: DiagramEdgeData[]
}

export class DiagramNotFoundError extends Error {
  constructor(public diagramId: string) {
    super(`Diagram not found: ${diagramId}`)
    this.name = 'DiagramNotFoundError'
  }
}
