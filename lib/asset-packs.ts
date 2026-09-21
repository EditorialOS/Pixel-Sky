import { v2 as cloudinary } from 'cloudinary';
import { getVariantPresetById } from './variants';

export const ASSET_PACK_SCHEMA = 'pixelsky.asset-pack/v1';

export type AssetPackStatus = 'draft' | 'approved' | 'rejected';

export type AssetPackCandidateInput = {
  public_id: string;
  rationale?: string;
  variants?: string[];
};

export type AssetPackVariant = {
  id: string;
  label: string;
  width: number;
  height: number;
  delivery_url: string;
};

export type AssetPackAsset = {
  asset_id: string | null;
  public_id: string;
  filename: string;
  source_url: string;
  download_url: string;
  preview_url: string;
  tags: string[];
  campaign: string | null;
  usage_rights: string | null;
  description: string | null;
  rationale: string | null;
  variants: AssetPackVariant[];
};

export type AssetPackRecord = {
  id: string;
  org_id: string;
  title: string;
  brief: string;
  channels: string[];
  notes: string | null;
  status: AssetPackStatus;
  assets: AssetPackAsset[];
  created_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type CloudinaryAsset = {
  asset_id?: string;
  public_id: string;
  filename?: string;
  secure_url?: string;
  tags?: string[];
  context?: { custom?: Record<string, unknown> } | Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

function toStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>;
  const normalized: Record<string, string> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (entry !== null && entry !== undefined) normalized[key] = String(entry);
  }
  return normalized;
}

function contextForAsset(context: CloudinaryAsset['context']) {
  if (!context || typeof context !== 'object') return {};
  const source = context as { custom?: Record<string, unknown> } & Record<string, unknown>;
  return toStringRecord(source.custom ?? source);
}

function metadataValue(
  metadata: Record<string, string>,
  context: Record<string, string>,
  keys: string[],
) {
  for (const key of keys) {
    if (metadata[key]) return metadata[key];
    if (context[key]) return context[key];
  }
  return null;
}

function previewUrl(publicId: string, cloudName?: string) {
  return cloudinary.url(publicId, {
    ...(cloudName ? { cloud_name: cloudName } : {}),
    secure: true,
    resource_type: 'image',
    type: 'upload',
    transformation: [
      {
        width: 480,
        height: 480,
        crop: 'fill',
        gravity: 'auto',
        quality: 'auto',
        fetch_format: 'auto',
      },
    ],
  });
}

export function buildPackAsset(
  asset: CloudinaryAsset,
  candidate: AssetPackCandidateInput,
  cloudName?: string,
): AssetPackAsset {
  const context = contextForAsset(asset.context);
  const metadata = toStringRecord(asset.metadata);
  const publicId = asset.public_id;
  const requestedVariantIds = Array.from(
    new Set((candidate.variants ?? []).map((variant) => variant.trim()).filter(Boolean)),
  );
  const variants = requestedVariantIds.flatMap((variantId) => {
    const preset = getVariantPresetById(variantId);
    if (!preset) return [];
    return [{
      id: preset.id,
      label: preset.label,
      width: preset.width,
      height: preset.height,
      delivery_url: cloudinary.url(publicId, {
        ...(cloudName ? { cloud_name: cloudName } : {}),
        secure: true,
        resource_type: 'image',
        type: 'upload',
        transformation: preset.transformation,
      }),
    }];
  });

  return {
    asset_id: asset.asset_id ?? null,
    public_id: publicId,
    filename: asset.filename || publicId.split('/').pop() || publicId,
    source_url: asset.secure_url || cloudinary.url(publicId, {
      ...(cloudName ? { cloud_name: cloudName } : {}),
      secure: true,
      resource_type: 'image',
      type: 'upload',
    }),
    download_url: cloudinary.url(publicId, {
      ...(cloudName ? { cloud_name: cloudName } : {}),
      secure: true,
      resource_type: 'image',
      type: 'upload',
      flags: 'attachment',
    }),
    preview_url: previewUrl(publicId, cloudName),
    tags: asset.tags ?? [],
    campaign: metadataValue(metadata, context, ['campaign']),
    usage_rights: metadataValue(metadata, context, ['usage_rights', 'usageRights']),
    description: metadataValue(metadata, context, ['description', 'caption']),
    rationale: candidate.rationale?.trim() || null,
    variants,
  };
}

export function buildAssetPackManifest(pack: AssetPackRecord) {
  return {
    schema: ASSET_PACK_SCHEMA,
    id: pack.id,
    status: pack.status,
    created_at: pack.created_at,
    reviewed_at: pack.reviewed_at,
    title: pack.title,
    brief: pack.brief,
    channel_requirements: pack.channels,
    notes: pack.notes,
    assets: pack.assets,
  };
}

export function buildAgentAssetPackManifest(pack: AssetPackRecord, cloudName: string) {
  const manifest = buildAssetPackManifest(pack);
  return {
    ...manifest,
    assets: manifest.assets.map((asset) => ({
      public_id: asset.public_id,
      filename: asset.filename,
      source_url: asset.source_url,
      download_url: asset.download_url || cloudinary.url(asset.public_id, {
        cloud_name: cloudName,
        secure: true,
        resource_type: 'image',
        type: 'upload',
        flags: 'attachment',
      }),
      preview_url: asset.preview_url,
      tags: asset.tags,
      campaign: asset.campaign,
      usage_rights: asset.usage_rights,
      description: asset.description,
      rationale: asset.rationale,
      variants: asset.variants,
    })),
  };
}
