import { createHash, randomBytes } from 'node:crypto';
import {
  AGENT_SCOPES,
  AgentScope,
  DEFAULT_AGENT_SCOPES,
} from '@/lib/agent-scopes';
import { getSupabaseAdmin } from '@/lib/supabase';

export { AGENT_SCOPES, DEFAULT_AGENT_SCOPES } from '@/lib/agent-scopes';
export type { AgentScope } from '@/lib/agent-scopes';

export type AgentApiKeyRecord = {
  id: string;
  org_id: string;
  name: string;
  token_prefix: string;
  scopes: AgentScope[];
  created_by: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type AgentPrincipal = {
  id: string;
  orgId: string;
  name: string;
  scopes: AgentScope[];
  actorId: string;
  authType: 'api_key' | 'oauth';
  connectionId?: string;
};

function hashAgentKey(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function normalizeAgentScopes(value: unknown): AgentScope[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(AGENT_SCOPES);
  return Array.from(new Set(value.filter(
    (scope): scope is AgentScope => typeof scope === 'string' && allowed.has(scope),
  )));
}

export function hasAgentScope(principal: AgentPrincipal, scope: AgentScope) {
  return principal.scopes.includes(scope);
}

export async function createAgentApiKey({
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
  const token = `psk_live_${randomBytes(32).toString('base64url')}`;
  const tokenPrefix = token.slice(0, 17);
  const normalizedScopes = normalizeAgentScopes(scopes);
  if (normalizedScopes.length === 0) {
    throw new Error('Choose at least one agent permission.');
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await (supabase as any)
    .from('agent_api_keys')
    .insert({
      org_id: orgId,
      name,
      token_prefix: tokenPrefix,
      token_hash: hashAgentKey(token),
      scopes: normalizedScopes,
      created_by: userId,
    })
    .select('id, org_id, name, token_prefix, scopes, created_by, last_used_at, revoked_at, created_at')
    .single();

  if (error) throw error;
  return { key: data as AgentApiKeyRecord, token };
}

export async function listAgentApiKeys(orgId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await (supabase as any)
    .from('agent_api_keys')
    .select('id, org_id, name, token_prefix, scopes, created_by, last_used_at, revoked_at, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((key: AgentApiKeyRecord) => ({
    ...key,
    scopes: normalizeAgentScopes(key.scopes),
  })) as AgentApiKeyRecord[];
}

export async function revokeAgentApiKey({
  id,
  orgId,
}: {
  id: string;
  orgId: string;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await (supabase as any)
    .from('agent_api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function authenticateAgentApiKey(request: Request): Promise<AgentPrincipal | null> {
  const authorization = request.headers.get('authorization');
  const match = authorization?.match(/^Bearer\s+(psk_live_[A-Za-z0-9_-]{32,})$/i);
  if (!match) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await (supabase as any)
    .from('agent_api_keys')
    .select('id, org_id, name, scopes')
    .eq('token_hash', hashAgentKey(match[1]))
    .is('revoked_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const principal: AgentPrincipal = {
    id: data.id,
    orgId: data.org_id,
    name: data.name,
    scopes: normalizeAgentScopes(data.scopes),
    actorId: `agent:${data.id}`,
    authType: 'api_key',
  };
  if (principal.scopes.length === 0) return null;

  void (supabase as any)
    .from('agent_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', principal.id)
    .then(({ error: updateError }: { error: unknown }) => {
      if (updateError) console.error('Agent key last-used update error:', updateError);
    });

  return principal;
}
