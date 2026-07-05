import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { auth } from '@clerk/nextjs/server';
import { configureCloudinary, getAssetCount, getCloudinarySettingsForOrg } from '@/lib/cloudinary';
import { getAssetLimit } from '@/lib/limits';
import { logAuditEvent } from '@/lib/audit';
import { getBillingForOrg, isBillingActive } from '@/lib/billing';

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

function parseTags(value: string | null) {
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

function uploadBuffer(buffer: Buffer, options: Record<string, unknown>) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });
    stream.end(buffer);
  });
}

function extractTagConfidence(result: any) {
  const map: Record<string, number> = {};

  const collect = (value: any) => {
    if (!value) return;
    if (Array.isArray(value)) {
      const isTagArray = value.every(
        (item) =>
          item &&
          typeof item === 'object' &&
          typeof item.tag === 'string' &&
          typeof item.confidence === 'number',
      );
      if (isTagArray) {
        value.forEach((item) => {
          const score = normalizeConfidence(item.confidence);
          if (!Number.isNaN(score)) {
            map[item.tag] = Math.max(map[item.tag] ?? 0, score);
          }
        });
        return;
      }
      value.forEach(collect);
      return;
    }
    if (typeof value === 'object') {
      Object.values(value).forEach(collect);
    }
  };

  collect(result?.info);
  collect(result?.analysis);
  collect(result?.categorization);
  return map;
}

function normalizeConfidence(score: number) {
  const normalized = score > 1 ? score / 100 : score;
  return Math.min(Math.max(normalized, 0), 1);
}

async function updateAiTagContext(publicId: string, baseContext: string, tagConfidence: Record<string, number>) {
  if (Object.keys(tagConfidence).length === 0) return;
  const aiValue = Object.entries(tagConfidence)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([tag, score]) => `${tag}:${score.toFixed(2)}`)
    .join(',');
  const mergedContext = baseContext
    ? `${baseContext}|ai_tag_confidence=${aiValue}`
    : `ai_tag_confidence=${aiValue}`;
  await cloudinary.uploader.explicit(publicId, {
    type: 'upload',
    resource_type: 'image',
    context: mergedContext,
  });
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

    const formData = await request.formData();
    const files = formData.getAll('files');
    const singleFile = formData.get('file');
    if (files.length === 0 && singleFile) {
      files.push(singleFile);
    }

    const fileList = files.filter((item): item is File => item instanceof File);

    if (fileList.length === 0) {
      return NextResponse.json(
        { error: 'At least one image file is required.' },
        { status: 400 },
      );
    }

    const limit = getAssetLimit();
    const incomingCount = fileList.length;
    const used = await getAssetCount(settings, Math.min(limit + incomingCount, 500));
    if (used + incomingCount > limit) {
      return NextResponse.json(
        { error: `Asset limit reached (${used}/${limit}).` },
        { status: 403 },
      );
    }

    configureCloudinary(settings);

    const assetNumber = (formData.get('assetNumber') as string | null)?.trim() ?? '';
    const photographer = (formData.get('photographer') as string | null)?.trim() ?? '';
    const usageRights = (formData.get('usageRights') as string | null)?.trim() ?? '';
    const campaign = (formData.get('campaign') as string | null)?.trim() ?? '';
    const description = (formData.get('description') as string | null)?.trim() ?? '';
    const tags = parseTags((formData.get('tags') as string | null) ?? '');
    const enableAutoTagging = formData.get('enableAutoTagging') === 'true';

    const folder = settings.folder?.trim();
    const warnings: string[] = [];
    if (fileList.length > 1 && assetNumber) {
      warnings.push('Asset number is ignored for multi-file uploads.');
    }

    const assets: Array<{
      asset_id?: string;
      public_id: string;
      secure_url?: string;
      bytes?: number;
      width?: number;
      height?: number;
      format?: string;
      created_at?: string;
      tags?: string[];
      context?: Record<string, unknown>;
      ai_tag_confidence?: Record<string, number>;
    }> = [];
    const errors: Array<{ fileName: string; error: string }> = [];

    for (const file of fileList) {
      if (!file.type.startsWith('image/')) {
        errors.push({ fileName: file.name, error: 'Only image uploads are supported.' });
        continue;
      }

      const perFileAssetNumber = fileList.length === 1 ? assetNumber : '';
      const context = buildContext({
        asset_id: perFileAssetNumber,
        photographer,
        usage_rights: usageRights,
        campaign,
        description,
      });

      const buffer = Buffer.from(await file.arrayBuffer());
      const uploadOptions: Record<string, unknown> = {
        folder: folder || undefined,
        context,
        tags,
        resource_type: 'image',
      };

      if (enableAutoTagging) {
        uploadOptions.auto_tagging = getAutoTaggingThreshold();
      }

      try {
        const result = (await uploadBuffer(buffer, uploadOptions)) as {
          asset_id?: string;
          public_id: string;
          secure_url?: string;
          bytes?: number;
          width?: number;
          height?: number;
          format?: string;
          created_at?: string;
          tags?: string[];
          context?: Record<string, unknown>;
          info?: Record<string, unknown>;
        };

        const aiTagConfidence = enableAutoTagging ? extractTagConfidence(result) : {};
        if (Object.keys(aiTagConfidence).length > 0) {
          await updateAiTagContext(result.public_id, context ?? '', aiTagConfidence);
        }

        assets.push({
          asset_id: result.asset_id,
          public_id: result.public_id,
          secure_url: result.secure_url,
          bytes: result.bytes,
          width: result.width,
          height: result.height,
          format: result.format,
          created_at: result.created_at,
          tags: result.tags ?? tags,
          context: result.context ?? {},
          ai_tag_confidence: Object.keys(aiTagConfidence).length > 0 ? aiTagConfidence : undefined,
        });
      } catch (fileError: any) {
        errors.push({
          fileName: file.name,
          error: typeof fileError?.message === 'string' ? fileError.message : 'Upload failed.',
        });
      }
    }

    if (assets.length > 0) {
      try {
        await logAuditEvent({
          orgId,
          userId,
          action: 'upload',
          details: {
            uploaded: assets.length,
            failed: errors.length,
            files: assets.map((asset) => asset.public_id),
          },
        });
      } catch (error) {
        console.error('Audit log error:', error);
      }
    }

    return NextResponse.json({
      success: assets.length > 0,
      uploaded: assets.length,
      failed: errors.length,
      assets,
      errors,
      warnings,
    });
  } catch (error: any) {
    console.error('DAM upload error:', error);
    const message =
      typeof error?.message === 'string'
        ? error.message
        : 'Failed to upload asset.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
