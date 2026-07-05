import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';

type CloudinarySettingsPayload = {
  cloudName?: string;
  apiKey?: string;
  apiSecret?: string;
  folder?: string;
};

function maskValue(value: string) {
  if (!value) return '';
  if (value.length <= 6) return `${value.slice(0, 2)}•••`;
  return `${value.slice(0, 4)}•••${value.slice(-2)}`;
}

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: 'Workspace required.' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('organization_cloudinary')
    .select('cloud_name, api_key, folder')
    .eq('org_id', orgId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ connected: false });
    }
    console.error('Cloudinary settings fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings.' }, { status: 500 });
  }

  const row = data as { cloud_name: string; api_key: string; folder: string | null };

  return NextResponse.json({
    connected: true,
    cloudName: row.cloud_name,
    apiKey: maskValue(row.api_key),
    folder: row.folder ?? '',
  });
}

export async function POST(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: 'Workspace required.' }, { status: 403 });
  }

  const payload = (await request.json()) as CloudinarySettingsPayload;
  const cloudName = payload.cloudName?.trim();
  const apiKey = payload.apiKey?.trim();
  const apiSecret = payload.apiSecret?.trim();
  const folder = payload.folder?.trim() || null;

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: 'Cloud name, API key, and API secret are required.' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('organization_cloudinary')
    .upsert(
      [
        {
          org_id: orgId,
          cloud_name: cloudName,
          api_key: apiKey,
          api_secret: apiSecret,
          folder,
          updated_at: new Date().toISOString(),
        },
      ] as any,
      { onConflict: 'org_id' },
    );

  if (error) {
    console.error('Cloudinary settings update error:', error);
    return NextResponse.json({ error: 'Failed to save settings.' }, { status: 500 });
  }

  try {
    await logAuditEvent({
      orgId,
      userId,
      action: 'settings_updated',
      details: { provider: 'cloudinary', folder },
    });
  } catch (auditError) {
    console.error('Audit log error:', auditError);
  }

  return NextResponse.json({ success: true });
}
