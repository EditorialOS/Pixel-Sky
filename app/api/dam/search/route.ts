import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { auth } from '@clerk/nextjs/server';
import { configureCloudinary, getAssetsByIds, getCloudinarySettingsForOrg } from '@/lib/cloudinary';
import { logAuditEvent } from '@/lib/audit';
import { createEmbeddings } from '@/lib/embeddings';
import { getSupabaseAdmin } from '@/lib/supabase';

type SearchMode = 'strict' | 'semantic';

type DamSearchRequest = {
  query?: string;
  cursor?: string;
  limit?: number;
  mode?: SearchMode;
};

type MatchRow = {
  public_id: string;
};

type DamAsset = {
  id: string;
  public_id: string;
  asset_id?: string;
  asset_number?: string;
  filename: string;
  folder?: string | null;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
  created_at?: string;
  tags: string[];
  context: Record<string, string>;
  metadata: Record<string, string>;
  secure_url?: string;
  preview_url: string;
  download_url: string;
  ai_tag_confidence?: Record<string, number>;
};

const DEFAULT_LIMIT = 48;
const MAX_LIMIT = 100;
const MAX_FETCH = 100; // PixelSky (Light DAM) targets small libraries (20-50 assets)

const STOPWORDS = new Set([
  'a', 'an', 'the', 'for', 'to', 'and', 'or', 'with', 'of', 'in', 'on', 'at',
  'from', 'by', 'is', 'are', 'be', 'this', 'that', 'these', 'those', 'show',
  'find', 'search', 'get', 'need', 'looking',
]);

function escapeExpressionValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const escaped = trimmed.replace(/"/g, '\\"');
  return /\s/.test(escaped) ? `"${escaped}"` : escaped;
}

function normalizeRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const record = value as Record<string, unknown>;
  const result: Record<string, string> = {};
  Object.entries(record).forEach(([key, entry]) => {
    if (entry === null || entry === undefined) return;
    result[key] = String(entry);
  });
  return result;
}

function normalizeContext(context: unknown): Record<string, string> {
  if (!context || typeof context !== 'object') return {};
  const ctx = context as { custom?: Record<string, unknown> } & Record<string, unknown>;
  return normalizeRecord(ctx.custom ?? ctx);
}

