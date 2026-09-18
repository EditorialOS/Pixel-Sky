import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { assetIsInWorkspaceFolder, getAssetsByIds, getCloudinarySettingsForOrg } from '@/lib/cloudinary';
import {
  AssetPackCandidateInput,
  AssetPackRecord,
  buildAssetPackManifest,
  buildPackAsset,
} from '@/lib/asset-packs';
import { logAuditEvent } from '@/lib/audit';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getVariantPresetById } from '@/lib/variants';

type CreateAssetPackRequest = {
  title?: string;
  brief?: string;
  channels?: string[];
  notes?: string;
  assets?: AssetPackCandidateInput[];
};

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const MAX_ASSETS = 20;

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

function databaseError(message: string) {
  console.error('Asset pack database error:', message);
  return NextResponse.json(
    { error: 'Asset packs are unavailable. Run the PixelSky asset-pack migration first.' },
    { status: 503 },
  );
}

export async function GET(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'Workspace required.' }, { status: 403 });

  const requestedLimit = Number(request.nextUrl.searchParams.get('limit') ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const status = request.nextUrl.searchParams.get('status');

  try {
    const supabase = getSupabaseAdmin();
    let query = (supabase as any)
      .from('asset_packs')
      .select('id, org_id, title, brief, channels, notes, status, assets, created_by, reviewed_by, reviewed_at, created_at, updated_at')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (status === 'draft' || status === 'approved' || status === 'rejected') {
      query = query.eq('status', status);
    }
    const { data, error } = await query;
    if (error) return databaseError(error.message);
    return NextResponse.json({ packs: (data ?? []) as AssetPackRecord[] });
  } catch (error) {
    return databaseError(error instanceof Error ? error.message : String(error));
  }
}

export async function POST(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'Workspace required.' }, { status: 403 });

  let payload: CreateAssetPackRequest;
  try {
    payload = (await request.json()) as CreateAssetPackRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const brief = cleanText(payload.brief, 2_000);
  const title = cleanText(payload.title, 140) || brief.slice(0, 80) || 'Untitled asset pack';
  const channels = cleanChannels(payload.channels);
  const notes = cleanText(payload.notes, 2_000) || null;
  const candidates = cleanCandidates(payload.assets);

  if (!brief) {
    return NextResponse.json({ error: 'A brief is required.' }, { status: 400 });
  }
  if (candidates.length === 0) {
    return NextResponse.json({ error: 'Choose at least one asset.' }, { status: 400 });
  }

  const invalidVariant = candidates
    .flatMap((candidate) => candidate.variants ?? [])
    .find((variant) => !getVariantPresetById(variant));
  if (invalidVariant) {
    return NextResponse.json({ error: `Unknown variant preset: ${invalidVariant}.` }, { status: 400 });
  }

  let settings;
  try {
    settings = await getCloudinarySettingsForOrg(orgId);
  } catch (error) {
    console.error('Cloudinary settings error:', error);
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  }
  if (!settings) {
    return NextResponse.json({ error: 'Cloudinary is not connected for this workspace.' }, { status: 400 });
  }

  try {
    const resources = await getAssetsByIds(candidates.map((candidate) => candidate.public_id), settings);
    const allowedResources = resources.filter((asset: any) => assetIsInWorkspaceFolder(asset, settings.folder));
    const byPublicId = new Map(allowedResources.map((asset: any) => [asset.public_id, asset]));
    const missing = candidates
      .map((candidate) => candidate.public_id)
      .filter((publicId) => !byPublicId.has(publicId));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: 'One or more assets are no longer available to this workspace.', missing },
        { status: 400 },
      );
    }

    const assets = candidates.map((candidate) => buildPackAsset(byPublicId.get(candidate.public_id), candidate, settings.cloudName));
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
        created_by: userId,
      })
      .select('id, org_id, title, brief, channels, notes, status, assets, created_by, reviewed_by, reviewed_at, created_at, updated_at')
      .single();
    if (error) return databaseError(error.message);

    const pack = data as AssetPackRecord;
    try {
      await logAuditEvent({
        orgId,
        userId,
        action: 'asset_pack_created',
        details: { assetPackId: pack.id, title: pack.title, assetCount: pack.assets.length, channels: pack.channels },
      });
    } catch (auditError) {
      console.error('Asset pack audit error:', auditError);
    }

    return NextResponse.json({ pack, manifest: buildAssetPackManifest(pack) }, { status: 201 });
  } catch (error) {
    console.error('Asset pack creation error:', error);
    return NextResponse.json({ error: 'Unable to create this asset pack.' }, { status: 500 });
  }
}
