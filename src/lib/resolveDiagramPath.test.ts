import { describe, it, expect } from 'vitest'
import { resolveDiagramPath } from './resolveDiagramPath'
import { DiagramNotFoundError } from './types'
import type { Diagram } from './types'

const fixtures: Record<string, Diagram> = {
  deployment: {
    id: 'deployment',
    title: 'Deployment',
    nodes: [
      { id: 'svc', label: 'Svc', kind: 'service', childDiagram: 'svc.components' },
      { id: 'leaf', label: 'Leaf', kind: 'external' },
    ],
    edges: [],
  },
  'svc.components': {
    id: 'svc.components',
    title: 'Svc — Components',
    nodes: [{ id: 'inner', label: 'Inner', kind: 'component' }],
    edges: [],
  },
}

function fakeLoad(id: string): Diagram {
  const d = fixtures[id]
  if (!d) throw new DiagramNotFoundError(id)
  return d
}

describe('resolveDiagramPath', () => {
  it('returns just the root when there are no segments', () => {
    const { chain } = resolveDiagramPath([], fakeLoad)
    expect(chain).toHaveLength(1)
    expect(chain[0].id).toBe('deployment')
  })

  it('walks one level into a node with a childDiagram', () => {
    const { chain } = resolveDiagramPath(['svc'], fakeLoad)
    expect(chain.map((d) => d.id)).toEqual(['deployment', 'svc.components'])
  })

  it('throws when a segment does not match any node id', () => {
    expect(() => resolveDiagramPath(['ghost'], fakeLoad)).toThrow(DiagramNotFoundError)
  })

  it('throws when a segment matches a node with no childDiagram', () => {
    expect(() => resolveDiagramPath(['leaf'], fakeLoad)).toThrow(DiagramNotFoundError)
  })
})
