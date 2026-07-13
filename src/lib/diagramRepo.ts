import { supabase } from './supabaseClient'
import { validateDiagramShape } from './validateDiagram'
import type { Diagram } from './types'

export async function listProjects(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.from('projects').select('id, name')
  if (error) throw error
  return data ?? []
}

export async function createProject(name: string): Promise<{ id: string; name: string }> {
  // ponytail: owner_id is set by a DB default (auth.uid()) via RLS, not here —
  // the brief's test mocks `from` only, no `auth.getUser`.
  const { data, error } = await supabase
    .from('projects')
    .insert({ name })
    .select('id, name')
    .single()
  if (error) throw error
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
