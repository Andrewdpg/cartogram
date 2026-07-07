import { describe, it, expect } from 'vitest'
import { computeEdgeRouting } from './edgeGeometry'

describe('computeEdgeRouting', () => {
  it('routes a forward edge (target to the right) via source=right, target=left', () => {
    const nodes = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 200, y: 0 },
    ]
    const edges = [{ id: 'a->b', from: 'a', to: 'b' }]

    const { edgeRouting, nodeHandles } = computeEdgeRouting(nodes, edges)

    expect(edgeRouting).toHaveLength(1)
    const aHandles = nodeHandles.get('a')!
    const bHandles = nodeHandles.get('b')!
    expect(aHandles.find((h) => h.id === edgeRouting[0].sourceHandle)?.side).toBe('right')
    expect(bHandles.find((h) => h.id === edgeRouting[0].targetHandle)?.side).toBe('left')
  })

  it('routes a back edge (target to the left, a cyclic call-back) via source=bottom, target=top', () => {
    const nodes = [
      { id: 'a', x: 200, y: 0 },
      { id: 'b', x: 0, y: 0 },
    ]
    const edges = [{ id: 'a->b', from: 'a', to: 'b' }]

    const { edgeRouting, nodeHandles } = computeEdgeRouting(nodes, edges)

    const aHandles = nodeHandles.get('a')!
    const bHandles = nodeHandles.get('b')!
    expect(aHandles.find((h) => h.id === edgeRouting[0].sourceHandle)?.side).toBe('bottom')
    expect(bHandles.find((h) => h.id === edgeRouting[0].targetHandle)?.side).toBe('top')
  })

  it('gives every edge a unique handle id even when multiple edges share a (node, side)', () => {
    const nodes = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 200, y: 0 },
      { id: 'c', x: 200, y: 100 },
    ]
    const edges = [
      { id: 'a->b', from: 'a', to: 'b' },
      { id: 'a->c', from: 'a', to: 'c' },
    ]

    const { edgeRouting } = computeEdgeRouting(nodes, edges)

    expect(edgeRouting[0].sourceHandle).not.toBe(edgeRouting[1].sourceHandle)
  })

  it('spreads multiple edges sharing the same (node, side) across distinct, evenly-spaced offsets', () => {
    const nodes = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 200, y: 0 },
      { id: 'c', x: 200, y: 100 },
      { id: 'd', x: 200, y: 200 },
    ]
    const edges = [
      { id: 'a->b', from: 'a', to: 'b' },
      { id: 'a->c', from: 'a', to: 'c' },
      { id: 'a->d', from: 'a', to: 'd' },
    ]

    const { nodeHandles } = computeEdgeRouting(nodes, edges)
    const rightHandlesOnA = nodeHandles.get('a')!.filter((h) => h.side === 'right')

    expect(rightHandlesOnA).toHaveLength(3)
    const offsets = rightHandlesOnA.map((h) => h.offsetFraction).sort((x, y) => x - y)
    expect(offsets).toEqual([0.25, 0.5, 0.75])
    // no two edges share the exact same point
    expect(new Set(offsets).size).toBe(3)
  })

  it('does not crash on an edge referencing an unknown node id (defensive — validation happens elsewhere)', () => {
    const nodes = [{ id: 'a', x: 0, y: 0 }]
    const edges = [{ id: 'a->ghost', from: 'a', to: 'ghost' }]

    const { edgeRouting } = computeEdgeRouting(nodes, edges)
    expect(edgeRouting).toHaveLength(0)
  })
})
