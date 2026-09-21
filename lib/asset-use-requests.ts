import { v2 as cloudinary } from 'cloudinary';
import { logAuditEvent } from '@/lib/audit';
import { assetIsInWorkspaceFolder, getAssetsByIds, getCloudinarySettingsForOrg } from '@/lib/cloudinary';
import { getSupabaseAdmin } from '@/lib/supabase';

const FIELDS = 'id, org_id, public_id, asset_id, asset_version, filename, preview_url, usage_rights, credit, tags, channel, campaign, placement, region, purpose, status, requested_by, reviewed_by, reviewed_at, expires_at, created_at, updated_at';

export type AssetUseStatus = 'pending' | 'approved' | 'rejected' | 'revoked';
export type AssetUseRequest = {
  id: string;
  org_id: string;
  public_id: string;
  asset_id: string;
  asset_version: number;
  filename: string;
  preview_url: string;
  usage_rights: string | null;
  credit: string | null;
  tags: string[];
  channel: string;
  campaign: string;
  placement: string;
  region: string;
  purpose: string;
  status: AssetUseStatus;
  requested_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AssetUseInput = {
  public_id: string;
  channel: string;
  campaign: string;
  placement: string;
  region: string;
  purpose: string;
};

export class AssetUseError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'AssetUseError';
  }
}

export function assertApprovalActive(request: Pick<AssetUseRequest, 'status' | 'expires_at'>, now = Date.now()) {
  if (request.status !== 'approved') throw new AssetUseError('This use has not been approved.', 403);
  if (!request.expires_at || new Date(request.expires_at).getTime() <= now) {
    throw new AssetUseError('This approval has expired.', 403);
  }
}

export function assertApprovedVersion(
  request: Pick<AssetUseRequest, 'asset_id' | 'asset_version'>,
  asset: { asset_id?: string; version?: number },
) {
  if (asset.asset_id !== request.asset_id || asset.version !== request.asset_version) {
    throw new AssetUseError('The Cloudinary asset changed after approval. Request a new review.', 409);
  }
}

function clean(value: unknown, length: number) {
  return typeof value === 'string' ? value.trim().slice(0, length) : '';
}

