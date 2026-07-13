import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockGetUser = vi.fn()
vi.mock('./supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
  },
}))

import { getDiagram, updateDiagram, createDiagram, listProjects, createProject } from './diagramRepo'

function chainable(result: unknown) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    single: () => Promise.resolve(result),
    insert: () => chain,
    update: () => chain,
  }
  return chain
}

beforeEach(() => {
  mockFrom.mockReset()
})

describe('getDiagram', () => {
  it('returns the parsed diagram and its version', async () => {
    mockFrom.mockReturnValue(
      chainable({
        data: {
          id: 'diag-1',
          title: 'Deployment',
          notation: 'c4',
          content: { nodes: [], edges: [] },
          version: 3,
        },
        error: null,
      })
    )
    const result = await getDiagram('proj-1', 'deployment')
    expect(result.version).toBe(3)
    expect(result.diagram.title).toBe('Deployment')
    expect(result.diagram.nodes).toEqual([])
  })

  it('throws when the diagram row does not validate', async () => {
    mockFrom.mockReturnValue(
      chainable({
        data: { id: 'diag-1', title: 'Bad', notation: 'c4', content: { nodes: 'not-an-array', edges: [] }, version: 1 },
        error: null,
      })
    )
    await expect(getDiagram('proj-1', 'deployment')).rejects.toThrow()
  })
})

describe('updateDiagram', () => {
  it('returns the new version on success', async () => {
    mockFrom.mockReturnValue(
      chainable({ data: { version: 4 }, error: null })
    )
    const result = await updateDiagram('proj-1', 'deployment', { nodes: [], edges: [] }, 3)
    expect(result).toEqual({ version: 4 })
  })

  it('returns a conflict when no row matched the expected version', async () => {
    mockFrom.mockReturnValue(
      chainable({ data: null, error: { code: 'PGRST116' } })
    )
    const result = await updateDiagram('proj-1', 'deployment', { nodes: [], edges: [] }, 3)
    expect(result).toEqual({ conflict: true })
  })
})

describe('createDiagram', () => {
  it('inserts a new diagram row', async () => {
    mockFrom.mockReturnValue(chainable({ data: { id: 'new-diag' }, error: null }))
    await expect(
      createDiagram('proj-1', 'new-slug', 'New', 'c4', { nodes: [], edges: [] })
    ).resolves.toBeUndefined()
  })
})

describe('listProjects / createProject', () => {
  it('lists accessible projects', async () => {
    mockFrom.mockReturnValue({
      select: () => Promise.resolve({ data: [{ id: 'p1', name: 'Proj 1' }], error: null }),
    })
    const result = await listProjects()
    expect(result).toEqual([{ id: 'p1', name: 'Proj 1' }])
  })

  it('creates a project and seeds an empty deployment diagram so it is immediately openable', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const insertCalls: unknown[] = []
    mockFrom.mockImplementation((table: string) => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        single: () => Promise.resolve({ data: { id: 'p2', name: 'New Proj' }, error: null }),
        insert: (payload: unknown) => {
          insertCalls.push({ table, payload })
          return table === 'diagrams' ? Promise.resolve({ error: null }) : chain
        },
      }
      return chain
    })
    const result = await createProject('New Proj')
    expect(result).toEqual({ id: 'p2', name: 'New Proj' })
    expect(insertCalls).toEqual([
      { table: 'projects', payload: { name: 'New Proj', owner_id: 'user-1' } },
      {
        table: 'diagrams',
        payload: {
          project_id: 'p2',
          slug: 'deployment',
          title: 'Deployment',
          notation: 'c4',
          content: { nodes: [], edges: [] },
        },
      },
    ])
  })

  it('rolls back the created project if seeding the deployment diagram fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const deleteEq = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockImplementation((table: string) => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        single: () => Promise.resolve({ data: { id: 'p2', name: 'New Proj' }, error: null }),
        insert: () => (table === 'diagrams' ? Promise.resolve({ error: { message: 'diagram insert failed' } }) : chain),
        delete: () => ({ eq: deleteEq }),
      }
      return chain
    })

    await expect(createProject('New Proj')).rejects.toThrow('diagram insert failed')
    expect(deleteEq).toHaveBeenCalledWith('id', 'p2')
  })
})
