import { getOpenAIClient } from './openai';
import { getSupabaseAdmin } from './supabase';

const DEFAULT_MODEL = 'text-embedding-3-small';

export type EmbeddingAsset = {
  public_id: string;
  filename?: string;
  tags?: string[];
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
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
    content: buildEmbeddingText(asset),
    embedding: embeddings[index],
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('asset_embeddings')
    .upsert(rows as any, { onConflict: 'org_id,public_id' });

  if (error) {
    throw error;
  }
}
