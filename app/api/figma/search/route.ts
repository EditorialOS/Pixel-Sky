import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgentApiKey, hasAgentScope } from '@/lib/agent-keys';
import { DamSearchError, searchDamAssets } from '@/lib/dam-search';
import { figmaCors } from '@/lib/figma-pairing';

export function OPTIONS() { return new NextResponse(null, { status: 204, headers: figmaCors }); }

export async function GET(request: NextRequest) {
  try {
    const principal = await authenticateAgentApiKey(request);
    if (!principal || !hasAgentScope(principal, 'assets:read')) {
      return NextResponse.json({ error: 'Connect PixelSky in Figma again.' }, { status: 401, headers: figmaCors });
    }
    const result = await searchDamAssets(principal.orgId, {
      query: request.nextUrl.searchParams.get('q') ?? '', mode: 'semantic', limit: 12,
    });
    return NextResponse.json({
      assets: result.assets.map(({ public_id, filename, preview_url, tags, context, metadata, visual_description, visual_tags }) => ({
        public_id,
        filename,
        preview_url,
        tags,
        context,
        metadata,
        visual_description,
        visual_tags,
      })),
      total: result.total,
      outside_scope_matches: result.outside_scope_matches,
    }, { headers: figmaCors });
  } catch (error) {
    if (error instanceof DamSearchError) return NextResponse.json({ error: error.message }, { status: error.status, headers: figmaCors });
    console.error('Figma search failed:', error);
    return NextResponse.json({ error: 'Unable to search assets.' }, { status: 500, headers: figmaCors });
  }
}
