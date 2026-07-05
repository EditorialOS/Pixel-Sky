import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { auth } from '@clerk/nextjs/server';
import { configureCloudinary, getCloudinarySettingsForOrg, getAssetsByIds, buildAssetExpression } from '@/lib/cloudinary';
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

  configureCloudinary(settings);

  let resources: any[] = [];
  let nextCursor: string | null = null;

  if (publicIds.length > 0) {
    resources = await getAssetsByIds(publicIds);
  } else {
    const expression = buildAssetExpression(settings.folder);
    const searchQuery = cloudinary.search
      .expression(expression)
      .sort_by('created_at', 'desc')
      .with_field('context')
      .with_field('metadata')
      .with_field('tags')
      .max_results(MAX_INDEX);

    if (payload.cursor) {
      searchQuery.next_cursor(payload.cursor);
    }

    const result = await searchQuery.execute();
    resources = result.resources ?? [];
    nextCursor = result.next_cursor ?? null;
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
