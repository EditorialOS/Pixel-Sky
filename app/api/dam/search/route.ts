import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { logAuditEvent } from '@/lib/audit';
import {
  DamSearchError,
  DamSearchRequest,
  SearchMode,
  searchDamAssets,
} from '@/lib/dam-search';

async function runSearch(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'Workspace required.' }, { status: 403 });

  const payload = request.method === 'POST'
    ? (await request.json()) as DamSearchRequest
    : {
      query: request.nextUrl.searchParams.get('q') ?? '',
      cursor: request.nextUrl.searchParams.get('cursor') ?? undefined,
      mode: request.nextUrl.searchParams.get('mode') as SearchMode | null ?? undefined,
      limit: request.nextUrl.searchParams.get('limit')
        ? Number(request.nextUrl.searchParams.get('limit'))
        : undefined,
    };

  const result = await searchDamAssets(orgId, payload);
  if (result.query.trim()) {
    try {
      await logAuditEvent({
        orgId,
        userId,
        action: result.mode === 'semantic' && !result.ai_fallback ? 'ai_search' : 'search',
        details: {
          query: result.query,
          mode: result.mode,
          total: result.total,
          returned: result.assets.length,
          fallback: result.ai_fallback,
        },
      });
    } catch (error) {
      console.error('Audit log error:', error);
    }
  }
  return NextResponse.json(result);
}

async function handleSearch(request: NextRequest) {
  try {
    return await runSearch(request);
  } catch (error) {
    if (error instanceof DamSearchError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('DAM search error: unexpected failure');
    return NextResponse.json({ error: 'Failed to search assets.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return handleSearch(request);
}

export async function GET(request: NextRequest) {
  return handleSearch(request);
}
