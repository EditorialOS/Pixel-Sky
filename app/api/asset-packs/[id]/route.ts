import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { AssetPackRecord, AssetPackStatus, buildAssetPackManifest } from '@/lib/asset-packs';
import { logAuditEvent } from '@/lib/audit';
import { getSupabaseAdmin } from '@/lib/supabase';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function unavailableResponse(message: string) {
  console.error('Asset pack database error:', message);
  return NextResponse.json(
    { error: 'Asset packs are unavailable. Run the PixelSky asset-pack migration first.' },
    { status: 503 },
  );
}

async function getPack(id: string, orgId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await (supabase as any)
    .from('asset_packs')
    .select('id, org_id, title, brief, channels, notes, status, assets, created_by, reviewed_by, reviewed_at, created_at, updated_at')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();
  return { data: data as AssetPackRecord | null, error };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'Workspace required.' }, { status: 403 });
  const { id } = await context.params;

  try {
    const { data, error } = await getPack(id, orgId);
    if (error?.code === 'PGRST116') return NextResponse.json({ error: 'Asset pack not found.' }, { status: 404 });
    if (error) return unavailableResponse(error.message);
    if (!data) return NextResponse.json({ error: 'Asset pack not found.' }, { status: 404 });
    return NextResponse.json({ pack: data, manifest: buildAssetPackManifest(data) });
  } catch (error) {
    return unavailableResponse(error instanceof Error ? error.message : String(error));
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'Workspace required.' }, { status: 403 });
  const { id } = await context.params;

  let status: AssetPackStatus;
  try {
    status = ((await request.json()) as { status?: AssetPackStatus }).status as AssetPackStatus;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (status !== 'approved' && status !== 'rejected') {
    return NextResponse.json({ error: 'Only approval or rejection is allowed.' }, { status: 400 });
  }

  try {
    const { data: existing, error: loadError } = await getPack(id, orgId);
    if (loadError?.code === 'PGRST116' || !existing) {
      return NextResponse.json({ error: 'Asset pack not found.' }, { status: 404 });
    }
    if (loadError) return unavailableResponse(loadError.message);
    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Only draft packs can be reviewed.' }, { status: 409 });
    }

    const reviewedAt = new Date().toISOString();
    const supabase = getSupabaseAdmin();
    const { data, error } = await (supabase as any)
      .from('asset_packs')
      .update({ status, reviewed_by: userId, reviewed_at: reviewedAt, updated_at: reviewedAt })
      .eq('id', id)
      .eq('org_id', orgId)
      .select('id, org_id, title, brief, channels, notes, status, assets, created_by, reviewed_by, reviewed_at, created_at, updated_at')
      .single();
    if (error) return unavailableResponse(error.message);

    const pack = data as AssetPackRecord;
    try {
      await logAuditEvent({
        orgId,
        userId,
        action: status === 'approved' ? 'asset_pack_approved' : 'asset_pack_rejected',
        details: { assetPackId: pack.id, title: pack.title, assetCount: pack.assets.length },
      });
    } catch (auditError) {
      console.error('Asset pack audit error:', auditError);
    }
    return NextResponse.json({ pack, manifest: buildAssetPackManifest(pack) });
  } catch (error) {
    return unavailableResponse(error instanceof Error ? error.message : String(error));
  }
}
