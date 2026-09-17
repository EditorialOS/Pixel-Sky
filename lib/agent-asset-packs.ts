import {
  AssetPackCandidateInput,
  AssetPackRecord,
  buildAgentAssetPackManifest,
  buildPackAsset,
} from '@/lib/asset-packs';
import { logAuditEvent } from '@/lib/audit';
import { getAssetsByIds, getCloudinarySettingsForOrg } from '@/lib/cloudinary';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getVariantPresetById } from '@/lib/variants';

export type CreateAgentAssetPackRequest = {
  title?: string;
  brief?: string;
  channels?: string[];
  notes?: string;
  assets?: AssetPackCandidateInput[];
};

const MAX_ASSETS = 20;
const PACK_FIELDS = 'id, org_id, title, brief, channels, notes, status, assets, created_by, reviewed_by, reviewed_at, created_at, updated_at';

export class AssetPackServiceError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'AssetPackServiceError';
  }
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanChannels(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value
    .filter((channel): channel is string => typeof channel === 'string')
    .map((channel) => channel.trim().slice(0, 80))
    .filter(Boolean)))
    .slice(0, 12);
}

function cleanCandidates(value: unknown): AssetPackCandidateInput[] {
  if (!Array.isArray(value)) return [];
  const candidates: AssetPackCandidateInput[] = [];
  const publicIds = new Set<string>();

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const input = entry as Record<string, unknown>;
    const publicId = cleanText(input.public_id, 512);
    if (!publicId || publicIds.has(publicId)) continue;
    publicIds.add(publicId);
    const variants = Array.isArray(input.variants)
      ? Array.from(new Set(input.variants
        .filter((variant): variant is string => typeof variant === 'string')
        .map((variant) => variant.trim())
        .filter(Boolean)))
      : [];
    candidates.push({
      public_id: publicId,
      rationale: cleanText(input.rationale, 600) || undefined,
      variants,
    });
  }
  return candidates.slice(0, MAX_ASSETS);
}

function assetIsInWorkspaceFolder(
  asset: { folder?: string | null; public_id: string },
  folder?: string | null,
) {
  const workspaceFolder = folder?.trim();
  if (!workspaceFolder) return true;
  const assetFolder = asset.folder || asset.public_id.split('/').slice(0, -1).join('/');
  return assetFolder === workspaceFolder || assetFolder.startsWith(`${workspaceFolder}/`);
}

function asDatabaseError(error: unknown) {
  console.error('Asset pack database error:', error);
  return new AssetPackServiceError('Asset packs are unavailable. Run the PixelSky asset-pack migration first.', 503);
}

async function getCloudNameForManifest(orgId: string) {
  try {
    const settings = await getCloudinarySettingsForOrg(orgId);
    if (!settings) throw new AssetPackServiceError('Cloudinary is not connected for this workspace.', 400);
    return settings.cloudName;
  } catch (error) {
    if (error instanceof AssetPackServiceError) throw error;
    console.error('Cloudinary settings error:', error);
    throw new AssetPackServiceError('Supabase is not configured.', 500);
  }
}

export async function createAgentAssetPackDraft({
  orgId,
  actorId,
  agentKeyId,
  payload,
}: {
  orgId: string;
  actorId: string;
  agentKeyId: string;
  payload: CreateAgentAssetPackRequest;
}) {
  const brief = cleanText(payload.brief, 2_000);
  const title = cleanText(payload.title, 140) || brief.slice(0, 80) || 'Untitled asset pack';
  const channels = cleanChannels(payload.channels);
  const notes = cleanText(payload.notes, 2_000) || null;
  const candidates = cleanCandidates(payload.assets);

  if (!brief) throw new AssetPackServiceError('A brief is required.', 400);
  if (candidates.length === 0) throw new AssetPackServiceError('Choose at least one asset.', 400);

  const invalidVariant = candidates
    .flatMap((candidate) => candidate.variants ?? [])
    .find((variant) => !getVariantPresetById(variant));
  if (invalidVariant) {
    throw new AssetPackServiceError(`Unknown variant preset: ${invalidVariant}.`, 400);
  }

  let settings;
  try {
    settings = await getCloudinarySettingsForOrg(orgId);
  } catch (error) {
    console.error('Cloudinary settings error:', error);
    throw new AssetPackServiceError('Supabase is not configured.', 500);
  }
  if (!settings) {
    throw new AssetPackServiceError('Cloudinary is not connected for this workspace.', 400);
  }

  try {
    const resources = await getAssetsByIds(
      candidates.map((candidate) => candidate.public_id),
      settings,
    );
    const allowedResources = resources.filter((asset: any) => assetIsInWorkspaceFolder(asset, settings.folder));
    const byPublicId = new Map(allowedResources.map((asset: any) => [asset.public_id, asset]));
    const missing = candidates
      .map((candidate) => candidate.public_id)
      .filter((publicId) => !byPublicId.has(publicId));
    if (missing.length > 0) {
      throw new AssetPackServiceError(
        `One or more assets are no longer available to this workspace: ${missing.join(', ')}`,
        400,
      );
    }

    const assets = candidates.map((candidate) => buildPackAsset(
      byPublicId.get(candidate.public_id),
      candidate,
      settings.cloudName,
    ));
    const supabase = getSupabaseAdmin();
    const { data, error } = await (supabase as any)
      .from('asset_packs')
      .insert({
        org_id: orgId,
        title,
        brief,
        channels,
        notes,
        status: 'draft',
        assets,
        created_by: actorId,
      })
      .select(PACK_FIELDS)
      .single();
    if (error) throw asDatabaseError(error);

    const pack = data as AssetPackRecord;
    try {
      await logAuditEvent({
        orgId,
        userId: actorId,
        action: 'asset_pack_created',
        details: {
          assetPackId: pack.id,
          title: pack.title,
          assetCount: pack.assets.length,
          channels: pack.channels,
          via: 'agent_mcp',
          agentKeyId,
        },
      });
    } catch (auditError) {
      console.error('Asset pack audit error:', auditError);
    }

    return { pack, manifest: buildAgentAssetPackManifest(pack, settings.cloudName) };
  } catch (error) {
    if (error instanceof AssetPackServiceError) throw error;
    console.error('Agent asset pack creation error:', error);
    throw new AssetPackServiceError('Unable to create this asset pack.', 500);
  }
}

