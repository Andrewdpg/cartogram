import { supabase } from './supabaseClient'

export async function listMcpGrants(): Promise<Set<string>> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Set()
  const { data, error } = await supabase
    .from('mcp_project_grants')
    .select('project_id')
    .eq('user_id', user.id)
  if (error) throw error
  return new Set((data ?? []).map((row: { project_id: string }) => row.project_id))
}

export async function setMcpGrant(projectId: string, granted: boolean): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  if (granted) {
    const { error } = await supabase.from('mcp_project_grants').insert({
      project_id: projectId,
      user_id: user.id,
    })
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('mcp_project_grants')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', user.id)
    if (error) throw error
  }
}
