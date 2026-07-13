import { supabase } from './supabaseClient'
import { validateDiagramShape } from './validateDiagram'
import type { Diagram } from './types'

export async function listProjects(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.from('projects').select('id, name')
  if (error) throw error
  return data ?? []
}

export async function createProject(name: string): Promise<{ id: string; name: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  // owner_id is required here, not optional: the projects table has
  // owner_id uuid not null with no column default (see the Supabase
  // backend plan's Task 2), and its RLS insert policy is
  // `with check (owner_id = auth.uid())` — the check evaluates the row as
  // sent, so the client must supply owner_id itself, a server-side
  // trigger/default would not satisfy the check.
  const { data, error } = await supabase
    .from('projects')
    .insert({ name, owner_id: user.id })
    .select('id, name')
    .single()
  if (error) throw error

  // resolveDiagramPath always resolves a project's root as its 'deployment'
  // slug — without seeding one, a freshly created project has nowhere to
  // land and DiagramPage shows "not found" the instant it's opened. No
  // multi-table transaction over PostgREST, so if this insert fails, roll
  // back the just-created project rather than leaving an orphan with no
  // root diagram stuck in the dashboard.
  try {
    await createDiagram(data.id, 'deployment', 'Deployment', 'c4', { nodes: [], edges: [] })
  } catch (err) {
    await supabase.from('projects').delete().eq('id', data.id)
    throw err
  }

  return data
}

export async function getDiagram(
  projectId: string,
  slug: string
): Promise<{ diagram: Diagram; version: number }> {
  const { data, error } = await supabase
    .from('diagrams')
    .select('title, notation, content, version')
    .eq('project_id', projectId)
    .eq('slug', slug)
    .single()
  if (error) throw error

  const raw = {
    id: slug,
    title: data.title,
    notation: data.notation,
    nodes: (data.content as { nodes: unknown }).nodes,
    edges: (data.content as { edges: unknown }).edges,
  }
  const diagram = validateDiagramShape(raw, slug)
  return { diagram, version: data.version }
}

export async function updateDiagram(
  projectId: string,
  slug: string,
  content: Pick<Diagram, 'nodes' | 'edges'>,
  expectedVersion: number
): Promise<{ version: number } | { conflict: true }> {
  const { data, error } = await supabase
    .from('diagrams')
    .update({ content, version: expectedVersion + 1, updated_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .eq('slug', slug)
    .eq('version', expectedVersion)
    .select('version')
    .single()

  if (error || !data) {
    return { conflict: true }
  }
  return { version: data.version }
}

export async function createDiagram(
  projectId: string,
  slug: string,
  title: string,
  notation: Diagram['notation'],
  content: Pick<Diagram, 'nodes' | 'edges'>
): Promise<void> {
  const { error } = await supabase
    .from('diagrams')
    .insert({ project_id: projectId, slug, title, notation, content })
  if (error) throw error
}
