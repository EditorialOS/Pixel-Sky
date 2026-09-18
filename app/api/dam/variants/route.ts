import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { auth } from '@clerk/nextjs/server';
import { assetIsInWorkspaceFolder, getAssetsByIds, getCloudinarySettingsForOrg } from '@/lib/cloudinary';
import { logAuditEvent } from '@/lib/audit';
import { VARIANT_PRESETS } from '@/lib/variants';

export async function GET(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: 'Workspace required.' }, { status: 403 });
  }

  const publicId = request.nextUrl.searchParams.get('public_id');
  if (!publicId) {
    return NextResponse.json({ error: 'public_id is required.' }, { status: 400 });
  }

  let settings;
  try {
    settings = await getCloudinarySettingsForOrg(orgId);
  } catch (error) {
    console.error('Cloudinary settings error:', error);
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  }
  if (!settings) {
    return NextResponse.json({ error: 'Cloudinary is not connected for this workspace.' }, { status: 400 });
  }

  try {
    const assets = await getAssetsByIds([publicId], settings);
    if (!assets.some((asset: any) => asset.public_id === publicId && assetIsInWorkspaceFolder(asset, settings.folder))) {
      return NextResponse.json({ error: 'Asset is not available in this workspace.' }, { status: 404 });
    }
  } catch (error) {
    console.error('Cloudinary variant verification failed:', error);
    return NextResponse.json({ error: 'Unable to verify this asset.' }, { status: 502 });
  }

  const variants = VARIANT_PRESETS.map((preset) => ({
    id: preset.id,
    label: preset.label,
    width: preset.width,
    height: preset.height,
    preview_url: cloudinary.url(publicId, {
      cloud_name: settings.cloudName,
      secure: true,
      resource_type: 'image',
      type: 'upload',
      transformation: preset.transformation,
    }),
    download_url: `/api/dam/download?public_id=${encodeURIComponent(publicId)}&preset=${preset.id}`,
  }));

  try {
    await logAuditEvent({
      orgId,
      userId,
      action: 'variant_generated',
      details: { publicId, presets: VARIANT_PRESETS.map((preset) => preset.id) },
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }

  return NextResponse.json({ variants });
}