function assetField(asset: any, names: string[]) {
  const context = asset.context?.custom ?? asset.context ?? {};
  const metadata = asset.metadata ?? {};
  for (const name of names) {
    const value = metadata[name] ?? context[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function databaseError(error: unknown): AssetUseError {
  console.error('Asset use database error:', error);
  return new AssetUseError('Asset-use requests are unavailable. Run the PixelSky asset-use migration first.', 503);
}

async function findAsset(orgId: string, publicId: string) {
  const settings = await getCloudinarySettingsForOrg(orgId);
  if (!settings) throw new AssetUseError('Cloudinary is not connected for this workspace.', 400);
  const resources = await getAssetsByIds([publicId], settings);
  const asset = resources.find((entry: any) => entry.public_id === publicId);
  if (!asset || !assetIsInWorkspaceFolder(asset, settings.folder)) {
    throw new AssetUseError('Asset is not available in this workspace.', 404);
  }
  return { asset, settings };
}

export async function createAssetUseRequest(orgId: string, actorId: string, input: AssetUseInput) {
  const publicId = clean(input.public_id, 512);
  const channel = clean(input.channel, 80);
  const campaign = clean(input.campaign, 140);
  const placement = clean(input.placement, 140);
  const region = clean(input.region, 80);
  const purpose = clean(input.purpose, 1_000);
  if (![publicId, channel, campaign, placement, region, purpose].every(Boolean)) {
    throw new AssetUseError('Asset, channel, campaign, placement, region, and purpose are required.', 400);
  }

  const { asset, settings } = await findAsset(orgId, publicId);
  if (!asset.asset_id || !Number.isSafeInteger(asset.version)) {
    throw new AssetUseError('Cloudinary did not return a stable asset ID and version.', 502);
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await (supabase as any).from('asset_use_requests').insert({
    org_id: orgId,
    public_id: publicId,
    asset_id: asset.asset_id,
    asset_version: asset.version,
    filename: asset.filename || publicId.split('/').pop() || publicId,
    preview_url: cloudinary.url(publicId, {
      cloud_name: settings.cloudName, secure: true, resource_type: 'image', type: 'upload',
      version: asset.version,
      transformation: [{ width: 480, height: 480, crop: 'fill', gravity: 'auto' }],
    }),
    usage_rights: assetField(asset, ['usage_rights', 'usageRights', 'rights']),
    credit: assetField(asset, ['photographer', 'credit', 'creator']),
    tags: Array.isArray(asset.tags) ? asset.tags : [],
    channel,
    campaign,
    placement,
    region,
    purpose,
    requested_by: actorId,
  }).select(FIELDS).single();
  if (error) throw databaseError(error);
  const record = data as AssetUseRequest;
  try {
    await logAuditEvent({ orgId, userId: actorId, action: 'asset_use_requested', details: { requestId: record.id, publicId } });
  } catch (error) {
    console.error('Asset use audit error:', error);
  }
  return record;
}

export async function listAssetUseRequests(orgId: string, status?: AssetUseStatus) {
  const supabase = getSupabaseAdmin();
  let query = (supabase as any).from('asset_use_requests').select(FIELDS)
    .eq('org_id', orgId).order('created_at', { ascending: false }).limit(100);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw databaseError(error);
  return data as AssetUseRequest[];
}

export async function getAssetUseRequest(orgId: string, id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await (supabase as any).from('asset_use_requests')
    .select(FIELDS).eq('org_id', orgId).eq('id', id).maybeSingle();
  if (error) throw databaseError(error);
  if (!data) throw new AssetUseError('Asset-use request not found.', 404);
  return data as AssetUseRequest;
}

export async function reviewAssetUseRequest(
  orgId: string,
  actorId: string,
  id: string,
  status: 'approved' | 'rejected' | 'revoked',
  expiresAt?: string,
) {
  const existing = await getAssetUseRequest(orgId, id);
  if (status === 'revoked' ? existing.status !== 'approved' : existing.status !== 'pending') {
    throw new AssetUseError('This request cannot be reviewed in its current state.', 409);
  }
  let expiration: string | null = null;
  if (status === 'approved') {
    const parsed = expiresAt ? new Date(expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000);
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now() || parsed.getTime() > Date.now() + 365 * 24 * 60 * 60 * 1_000) {
      throw new AssetUseError('Approval expiry must be within the next year.', 400);
    }
    const { asset } = await findAsset(orgId, existing.public_id);
    assertApprovedVersion(existing, asset);
    expiration = parsed.toISOString();
  }
  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();
  const { data, error } = await (supabase as any).from('asset_use_requests')
    .update({ status, reviewed_by: actorId, reviewed_at: now, expires_at: expiration, updated_at: now })
    .eq('org_id', orgId).eq('id', id).eq('status', existing.status)
    .select(FIELDS).maybeSingle();
  if (error) throw databaseError(error);
  if (!data) throw new AssetUseError('Request changed while it was being reviewed. Refresh and retry.', 409);
  try {
    await logAuditEvent({ orgId, userId: actorId, action: `asset_use_${status}`, details: { requestId: id, publicId: existing.public_id } });
  } catch (auditError) {
    console.error('Asset use audit error:', auditError);
  }
  return data as AssetUseRequest;
}

export async function deliverAssetUse(orgId: string, actorId: string, id: string) {
  const request = await getAssetUseRequest(orgId, id);
  assertApprovalActive(request);
  const { asset, settings } = await findAsset(orgId, request.public_id);
  assertApprovedVersion(request, asset);
  const options = { cloud_name: settings.cloudName, secure: true, resource_type: 'image' as const, type: 'upload' as const, version: request.asset_version };
  const imageUrl = cloudinary.url(request.public_id, options);
  const downloadUrl = cloudinary.url(request.public_id, { ...options, flags: 'attachment' });
  const figmaImageUrl = cloudinary.url(request.public_id, {
    ...options,
    transformation: [{ width: 2048, height: 2048, crop: 'limit', fetch_format: 'png' }],
  });
  try {
    await logAuditEvent({ orgId, userId: actorId, action: 'asset_use_delivered', details: { requestId: id, publicId: request.public_id } });
  } catch (auditError) {
    console.error('Asset use audit error:', auditError);
  }
  return {
    request_id: id,
    public_id: request.public_id,
    approved_use: { channel: request.channel, campaign: request.campaign, placement: request.placement, region: request.region, purpose: request.purpose },
    approval_expires_at: request.expires_at,
    image_url: imageUrl,
    download_url: downloadUrl,
    figma_image_url: figmaImageUrl,
  };
}
