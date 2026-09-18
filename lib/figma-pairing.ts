import { createHash, randomBytes } from 'node:crypto';
import { createAgentApiKey } from '@/lib/agent-keys';
import { getSupabaseAdmin } from '@/lib/supabase';

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export const figmaCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Cache-Control': 'no-store',
};

export class FigmaPairingError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'FigmaPairingError';
  }
}

export async function startFigmaPairing(origin: string) {
  const secret = randomBytes(32).toString('base64url');
  const supabase = getSupabaseAdmin();
  const { data, error } = await (supabase as any).from('figma_pairings')
    .insert({ secret_hash: hash(secret) }).select('id, expires_at').single();
  if (error) {
    console.error('Figma pairing start error:', error);
    throw new FigmaPairingError('Figma pairing is unavailable. Run the PixelSky migration first.', 503);
  }
  return { id: data.id as string, secret, connect_url: `${origin}/figma/connect?pair=${data.id}`, expires_at: data.expires_at as string };
}

export async function approveFigmaPairing(id: string, orgId: string, userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await (supabase as any).from('figma_pairings')
    .update({ approved_org_id: orgId, approved_by: userId })
    .eq('id', id).gt('expires_at', new Date().toISOString())
    .is('consumed_at', null).is('approved_by', null)
    .select('id').maybeSingle();
  if (error) throw new FigmaPairingError('Unable to approve Figma pairing.', 503);
  if (!data) throw new FigmaPairingError('This pairing expired or was already used. Start again in Figma.', 409);
}

export async function claimFigmaPairing(id: string, secret: string) {
  if (!/^[0-9a-f-]{36}$/.test(id) || !/^[A-Za-z0-9_-]{40,}$/.test(secret)) {
    throw new FigmaPairingError('Invalid pairing details.', 400);
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await (supabase as any).from('figma_pairings')
    .select('id, secret_hash, approved_org_id, approved_by, expires_at, consumed_at')
    .eq('id', id).maybeSingle();
  if (error) throw new FigmaPairingError('Unable to check Figma pairing.', 503);
  if (!data || data.secret_hash !== hash(secret) || data.consumed_at || new Date(data.expires_at).getTime() <= Date.now()) {
    throw new FigmaPairingError('Pairing expired or invalid. Start again in Figma.', 410);
  }
  if (!data.approved_org_id || !data.approved_by) return { status: 'pending' as const };

  const { data: claimed, error: claimError } = await (supabase as any).from('figma_pairings')
    .update({ consumed_at: new Date().toISOString() }).eq('id', id)
    .is('consumed_at', null).gt('expires_at', new Date().toISOString())
    .select('id').maybeSingle();
  if (claimError || !claimed) throw new FigmaPairingError('Pairing was already used.', 409);

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000).toISOString();
  const { token } = await createAgentApiKey({
    orgId: data.approved_org_id,
    userId: data.approved_by,
    name: 'PixelSky Figma plugin',
    scopes: ['assets:read', 'asset_uses:read', 'asset_uses:request'],
    expiresAt,
  });
  return { status: 'connected' as const, token, expires_at: expiresAt };
}
