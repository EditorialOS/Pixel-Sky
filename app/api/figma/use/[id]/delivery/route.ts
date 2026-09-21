import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgentApiKey, hasAgentScope } from '@/lib/agent-keys';
import { AssetUseError, deliverAssetUse } from '@/lib/asset-use-requests';
import { figmaCors } from '@/lib/figma-pairing';

type Context = { params: Promise<{ id: string }> };

export function OPTIONS() { return new NextResponse(null, { status: 204, headers: figmaCors }); }

export async function GET(request: NextRequest, context: Context) {
  try {
    const principal = await authenticateAgentApiKey(request);
    if (!principal || !hasAgentScope(principal, 'asset_uses:read')) {
      return NextResponse.json({ error: 'Connect PixelSky in Figma again.' }, { status: 401, headers: figmaCors });
    }
    return NextResponse.json(await deliverAssetUse(principal.orgId, principal.actorId, (await context.params).id), { headers: figmaCors });
  } catch (error) {
    if (error instanceof AssetUseError) return NextResponse.json({ error: error.message }, { status: error.status, headers: figmaCors });
    console.error('Figma delivery failed:', error);
    return NextResponse.json({ error: 'Unable to deliver this image.' }, { status: 500, headers: figmaCors });
  }
}
