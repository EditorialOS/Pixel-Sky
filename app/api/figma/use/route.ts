import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgentApiKey, hasAgentScope } from '@/lib/agent-keys';
import { AssetUseError, AssetUseInput, createAssetUseRequest, listAssetUseRequests } from '@/lib/asset-use-requests';
import { figmaCors } from '@/lib/figma-pairing';

export function OPTIONS() { return new NextResponse(null, { status: 204, headers: figmaCors }); }

export async function GET(request: NextRequest) {
  try {
    const principal = await authenticateAgentApiKey(request);
    if (!principal || !hasAgentScope(principal, 'asset_uses:read')) {
      return NextResponse.json({ error: 'Connect PixelSky in Figma again.' }, { status: 401, headers: figmaCors });
    }
    return NextResponse.json({ requests: await listAssetUseRequests(principal.orgId) }, { headers: figmaCors });
  } catch (error) {
    if (error instanceof AssetUseError) return NextResponse.json({ error: error.message }, { status: error.status, headers: figmaCors });
    console.error('Figma use lookup failed:', error);
    return NextResponse.json({ error: 'Unable to load requests.' }, { status: 500, headers: figmaCors });
  }
}

export async function POST(request: NextRequest) {
  try {
    const principal = await authenticateAgentApiKey(request);
    if (!principal || !hasAgentScope(principal, 'asset_uses:request')) {
      return NextResponse.json({ error: 'Connect PixelSky in Figma again.' }, { status: 401, headers: figmaCors });
    }
    const input = await request.json() as AssetUseInput;
    return NextResponse.json({ request: await createAssetUseRequest(principal.orgId, principal.actorId, input) }, { status: 201, headers: figmaCors });
  } catch (error) {
    if (error instanceof AssetUseError) return NextResponse.json({ error: error.message }, { status: error.status, headers: figmaCors });
    console.error('Figma use request failed:', error);
    return NextResponse.json({ error: 'Unable to request image use.' }, { status: 500, headers: figmaCors });
  }
}
