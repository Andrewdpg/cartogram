import { describe, it, expect } from 'vitest'
import { layoutDiagram } from './autoLayout'
import type { DiagramNodeData, DiagramEdgeData } from './types'

describe('layoutDiagram', () => {
  it('assigns numeric x/y to every node', () => {
    const nodes: DiagramNodeData[] = [
      { id: 'a', label: 'A', kind: 'service' },
      { id: 'b', label: 'B', kind: 'service' },
    ]
    const edges: DiagramEdgeData[] = [{ from: 'a', to: 'b' }]

    const positioned = layoutDiagram(nodes, edges)

    expect(positioned).toHaveLength(2)
    for (const n of positioned) {
      expect(typeof n.x).toBe('number')
      expect(typeof n.y).toBe('number')
    }
  })

  it('places a downstream node to the right of its upstream node (rankdir LR)', () => {
    const nodes: DiagramNodeData[] = [
      { id: 'a', label: 'A', kind: 'service' },
      { id: 'b', label: 'B', kind: 'service' },
    ]
    const edges: DiagramEdgeData[] = [{ from: 'a', to: 'b' }]

    const [a, b] = layoutDiagram(nodes, edges)
    expect(b.x).toBeGreaterThan(a.x)
  })

  it('respects an explicit x/y override instead of computing one', () => {
    const nodes: DiagramNodeData[] = [{ id: 'a', label: 'A', kind: 'service', x: 999, y: 111 }]
    const [a] = layoutDiagram(nodes, [])
    expect(a.x).toBe(999)
    expect(a.y).toBe(111)
  })
})
