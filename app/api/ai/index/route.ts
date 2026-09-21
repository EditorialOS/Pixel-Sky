import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  assetIsInWorkspaceFolder,
  buildAssetAnalysisUrl,
  cloudinaryErrorMessage,
  getAssetsByIds,
  getCloudinarySettingsForOrg,
  logCloudinaryError,
  scanImageAssets,
} from '@/lib/cloudinary';
import { describeAsset, visualDescriptionTerms } from '@/lib/asset-description';
import {
  buildEmbeddingText,
  createEmbeddings,
  markAssetIndexFailure,
  upsertAssetEmbeddings,
  type EmbeddingAsset,
} from '@/lib/embeddings';
import { logAuditEvent } from '@/lib/audit';
import { getSupabaseAdmin } from '@/lib/supabase';

export const maxDuration = 60;

type IndexRequest = {
  publicIds?: string[];
  force?: boolean;
};

type IndexState = {
  public_id: string;
  asset_id: string | null;
  asset_version: number | null;
  status: 'pending' | 'complete' | 'failed';
  attempt_count: number;
};

const MAX_INDEX = 5;
const MAX_ATTEMPTS = 3;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to index this asset.';
}

function isCurrent(asset: any, state?: IndexState) {
  return Boolean(
    state?.status === 'complete'
      && state.asset_id === (asset.asset_id ?? null)
      && state.asset_version === (asset.version ?? null),
  );
}

function isRetryable(asset: any, state: IndexState | undefined, force: boolean) {
  if (force || !state) return true;
  if (isCurrent(asset, state)) return false;
  const sameVersion = state.asset_id === (asset.asset_id ?? null)
    && state.asset_version === (asset.version ?? null);
  return !sameVersion || state.attempt_count < MAX_ATTEMPTS;
}

async function indexAsset(orgId: string, asset: any, cloudName: string) {
  const base: EmbeddingAsset = {
    public_id: asset.public_id,
    asset_id: asset.asset_id,
    version: asset.version,
    filename: asset.filename || asset.public_id?.split('/').pop() || asset.public_id,
    tags: asset.tags ?? [],
    context: asset.context ?? {},
    metadata: asset.metadata ?? {},
  };
  const description = await describeAsset(
    buildAssetAnalysisUrl(asset.public_id, cloudName),
    buildEmbeddingText(base),
  );
  const enriched: EmbeddingAsset = {
    ...base,
    visual_description: description.description,
    visual_tags: visualDescriptionTerms(description),
  };
  const [embedding] = await createEmbeddings([buildEmbeddingText(enriched)]);
  await upsertAssetEmbeddings(orgId, [enriched], [embedding]);
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await task(item);
    }
  }));
}

export async function POST(request: NextRequest) {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: 'Workspace required.' }, { status: 403 });
  }
  if (orgRole !== 'org:admin') {
    return NextResponse.json({ error: 'Workspace admin access is required to build the visual index.' }, { status: 403 });
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
  const publicIds = [...new Set((payload.publicIds ?? []).filter(Boolean))].slice(0, 100);
  const force = payload.force === true && publicIds.length > 0;

  let resources: any[];
  try {
    resources = publicIds.length > 0
      ? await getAssetsByIds(publicIds, settings)
      : await scanImageAssets(settings);
    resources = resources.filter((asset) => assetIsInWorkspaceFolder(asset, settings.folder));
  } catch (error) {
    logCloudinaryError('Cloudinary visual indexing failed', error);
    return NextResponse.json({ error: cloudinaryErrorMessage(error) }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: existing, error: stateError } = await supabase
    .from('asset_embeddings')
    .select('public_id, asset_id, asset_version, status, attempt_count')
    .eq('org_id', orgId);

  if (stateError) {
    console.error('Visual index state error:', stateError);
    return NextResponse.json(
      { error: 'The visual index database migration has not been applied.' },
      { status: 503 },
    );
  }

  const stateById = new Map(
    ((existing ?? []) as IndexState[]).map((state) => [state.public_id, state]),
  );
  const candidates = resources
    .filter((asset) => isRetryable(asset, stateById.get(asset.public_id), force))
    .sort((left, right) =>
      (stateById.get(left.public_id)?.attempt_count ?? 0)
      - (stateById.get(right.public_id)?.attempt_count ?? 0),
    );
  const batch = candidates.slice(0, MAX_INDEX);
  const failures: Array<{ public_id: string; error: string }> = [];
  let indexed = 0;

  await runWithConcurrency(batch, 2, async (asset) => {
    try {
      await indexAsset(orgId, asset, settings.cloudName);
      indexed += 1;
    } catch (error) {
      const message = errorMessage(error);
      failures.push({ public_id: asset.public_id, error: message });
      try {
        await markAssetIndexFailure(orgId, {
          public_id: asset.public_id,
          asset_id: asset.asset_id,
          version: asset.version,
        }, message);
      } catch (stateUpdateError) {
        console.error('Unable to record visual index failure:', stateUpdateError);
      }
    }
  });

  const retryableFailures = failures.filter(({ public_id }) => {
    const previousAttempts = stateById.get(public_id)?.attempt_count ?? 0;
    return previousAttempts + 1 < MAX_ATTEMPTS;
  }).length;
  const remaining = Math.max(candidates.length - batch.length + retryableFailures, 0);
  const complete = resources.filter((asset) => isCurrent(asset, stateById.get(asset.public_id))).length + indexed;
  const previouslyBlocked = resources.filter((asset) => {
    const state = stateById.get(asset.public_id);
    return state?.status === 'failed'
      && state.asset_id === (asset.asset_id ?? null)
      && state.asset_version === (asset.version ?? null)
      && state.attempt_count >= MAX_ATTEMPTS;
  }).length;
  const newlyBlocked = failures.filter(({ public_id }) =>
    (stateById.get(public_id)?.attempt_count ?? 0) + 1 >= MAX_ATTEMPTS,
  ).length;

  try {
    await logAuditEvent({
      orgId,
      userId,
      action: 'visual_index',
      details: { indexed, failed: failures.length, remaining, total: resources.length },
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }

  return NextResponse.json({
    indexed,
    failed: failures.length,
    failed_total: previouslyBlocked + newlyBlocked,
    failures,
    complete,
    remaining,
    total: resources.length,
    next_cursor: remaining > 0 ? 'continue' : null,
  });
}
