import { describe, it, expect } from 'vitest'
import { resolveDiagramPath } from './resolveDiagramPath'
import { DiagramNotFoundError } from './types'
import type { Diagram } from './types'

const diagrams: Record<string, Diagram> = {
  deployment: {
    id: 'deployment',
    title: 'Deployment',
    notation: 'c4',
    nodes: [{ id: 'api', label: 'API', kind: 'service', childDiagram: 'api-components' }],
    edges: [],
  },
  'api-components': {
    id: 'api-components',
    title: 'API Components',
    notation: 'c4',
    nodes: [{ id: 'handler', label: 'Handler', kind: 'component' }],
    edges: [],
  },
}

async function fakeLoad(_projectId: string, slug: string) {
  const diagram = diagrams[slug]
  if (!diagram) throw new DiagramNotFoundError(slug)
  return { diagram, version: 1 }
}

describe('resolveDiagramPath', () => {
  it('resolves the root diagram with no segments', async () => {
    const result = await resolveDiagramPath('proj-1', [], fakeLoad)
    expect(result.chain).toHaveLength(1)
    expect(result.chain[0].diagram.id).toBe('deployment')
  })

  it('resolves a nested diagram by following childDiagram slugs', async () => {
    const result = await resolveDiagramPath('proj-1', ['api'], fakeLoad)
    expect(result.chain).toHaveLength(2)
    expect(result.chain[1].diagram.id).toBe('api-components')
  })

  it('throws DiagramNotFoundError for an unknown node id in the path', async () => {
    await expect(resolveDiagramPath('proj-1', ['does-not-exist'], fakeLoad)).rejects.toThrow(
      DiagramNotFoundError
    )
  })
})
