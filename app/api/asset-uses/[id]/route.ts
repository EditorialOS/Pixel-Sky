import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { AssetUseError, getAssetUseRequest, reviewAssetUseRequest } from '@/lib/asset-use-requests';

type Context = { params: Promise<{ id: string }> };

function failure(error: unknown) {
  if (error instanceof AssetUseError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('Asset use review failed:', error);
  return NextResponse.json({ error: 'Unable to process the asset-use request.' }, { status: 500 });
}

export async function GET(_request: NextRequest, context: Context) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'Workspace required.' }, { status: 403 });
  try {
    return NextResponse.json({ request: await getAssetUseRequest(orgId, (await context.params).id) });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!orgId || orgRole !== 'org:admin') {
    return NextResponse.json({ error: 'Workspace admin access is required to review uses.' }, { status: 403 });
  }
  let input: { status?: string; expires_at?: string };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (input.status !== 'approved' && input.status !== 'rejected' && input.status !== 'revoked') {
    return NextResponse.json({ error: 'Status must be approved, rejected, or revoked.' }, { status: 400 });
  }
  try {
    const record = await reviewAssetUseRequest(orgId, userId, (await context.params).id, input.status, input.expires_at);
    return NextResponse.json({ request: record });
  } catch (error) {
    return failure(error);
  }
}
