import { NextRequest, NextResponse } from 'next/server';
import { claimFigmaPairing, figmaCors, FigmaPairingError } from '@/lib/figma-pairing';
import { assetUseWorkflowEnabled } from '@/lib/workflow-flags';

export function OPTIONS() { return new NextResponse(null, { status: 204, headers: figmaCors }); }

export async function POST(request: NextRequest) {
  if (!assetUseWorkflowEnabled()) {
    return NextResponse.json({ error: 'PixelSky Figma pairing is not enabled yet.' }, { status: 503, headers: figmaCors });
  }
  let body: { id?: string; secret?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400, headers: figmaCors }); }
  try {
    return NextResponse.json(await claimFigmaPairing(body.id ?? '', body.secret ?? ''), { headers: figmaCors });
  } catch (error) {
    if (error instanceof FigmaPairingError) return NextResponse.json({ error: error.message }, { status: error.status, headers: figmaCors });
    console.error('Figma pairing claim failed:', error);
    return NextResponse.json({ error: 'Unable to complete Figma pairing.' }, { status: 500, headers: figmaCors });
  }
}
