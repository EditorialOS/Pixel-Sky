import { getOpenAIClient } from './openai';
import { getSupabaseAdmin } from './supabase';

const DEFAULT_MODEL = 'text-embedding-3-small';

export type EmbeddingAsset = {
  public_id: string;
  asset_id?: string;
  version?: number;
  filename?: string;
  tags?: string[];
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  visual_description?: string;
  visual_tags?: string[];
};

function normalizeRecord(value: unknown) {
  if (!value || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}

function recordToText(record: Record<string, unknown>) {
  return Object.values(record)
    .map((value) => String(value))
    .filter(Boolean)
    .join(' ');
}

export function buildEmbeddingText(asset: EmbeddingAsset) {
  const context = normalizeRecord(asset.context);
  const metadata = normalizeRecord(asset.metadata);
  const pieces = [
    asset.public_id,
    asset.filename,
    ...(asset.tags ?? []),
    asset.visual_description,
    ...(asset.visual_tags ?? []),
    recordToText(context),
    recordToText(metadata),
  ]
    .map((value) => value?.toString().trim())
    .filter(Boolean);

  return pieces.join(' ');
}

export async function createEmbeddings(inputs: string[]) {
  const client = getOpenAIClient();
  const model = process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_MODEL;
  const response = await client.embeddings.create({
    model,
    input: inputs,
  });
  return response.data.map((item) => item.embedding);
}

export async function upsertAssetEmbeddings(
  orgId: string,
  assets: EmbeddingAsset[],
  embeddings: number[][],
) {
  const supabase = getSupabaseAdmin();
  const rows = assets.map((asset, index) => ({
    org_id: orgId,
    public_id: asset.public_id,
    asset_id: asset.asset_id ?? null,
    asset_version: asset.version ?? null,
    content: buildEmbeddingText(asset),
    visual_description: asset.visual_description ?? null,
    visual_tags: asset.visual_tags ?? [],
    embedding: embeddings[index],
    status: 'complete',
    attempt_count: 0,
    last_error: null,
    indexed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('asset_embeddings')
    .upsert(rows as any, { onConflict: 'org_id,public_id' });

  if (error) {
    throw error;
  }
}

export async function markAssetIndexFailure(
  orgId: string,
  asset: Pick<EmbeddingAsset, 'public_id' | 'asset_id' | 'version'>,
  errorMessage: string,
) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('asset_embeddings')
    .select('attempt_count')
    .eq('org_id', orgId)
    .eq('public_id', asset.public_id)
    .maybeSingle();
  const previous = data as { attempt_count?: number } | null;

  const { error } = await supabase
    .from('asset_embeddings')
    .upsert({
      org_id: orgId,
      public_id: asset.public_id,
      asset_id: asset.asset_id ?? null,
      asset_version: asset.version ?? null,
      status: 'failed',
      attempt_count: Number(previous?.attempt_count ?? 0) + 1,
      last_error: errorMessage.slice(0, 1_000),
      updated_at: new Date().toISOString(),
    } as any, { onConflict: 'org_id,public_id' });

  if (error) throw error;
}
