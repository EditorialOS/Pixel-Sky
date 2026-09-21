import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgentApiKey, revokeAgentApiKey } from '@/lib/agent-keys';
import { figmaCors } from '@/lib/figma-pairing';

export function OPTIONS() { return new NextResponse(null, { status: 204, headers: figmaCors }); }

export async function POST(request: NextRequest) {
  try {
    const principal = await authenticateAgentApiKey(request);
    if (!principal || principal.name !== 'PixelSky Figma plugin') {
      return NextResponse.json({ error: 'Figma connection not found.' }, { status: 401, headers: figmaCors });
    }
    await revokeAgentApiKey({ id: principal.id, orgId: principal.orgId });
    return NextResponse.json({ disconnected: true }, { headers: figmaCors });
  } catch (error) {
    console.error('Figma disconnect failed:', error);
    return NextResponse.json({ error: 'Unable to disconnect PixelSky.' }, { status: 500, headers: figmaCors });
  }
}
