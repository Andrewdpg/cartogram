import { supabase } from './supabaseClient'

export interface Collaborator {
  userId: string
  email: string
  role: 'viewer' | 'editor'
}

export async function listCollaborators(projectId: string): Promise<Collaborator[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select('user_id, role, users:user_id(email)')
    .eq('project_id', projectId)
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    userId: row.user_id,
    email: row.users.email,
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
