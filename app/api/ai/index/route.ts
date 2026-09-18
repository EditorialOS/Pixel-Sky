import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  assetIsInWorkspaceFolder,
  cloudinaryErrorMessage,
  getAssetsByIds,
  getCloudinarySettingsForOrg,
  logCloudinaryError,
  scanImageAssets,
} from '@/lib/cloudinary';
import { buildEmbeddingText, createEmbeddings, upsertAssetEmbeddings } from '@/lib/embeddings';
import { logAuditEvent } from '@/lib/audit';

type IndexRequest = {
  publicIds?: string[];
  cursor?: string;
};

const MAX_INDEX = 50;

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  }
  if (!settings) {
    return NextResponse.json({ error: 'Cloudinary is not connected for this workspace.' }, { status: 400 });
  }

  const payload = (await request.json()) as IndexRequest;
  const publicIds = payload.publicIds ?? [];

  let resources: any[] = [];
  let nextCursor: string | null = null;

  try {
    if (publicIds.length > 0) {
      resources = await getAssetsByIds(publicIds, settings);
    } else {
      const scoped = (await scanImageAssets(settings))
        .filter((asset) => assetIsInWorkspaceFolder(asset, settings.folder));
      const requestedOffset = Number(payload.cursor ?? '0');
      const offset = Number.isSafeInteger(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0;
      resources = scoped.slice(offset, offset + MAX_INDEX);
      nextCursor = offset + MAX_INDEX < scoped.length ? String(offset + MAX_INDEX) : null;
    }
    resources = resources.filter((asset) => assetIsInWorkspaceFolder(asset, settings.folder));
  } catch (error) {
    logCloudinaryError('Cloudinary AI indexing failed', error);
    return NextResponse.json({ error: cloudinaryErrorMessage(error) }, { status: 400 });
  }

  if (resources.length === 0) {
    return NextResponse.json({ indexed: 0, next_cursor: nextCursor });
  }

  const assets = resources.map((asset) => ({
    public_id: asset.public_id,
    filename: asset.filename || asset.public_id?.split('/').pop() || asset.public_id,
    tags: asset.tags ?? [],
    context: asset.context ?? {},
    metadata: asset.metadata ?? {},
  }));

  const inputs = assets.map((asset) => buildEmbeddingText(asset));
  try {
    const embeddings = await createEmbeddings(inputs);
    await upsertAssetEmbeddings(orgId, assets, embeddings);
  } catch (error: any) {
    console.error('Embedding error:', error);
    return NextResponse.json(
      { error: error?.message || 'Unable to build embeddings.' },
      { status: 500 },
    );
  }

  try {
    await logAuditEvent({
      orgId,
      userId,
      action: 'ai_index',
      details: { indexed: assets.length },
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }

  return NextResponse.json({ indexed: assets.length, next_cursor: nextCursor });
}
