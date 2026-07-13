import { supabase } from './supabaseClient'

export interface Collaborator {
  userId: string
  email: string
  role: 'viewer' | 'editor'
}

export async function listCollaborators(projectId: string): Promise<Collaborator[]> {
  // project_members.user_id references auth.users, which PostgREST cannot
  // embed directly (only public/graphql_public schemas are exposed via the
  // API) — list_collaborators_with_email is a security definer RPC that
  // resolves the join server-side, the same pattern
  // invite_collaborator_by_email already uses to read auth.users.
  const { data, error } = await supabase.rpc('list_collaborators_with_email', {
    p_project_id: projectId,
  })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row: { user_id: string; email: string; role: 'viewer' | 'editor' }) => ({
    userId: row.user_id,
    email: row.email,
    role: row.role,
  }))
}

export async function inviteCollaborator(
  projectId: string,
  email: string,
  role: 'viewer' | 'editor'
): Promise<void> {
  const { error } = await supabase.rpc('invite_collaborator_by_email', {
    p_project_id: projectId,
    p_email: email,
    p_role: role,
  })
  if (error) throw new Error(error.message)
}