export async function listApprovedAssetPacks(orgId: string, requestedLimit = 30) {
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100)
    : 30;
  try {
    const cloudName = await getCloudNameForManifest(orgId);
    const supabase = getSupabaseAdmin();
    const { data, error } = await (supabase as any)
      .from('asset_packs')
      .select(PACK_FIELDS)
      .eq('org_id', orgId)
      .eq('status', 'approved')
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (error) throw asDatabaseError(error);
    return (data ?? []).map((pack: AssetPackRecord) => buildAgentAssetPackManifest(pack, cloudName));
  } catch (error) {
    if (error instanceof AssetPackServiceError) throw error;
    throw asDatabaseError(error);
  }
}

export async function getApprovedAssetPack(orgId: string, id: string) {
  try {
    const cloudName = await getCloudNameForManifest(orgId);
    const supabase = getSupabaseAdmin();
    const { data, error } = await (supabase as any)
      .from('asset_packs')
      .select(PACK_FIELDS)
      .eq('id', id)
      .eq('org_id', orgId)
      .eq('status', 'approved')
      .maybeSingle();
    if (error) throw asDatabaseError(error);
    if (!data) throw new AssetPackServiceError('Approved asset pack not found.', 404);
    return buildAgentAssetPackManifest(data as AssetPackRecord, cloudName);
  } catch (error) {
    if (error instanceof AssetPackServiceError) throw error;
    throw asDatabaseError(error);
  }
}

export async function approveAgentAssetPack({
  orgId,
  actorId,
  agentKeyId,
  id,
}: {
  orgId: string;
  actorId: string;
  agentKeyId: string;
  id: string;
}) {
  try {
    const supabase = getSupabaseAdmin();
    const { data: existing, error: loadError } = await (supabase as any)
      .from('asset_packs')
      .select(PACK_FIELDS)
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle();
    if (loadError) throw asDatabaseError(loadError);
    if (!existing) throw new AssetPackServiceError('Asset pack not found.', 404);
    if (existing.status !== 'draft') {
      throw new AssetPackServiceError('Only draft packs can be approved.', 409);
    }

    const reviewedAt = new Date().toISOString();
    const { data, error } = await (supabase as any)
      .from('asset_packs')
      .update({
        status: 'approved',
        reviewed_by: actorId,
        reviewed_at: reviewedAt,
        updated_at: reviewedAt,
      })
      .eq('id', id)
      .eq('org_id', orgId)
      .eq('status', 'draft')
      .select(PACK_FIELDS)
      .maybeSingle();
    if (error) throw asDatabaseError(error);
    if (!data) throw new AssetPackServiceError('This draft was already reviewed.', 409);

    const pack = data as AssetPackRecord;
    try {
      await logAuditEvent({
        orgId,
        userId: actorId,
        action: 'asset_pack_approved',
        details: {
          assetPackId: pack.id,
          title: pack.title,
          assetCount: pack.assets.length,
          via: 'agent_mcp',
          agentKeyId,
        },
      });
    } catch (auditError) {
      console.error('Agent asset pack approval audit error:', auditError);
    }
    const cloudName = await getCloudNameForManifest(orgId);
    return { pack, manifest: buildAgentAssetPackManifest(pack, cloudName) };
  } catch (error) {
    if (error instanceof AssetPackServiceError) throw error;
    throw asDatabaseError(error);
  }
}
