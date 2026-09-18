import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { approveFigmaPairing, FigmaPairingError } from '@/lib/figma-pairing';
import { assetUseWorkflowEnabled } from '@/lib/workflow-flags';

export async function POST(request: NextRequest) {
  if (!assetUseWorkflowEnabled()) {
    return NextResponse.json({ error: 'PixelSky Figma pairing is not enabled yet.' }, { status: 503 });
  }
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'Choose a PixelSky workspace first.' }, { status: 403 });
  let body: { id?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }); }
  if (!body.id || !/^[0-9a-f-]{36}$/.test(body.id)) {
    return NextResponse.json({ error: 'Invalid pairing code.' }, { status: 400 });
  }
  try {
    await approveFigmaPairing(body.id, orgId, userId);
    return NextResponse.json({ approved: true });
  } catch (error) {
    if (error instanceof FigmaPairingError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Figma pairing approval failed:', error);
    return NextResponse.json({ error: 'Unable to approve Figma pairing.' }, { status: 500 });
  }
}
