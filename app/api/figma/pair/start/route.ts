import { NextRequest, NextResponse } from 'next/server';
import { figmaCors, FigmaPairingError, startFigmaPairing } from '@/lib/figma-pairing';
import { assetUseWorkflowEnabled } from '@/lib/workflow-flags';

export function OPTIONS() { return new NextResponse(null, { status: 204, headers: figmaCors }); }

export async function POST(request: NextRequest) {
  if (!assetUseWorkflowEnabled()) {
    return NextResponse.json({ error: 'PixelSky Figma pairing is not enabled yet.' }, { status: 503, headers: figmaCors });
  }
  try {
    const origin = new URL(request.url).origin;
    return NextResponse.json(await startFigmaPairing(origin), { headers: figmaCors });
  } catch (error) {
    if (error instanceof FigmaPairingError) return NextResponse.json({ error: error.message }, { status: error.status, headers: figmaCors });
    console.error('Figma pairing start failed:', error);
    return NextResponse.json({ error: 'Unable to start Figma pairing.' }, { status: 500, headers: figmaCors });
  }
}
