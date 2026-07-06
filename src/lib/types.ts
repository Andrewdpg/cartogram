export interface DiagramNodeData {
  id: string
  label: string
  kind: string
  childDiagram?: string
  x?: number
  y?: number
}

export interface DiagramEdgeData {
  from: string
  to: string
  label?: string
}

export interface Diagram {
  id: string
  title: string
  nodes: DiagramNodeData[]
  edges: DiagramEdgeData[]
}

export class DiagramNotFoundError extends Error {
  constructor(public diagramId: string) {
    super(`Diagram not found: ${diagramId}`)
    this.name = 'DiagramNotFoundError'
  }
}
