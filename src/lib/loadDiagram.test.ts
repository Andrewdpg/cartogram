import { describe, it, expect } from 'vitest'
import { loadDiagram } from './loadDiagram'
import { DiagramNotFoundError } from './types'

describe('loadDiagram', () => {
  it('loads the root deployment diagram', () => {
    const diagram = loadDiagram('deployment')
    expect(diagram.id).toBe('deployment')
    expect(diagram.nodes.some((n) => n.id === 'api-service')).toBe(true)
  })

  it('loads a nested diagram by its file id', () => {
    const diagram = loadDiagram('auth-module.flow')
    expect(diagram.title).toBe('Auth Module — Flow')
  })

  it('throws DiagramNotFoundError for an unknown id', () => {
    expect(() => loadDiagram('does-not-exist')).toThrow(DiagramNotFoundError)
  })
})
