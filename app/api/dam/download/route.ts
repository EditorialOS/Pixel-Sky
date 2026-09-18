import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { auth } from '@clerk/nextjs/server';
import { assetIsInWorkspaceFolder, getAssetsByIds, getCloudinarySettingsForOrg } from '@/lib/cloudinary';
import { getVariantPresetById } from '@/lib/variants';
import { logAuditEvent } from '@/lib/audit';

export async function GET(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: 'Workspace required.' }, { status: 403 });
  }

  const publicId = request.nextUrl.searchParams.get('public_id');
  const presetId = request.nextUrl.searchParams.get('preset');
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
    console.error('Cloudinary download verification failed:', error);
    return NextResponse.json({ error: 'Unable to verify this asset.' }, { status: 502 });
  }

  const preset = presetId ? getVariantPresetById(presetId) : null;

  const downloadUrl = cloudinary.url(publicId, {
    cloud_name: settings.cloudName,
    secure: true,
    resource_type: 'image',
    type: 'upload',
    flags: 'attachment',
    transformation: preset?.transformation,
  });

  try {
    await logAuditEvent({
      orgId,
      userId,
      action: 'download',
      details: { publicId, preset: presetId ?? null },
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }

  return NextResponse.redirect(downloadUrl);
}
