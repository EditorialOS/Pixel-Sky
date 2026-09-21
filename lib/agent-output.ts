import type { AssetPackRecord } from '@/lib/asset-packs';
import type { DamAsset } from '@/lib/dam-search';

export function agentCandidate(asset: DamAsset) {
  const { secure_url, source_url, download_url, agent_download_url, ...candidate } = asset;
  return candidate;
}

export function agentDraftPack(pack: AssetPackRecord) {
  return {
    id: pack.id,
    title: pack.title,
    status: pack.status,
    created_at: pack.created_at,
    assets: pack.assets.map((asset) => ({ public_id: asset.public_id, preview_url: asset.preview_url })),
  };
}