function parseQuery(rawQuery: string) {
  const normalized = rawQuery.toLowerCase();
  const idMatch = normalized.match(/(?:^|\s)(?:#|image\s*#?|asset\s*#?|id\s*#?)(\d+)/);
  const assetId = idMatch?.[1];
  const terms = normalized
    .replace(/[^a-z0-9#\s_-]/g, ' ')
    .split(/\s+/)
    .map((term) => term.replace(/^#+/, ''))
    .filter(Boolean)
    .filter((term) => !STOPWORDS.has(term))
    .filter((term) => term !== assetId)
    .slice(0, 8);

  return { assetId, terms };
}

function buildSearchableText(asset: {
  asset_id?: string;
  public_id: string;
  filename?: string;
  tags?: string[];
  context?: unknown;
  metadata?: unknown;
  format?: string;
}) {
  const context = normalizeContext(asset.context);
  const metadata = normalizeRecord(asset.metadata);
  const parts: string[] = [
    asset.asset_id,
    asset.public_id,
    asset.filename,
    asset.format,
    ...(asset.tags ?? []),
    ...Object.values(context),
    ...Object.values(metadata),
  ].filter(Boolean) as string[];

  return parts.join(' ').toLowerCase();
}

function scoreAsset(
  asset: Parameters<typeof buildSearchableText>[0],
  terms: string[],
) {
  if (terms.length === 0) return 1;
  const searchable = buildSearchableText(asset);
  let score = 0;
  for (const term of terms) {
    if (searchable.includes(term)) score += 1;
  }
  return score / terms.length;
}

function matchesQuery(
  asset: Parameters<typeof buildSearchableText>[0],
  query: { assetId?: string; terms: string[] },
) {
  if (!query.assetId && query.terms.length === 0) return true;
  const searchable = buildSearchableText(asset);

  if (query.assetId) {
    return searchable.includes(query.assetId);
  }

  return query.terms.every((term) => searchable.includes(term));
}

function buildPreviewUrl(publicId: string) {
  return cloudinary.url(publicId, {
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

function buildDownloadUrl(publicId: string) {
  return `/api/dam/download?public_id=${encodeURIComponent(publicId)}`;
}

function mapAsset(asset: any): DamAsset {
  const context = normalizeContext(asset.context);
  const metadata = normalizeRecord(asset.metadata);
  const assetNumber =
    metadata.asset_id ||
    context.asset_id ||
    metadata.assetId ||
    context.assetId;

  const filename =
    asset.filename || asset.public_id?.split('/').pop() || asset.public_id;

  const aiTagConfidence = parseTagConfidence(
    context.ai_tag_confidence ||
      metadata.ai_tag_confidence ||
      context.ai_tag_scores ||
      metadata.ai_tag_scores ||
      context.ai_tags ||
      metadata.ai_tags,
  );

  return {
    id: asset.asset_id || asset.public_id,
    public_id: asset.public_id,
    asset_id: asset.asset_id,
    asset_number: assetNumber,
    filename,
    folder: asset.folder ?? null,
    format: asset.format,
    width: asset.width,
    height: asset.height,
    bytes: asset.bytes,
    created_at: asset.created_at,
    tags: asset.tags ?? [],
    context,
    metadata,
    secure_url: asset.secure_url,
    preview_url: buildPreviewUrl(asset.public_id),
    download_url: buildDownloadUrl(asset.public_id),
    ai_tag_confidence: Object.keys(aiTagConfidence).length > 0 ? aiTagConfidence : undefined,
  };
}

function toSearchAsset(asset: any) {
  return {
    asset_id: asset.asset_id,
    public_id: asset.public_id,
    filename: asset.filename,
    tags: asset.tags,
    context: asset.context,
    metadata: asset.metadata,
    format: asset.format,
  };
}

function parseTagConfidence(value?: string) {
  if (!value) return {} as Record<string, number>;
  const trimmed = value.trim();
  if (!trimmed) return {} as Record<string, number>;

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, number>;
      return normalizeConfidenceMap(parsed);
    } catch {
      return {} as Record<string, number>;
    }
  }

  const entries = trimmed.split(',').map((pair) => pair.trim()).filter(Boolean);
  const map: Record<string, number> = {};
  entries.forEach((entry) => {
    const [tag, scoreRaw] = entry.split(':').map((part) => part.trim());
    if (!tag || !scoreRaw) return;
    const score = Number(scoreRaw);
    if (Number.isNaN(score)) return;
    map[tag] = normalizeConfidence(score);
  });
  return map;
}

function normalizeConfidenceMap(map: Record<string, number>) {
  const normalized: Record<string, number> = {};
  Object.entries(map).forEach(([tag, score]) => {
    if (typeof score !== 'number' || Number.isNaN(score)) return;
    normalized[tag] = normalizeConfidence(score);
  });
  return normalized;
}

function normalizeConfidence(score: number) {
  const normalized = score > 1 ? score / 100 : score;
  return Math.min(Math.max(normalized, 0), 1);
}

async function runSearch(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: 'Workspace required.' }, { status: 403 });
  }

  const isPost = request.method === 'POST';
  const payload = isPost ? ((await request.json()) as DamSearchRequest) : null;
  const query = payload?.query ?? request.nextUrl.searchParams.get('q') ?? '';
  const cursor =
    payload?.cursor ?? request.nextUrl.searchParams.get('cursor') ?? undefined;
  const modeParam =
    payload?.mode ?? (request.nextUrl.searchParams.get('mode') as SearchMode | null);
  const mode: SearchMode = modeParam === 'semantic' ? 'semantic' : 'strict';
  const isSemantic = mode === 'semantic';
  const limitParam = payload?.limit ?? request.nextUrl.searchParams.get('limit');
  const requestedLimit =
    typeof limitParam === 'number'
      ? limitParam
      : limitParam
        ? Number(limitParam)
        : undefined;
  const limit = Number.isFinite(requestedLimit ?? Number.NaN)
    ? Math.min(Math.max(requestedLimit as number, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

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
      {
        error: 'Cloudinary is not connected for this workspace.',
        query,
        total: 0,
        assets: [],
        next_cursor: null,
      },
      { status: 400 },
    );
  }

  configureCloudinary(settings);

  const folder = settings.folder?.trim();
  const folderExpression = folder ? ` AND folder:${escapeExpressionValue(folder)}` : '';
  const expression = `resource_type:image AND type:upload${folderExpression}`;

  const searchQuery = cloudinary.search
    .expression(expression)
    .sort_by('created_at', 'desc')
    .with_field('context')
    .with_field('metadata')
    .with_field('tags')
    .max_results(MAX_FETCH);

  if (cursor) {
    searchQuery.next_cursor(cursor);
  }

  const result = await searchQuery.execute();
  const parsedQuery = parseQuery(query);
  const resources = result.resources ?? [];
  let filtered: any[] = [];
  let aiFallback = false;

  if (isSemantic && query.trim().length > 0) {
    try {
      const embeddings = await createEmbeddings([query]);
      const embedding = embeddings[0];
      const supabase = getSupabaseAdmin();
      const { data, error } = await (supabase as any).rpc('match_asset_embeddings', {
        query_embedding: embedding,
        match_count: limit,
        org_id: orgId,
      });

      if (error) {
        throw error;
      }

      const publicIds = (data ?? []).map((row: MatchRow) => row.public_id);
      if (publicIds.length > 0) {
        const semanticResources = await getAssetsByIds(publicIds);
        const resourceMap = new Map(semanticResources.map((asset: any) => [asset.public_id, asset]));
        filtered = publicIds.map((id: string) => resourceMap.get(id)).filter(Boolean);
      } else {
        aiFallback = true;
      }
    } catch (error) {
      console.error('Semantic search error:', error);
      aiFallback = true;
    }
  }

  if (!isSemantic || aiFallback) {
    if (parsedQuery.assetId) {
      filtered = resources.filter((asset: any) =>
        buildSearchableText(toSearchAsset(asset)).includes(parsedQuery.assetId as string),
      );
    } else {
      const scored = resources
        .map((asset: any) => {
          const score = scoreAsset(toSearchAsset(asset), parsedQuery.terms);
          return score > 0 ? { asset, score } : null;
        })
        .filter((item: { asset: any; score: number } | null): item is { asset: any; score: number } => item !== null);
      scored.sort((a: { score: number }, b: { score: number }) => b.score - a.score);
      filtered = scored.map((item: { asset: any; score: number }) => item.asset);
    }
  }

  const assets = filtered.slice(0, limit).map(mapAsset);

  if (query.trim().length > 0) {
    try {
      await logAuditEvent({
        orgId,
        userId,
        action: isSemantic && !aiFallback ? 'ai_search' : 'search',
        details: {
          query,
          mode,
          total: filtered.length,
          returned: assets.length,
          fallback: aiFallback,
        },
      });
    } catch (error) {
      console.error('Audit log error:', error);
    }
  }

  return NextResponse.json({
    query,
    total: filtered.length,
    assets,
    next_cursor: result.next_cursor ?? null,
    mode,
    ai_fallback: aiFallback,
  });
}

export async function POST(request: NextRequest) {
  try {
    return await runSearch(request);
  } catch (error) {
    console.error('DAM search error:', error);
    return NextResponse.json(
      { error: 'Failed to search assets.' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    return await runSearch(request);
  } catch (error) {
    console.error('DAM search error:', error);
    return NextResponse.json(
      { error: 'Failed to search assets.' },
      { status: 500 },
    );
  }
}
