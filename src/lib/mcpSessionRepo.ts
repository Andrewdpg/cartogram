import { supabase } from './supabaseClient'

export interface McpSession {
  sessionId: string
  createdAt: string
  expiresAt: string
}

export async function listMcpSessions(): Promise<McpSession[]> {
  const { data, error } = await supabase.rpc('list_my_mcp_sessions')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row: { session_id: string; created_at: string; expires_at: string }) => ({
    sessionId: row.session_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }))
}

export async function revokeMcpSession(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_mcp_session', { p_session_id: sessionId })
  if (error) throw new Error(error.message)
}
