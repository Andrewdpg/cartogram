import { describe, it, expect } from 'vitest'
import { computeEdgeRouting } from './edgeGeometry'

const SIZE = { width: 180, height: 60 }

describe('computeEdgeRouting', () => {
  it('routes a horizontally-dominant edge (target mostly to the right) via source=right, target=left', () => {
    const nodes = [
      { id: 'a', x: 0, y: 0, ...SIZE },
      { id: 'b', x: 200, y: 0, ...SIZE },
    ]
    const edges = [{ id: 'a->b', from: 'a', to: 'b' }]

    const { edgeRouting, nodeHandles } = computeEdgeRouting(nodes, edges)

    expect(edgeRouting).toHaveLength(1)
    const aHandles = nodeHandles.get('a')!
    const bHandles = nodeHandles.get('b')!
    expect(aHandles.find((h) => h.id === edgeRouting[0].sourceHandle)?.side).toBe('right')
    expect(bHandles.find((h) => h.id === edgeRouting[0].targetHandle)?.side).toBe('left')
  })

  it('routes a horizontally-dominant back-reference (target to the left) via source=left, target=right — purely geometric, no forward/back distinction', () => {
    const nodes = [
      { id: 'a', x: 200, y: 0, ...SIZE },
      { id: 'b', x: 0, y: 0, ...SIZE },
    ]
    const edges = [{ id: 'a->b', from: 'a', to: 'b' }]

    const { edgeRouting, nodeHandles } = computeEdgeRouting(nodes, edges)

    const aHandles = nodeHandles.get('a')!
    const bHandles = nodeHandles.get('b')!
    // b is to the left of a, so a's closest side toward b is its own left,
    // and b's closest side toward a is its own right — same rule as the
    // forward case above, just mirrored. No special-casing by direction.
    expect(aHandles.find((h) => h.id === edgeRouting[0].sourceHandle)?.side).toBe('left')
    expect(bHandles.find((h) => h.id === edgeRouting[0].targetHandle)?.side).toBe('right')
  })

  it('routes a vertically-dominant edge (target mostly below) via source=bottom, target=top', () => {
    const nodes = [
      { id: 'a', x: 0, y: 0, ...SIZE },
      { id: 'b', x: 50, y: 200, ...SIZE },
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
      { id: 'a', x: 0, y: 0, ...SIZE },
      { id: 'b', x: 200, y: 0, ...SIZE },
      { id: 'c', x: 200, y: 20, ...SIZE },
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
      { id: 'a', x: 0, y: 0, ...SIZE },
      { id: 'b', x: 200, y: 0, ...SIZE },
      { id: 'c', x: 200, y: 10, ...SIZE },
      { id: 'd', x: 200, y: 20, ...SIZE },
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
    const nodes = [{ id: 'a', x: 0, y: 0, ...SIZE }]
    const edges = [{ id: 'a->ghost', from: 'a', to: 'ghost' }]

    const { edgeRouting } = computeEdgeRouting(nodes, edges)
    expect(edgeRouting).toHaveLength(0)
  })
})
