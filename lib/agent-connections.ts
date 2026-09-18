import {
  AGENT_SCOPES,
  AgentScope,
  DEFAULT_AGENT_SCOPES,
  normalizeAgentScopes,
} from '@/lib/agent-keys';
import { getSupabaseAdmin } from '@/lib/supabase';

export type AgentConnectionRecord = {
  id: string;
  org_id: string;
  name: string;
  scopes: AgentScope[];
  created_by: string;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

const FIELDS = 'id, org_id, name, scopes, created_by, revoked_at, created_at, updated_at';

export { AGENT_SCOPES, DEFAULT_AGENT_SCOPES };
export type { AgentScope };

export async function createAgentConnection({
  orgId,
  userId,
  name,
  scopes = DEFAULT_AGENT_SCOPES,
}: {
  orgId: string;
  userId: string;
  name: string;
  scopes?: AgentScope[];
}) {
  const normalizedScopes = normalizeAgentScopes(scopes);
  if (normalizedScopes.length === 0) {
    throw new Error('Choose at least one agent permission.');
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await (supabase as any)
    .from('agent_mcp_connections')
    .insert({
      org_id: orgId,
      name,
      scopes: normalizedScopes,
      created_by: userId,
    })
    .select(FIELDS)
    .single();
  if (error) throw error;
  return normalizeConnection(data as AgentConnectionRecord);
}

export async function listAgentConnections(orgId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await (supabase as any)
    .from('agent_mcp_connections')
    .select(FIELDS)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((connection: AgentConnectionRecord) => normalizeConnection(connection));
}

export async function getActiveAgentConnection(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await (supabase as any)
    .from('agent_mcp_connections')
    .select(FIELDS)
    .eq('id', id)
    .is('revoked_at', null)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeConnection(data as AgentConnectionRecord) : null;
}

export async function revokeAgentConnection({
  id,
  orgId,
}: {
  id: string;
  orgId: string;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await (supabase as any)
    .from('agent_mcp_connections')
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

function normalizeConnection(connection: AgentConnectionRecord): AgentConnectionRecord {
  return {
    ...connection,
    scopes: normalizeAgentScopes(connection.scopes),
  };
}
