import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  AssetUseError,
  AssetUseInput,
  AssetUseStatus,
  createAssetUseRequest,
  listAssetUseRequests,
} from '@/lib/asset-use-requests';

function failure(error: unknown) {
  if (error instanceof AssetUseError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('Asset use request failed:', error);
  return NextResponse.json({ error: 'Unable to process the asset-use request.' }, { status: 500 });
}

export async function GET(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'Workspace required.' }, { status: 403 });
  const rawStatus = request.nextUrl.searchParams.get('status');
  const status = ['pending', 'approved', 'rejected', 'revoked'].includes(rawStatus ?? '')
    ? rawStatus as AssetUseStatus : undefined;
  try {
    return NextResponse.json({ requests: await listAssetUseRequests(orgId, status) });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'Workspace required.' }, { status: 403 });
  let input: AssetUseInput;
  try {
    input = await request.json() as AssetUseInput;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  try {
    return NextResponse.json({ request: await createAssetUseRequest(orgId, userId, input) }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
