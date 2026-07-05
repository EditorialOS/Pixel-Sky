import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getAssetCount, getCloudinarySettingsForOrg } from '@/lib/cloudinary';
import { getAssetLimit } from '@/lib/limits';

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: 'Workspace required.' }, { status: 403 });
  }

  const limit = getAssetLimit();

  let settings;
  try {
    settings = await getCloudinarySettingsForOrg(orgId);
  } catch (error) {
    console.error('Cloudinary settings error:', error);
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  }

  if (!settings) {
    return NextResponse.json({ error: 'Cloudinary not connected.' }, { status: 400 });
  }

  const used = await getAssetCount(settings, Math.min(limit + 1, 500));
  const remaining = Math.max(limit - used, 0);

  return NextResponse.json({ limit, used, remaining });
}
