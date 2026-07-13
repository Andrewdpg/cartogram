import { describe, it, expect } from 'vitest'
import { validateDiagramShape, checkCrossFileReferences, InvalidDiagramError } from './validateDiagram'
import type { Diagram } from './types'

describe('validateDiagramShape', () => {
  it('accepts a well-formed diagram', () => {
    const raw = {
      id: 'deployment',
      title: 'Deployment',
      nodes: [{ id: 'a', label: 'A', kind: 'service' }],
      edges: [],
    }
    expect(validateDiagramShape(raw, 'deployment')).toEqual(raw)
  })

  it('rejects a non-object', () => {
    expect(() => validateDiagramShape(null, 'x')).toThrow(InvalidDiagramError)
  })

  it('rejects a diagram missing "nodes"', () => {
    const raw = { id: 'x', title: 'X', edges: [] }
    expect(() => validateDiagramShape(raw, 'x')).toThrow(/nodes/)
  })

  it('rejects a malformed node (null in nodes array)', () => {
    const raw = { id: 'x', title: 'X', nodes: [null], edges: [] }
    expect(() => validateDiagramShape(raw, 'x')).toThrow(InvalidDiagramError)
  })

  it('rejects a node missing "label"', () => {
    const raw = { id: 'x', title: 'X', nodes: [{ id: 'a', kind: 'service' }], edges: [] }
    expect(() => validateDiagramShape(raw, 'x')).toThrow(InvalidDiagramError)
  })

  it('rejects a malformed edge missing "from"', () => {
    const raw = {
      id: 'x',
      title: 'X',
      nodes: [{ id: 'a', label: 'A', kind: 'service' }],
      edges: [{ to: 'a' }],
    }
    expect(() => validateDiagramShape(raw, 'x')).toThrow(InvalidDiagramError)
  })

  it('rejects a node with a non-array "sourceRefs"', () => {
    const raw = {
      id: 'x',
      title: 'X',
      nodes: [{ id: 'a', label: 'A', kind: 'service', sourceRefs: 'not-an-array' }],
      edges: [],
    }
    expect(() => validateDiagramShape(raw, 'x')).toThrow(/sourceRefs/)
  })

  it('accepts a node with valid "sourceRefs"', () => {
    const raw = {
      id: 'x',
      title: 'X',
      nodes: [
        {
          id: 'a',
          label: 'A',
          kind: 'service',
          sourceRefs: ['internal/service/fraud/fraudService.go:112-173'],
        },
      ],
      edges: [],
    }
    expect(() => validateDiagramShape(raw, 'x')).not.toThrow()
  })

  it('rejects an edge referencing an unknown node', () => {
    const raw = {
      id: 'x',
      title: 'X',
      nodes: [{ id: 'a', label: 'A', kind: 'service' }],
      edges: [{ from: 'a', to: 'ghost' }],
    }
    expect(() => validateDiagramShape(raw, 'x')).toThrow(/ghost/)
  })

  it('rejects an unrecognized field on a node instead of silently dropping it', () => {
    const raw = {
      id: 'x',
      title: 'X',
      nodes: [{ id: 'a', label: 'A', kind: 'service', parent: 'host' }],
      edges: [],
    }
    expect(() => validateDiagramShape(raw, 'x')).toThrow(/unrecognized field.*parent/i)
  })

  it('rejects an unrecognized field on an edge', () => {
    const raw = {
      id: 'x',
      title: 'X',
      nodes: [
        { id: 'a', label: 'A', kind: 'service' },
        { id: 'b', label: 'B', kind: 'service' },
      ],
      edges: [{ from: 'a', to: 'b', weight: 5 }],
    }
    expect(() => validateDiagramShape(raw, 'x')).toThrow(/unrecognized field.*weight/i)
  })
})

describe('checkCrossFileReferences', () => {
  it('returns no errors when every childDiagram exists', () => {
    const diagrams: Record<string, Diagram> = {
      deployment: {
        id: 'deployment',
        title: 'Deployment',
        nodes: [{ id: 'svc', label: 'Svc', kind: 'service', childDiagram: 'svc.components' }],
        edges: [],
      },
      'svc.components': { id: 'svc.components', title: 'Svc components', nodes: [], edges: [] },
    }
    expect(checkCrossFileReferences(diagrams)).toEqual([])
  })

  it('flags a childDiagram that does not exist', () => {
    const diagrams: Record<string, Diagram> = {
      deployment: {
        id: 'deployment',
        title: 'Deployment',
        nodes: [{ id: 'svc', label: 'Svc', kind: 'service', childDiagram: 'ghost' }],
        edges: [],
      },
    }
    const errors = checkCrossFileReferences(diagrams)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/ghost/)
  })
})
