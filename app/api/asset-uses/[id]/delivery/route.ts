import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { AssetUseError, deliverAssetUse } from '@/lib/asset-use-requests';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'Workspace required.' }, { status: 403 });
  try {
    const delivery = await deliverAssetUse(orgId, userId, (await context.params).id);
    return NextResponse.json(delivery, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AssetUseError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Asset use delivery failed:', error);
    return NextResponse.json({ error: 'Unable to deliver this asset.' }, { status: 500 });
  }
}
