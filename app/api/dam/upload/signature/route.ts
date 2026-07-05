import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { auth } from '@clerk/nextjs/server';
import { configureCloudinary, getAssetCount, getCloudinarySettingsForOrg } from '@/lib/cloudinary';
import { getAssetLimit } from '@/lib/limits';
import { logAuditEvent } from '@/lib/audit';
import { getBillingForOrg, isBillingActive } from '@/lib/billing';

type SignatureRequest = {
  assetNumber?: string;
  photographer?: string;
  usageRights?: string;
  campaign?: string;
  description?: string;
  tags?: string;
  enableAutoTagging?: boolean;
  fileCount?: number;
};

const DEFAULT_AUTO_TAGGING_THRESHOLD = 0.6;

function sanitizeContextValue(value: string) {
  return value.replace(/[|=]/g, ' ').trim();
}

function buildContext(fields: Record<string, string>) {
  const entries = Object.entries(fields)
    .map(([key, value]) => [key, sanitizeContextValue(value)] as const)
    .filter(([, value]) => value.length > 0);

  if (entries.length === 0) return undefined;
  return entries.map(([key, value]) => `${key}=${value}`).join('|');
}

function parseTags(value: string | null | undefined) {
  if (!value) return [];
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function getAutoTaggingThreshold() {
  const raw = process.env.CLOUDINARY_AUTO_TAGGING_THRESHOLD;
  if (!raw) return DEFAULT_AUTO_TAGGING_THRESHOLD;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_AUTO_TAGGING_THRESHOLD;
  return Math.min(Math.max(parsed, 0.1), 0.95);
}

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    if (!orgId) {
      return NextResponse.json({ error: 'Workspace required.' }, { status: 403 });
    }

    let settings;
    try {
      settings = await getCloudinarySettingsForOrg(orgId);
    } catch (error) {
      console.error('Cloudinary settings error:', error);
      return NextResponse.json(
        { error: 'Supabase is not configured.' },
        { status: 500 },
      );
    }
    if (!settings) {
      return NextResponse.json(
        { error: 'Cloudinary is not connected for this workspace.' },
        { status: 400 },
      );
    }

    const billing = await getBillingForOrg(orgId);
    if (!isBillingActive(billing)) {
      return NextResponse.json(
        { error: 'Active subscription required.' },
        { status: 402 },
      );
    }

    configureCloudinary(settings);

    const payload = (await request.json()) as SignatureRequest;
    const fileCount = Math.max(Number(payload.fileCount ?? 1), 1);
    const assetNumber = payload.assetNumber?.trim() ?? '';
    const photographer = payload.photographer?.trim() ?? '';
    const usageRights = payload.usageRights?.trim() ?? '';
    const campaign = payload.campaign?.trim() ?? '';
    const description = payload.description?.trim() ?? '';
    const tagsValue = parseTags(payload.tags).join(',');
    const enableAutoTagging = Boolean(payload.enableAutoTagging);

    const context = buildContext({
      asset_id: assetNumber,
      photographer,
      usage_rights: usageRights,
      campaign,
      description,
    });

    const folder = settings.folder?.trim();
    const timestamp = Math.floor(Date.now() / 1000);

    const limit = getAssetLimit();
    const used = await getAssetCount(settings, Math.min(limit + fileCount, 500));
    if (used + fileCount > limit) {
      return NextResponse.json(
        { error: `Asset limit reached (${used}/${limit}).` },
        { status: 403 },
      );
    }

    const params: Record<string, string | number> = {
      timestamp,
    };
    if (folder) params.folder = folder;
    if (context) params.context = context;
    if (tagsValue) params.tags = tagsValue;
    if (enableAutoTagging) {
      params.auto_tagging = getAutoTaggingThreshold();
    }

    const signature = cloudinary.utils.api_sign_request(params, settings.apiSecret);

    try {
      await logAuditEvent({
        orgId,
        userId,
        action: 'upload_requested',
        details: {
          fileCount,
          assetNumber,
          campaign,
          tags: tagsValue ? tagsValue.split(',').map((tag) => tag.trim()) : [],
        },
      });
    } catch (error) {
      console.error('Audit log error:', error);
    }

    return NextResponse.json({
      signature,
      timestamp,
      cloudName: settings.cloudName,
      apiKey: settings.apiKey,
      folder: folder || null,
      context: context || null,
      tags: tagsValue || null,
      auto_tagging: enableAutoTagging ? params.auto_tagging : null,
    });
  } catch (error: any) {
    console.error('Signature error:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Failed to create upload signature.' },
      { status: 500 },
    );
  }
}
