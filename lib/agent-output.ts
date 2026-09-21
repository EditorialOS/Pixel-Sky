import type { AssetPackRecord } from '@/lib/asset-packs';
import type { AssetUseRequest } from '@/lib/asset-use-requests';
import type { DamAsset } from '@/lib/dam-search';

export function agentCandidate(asset: DamAsset) {
  return {
    public_id: asset.public_id,
    asset_number: asset.asset_number,
    filename: asset.filename,
    folder: asset.folder,
    format: asset.format,
    width: asset.width,
    height: asset.height,
    bytes: asset.bytes,
    created_at: asset.created_at,
    tags: asset.tags,
    context: asset.context,
    metadata: asset.metadata,
    preview_url: asset.preview_url,
    ai_tag_confidence: asset.ai_tag_confidence,
    visual_description: asset.visual_description,
    visual_tags: asset.visual_tags,
    match_score: asset.match_score,
  };
}

export function agentAssetUseRequest(request: AssetUseRequest) {
  return {
    id: request.id,
    public_id: request.public_id,
    filename: request.filename,
    preview_url: request.preview_url,
    usage_rights: request.usage_rights,
    credit: request.credit,
    tags: request.tags,
    channel: request.channel,
    campaign: request.campaign,
    placement: request.placement,
    region: request.region,
    purpose: request.purpose,
    status: request.status,
    reviewed_at: request.reviewed_at,
    expires_at: request.expires_at,
    created_at: request.created_at,
    updated_at: request.updated_at,
  };
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
