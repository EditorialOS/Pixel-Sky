import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { authenticateAgentApiKey, hasAgentScope } from '@/lib/agent-keys';
import { assetIsInWorkspaceFolder, getAssetsByIds, getCloudinarySettingsForOrg } from '@/lib/cloudinary';
import { figmaCors } from '@/lib/figma-pairing';

export function OPTIONS() { return new NextResponse(null, { status: 204, headers: figmaCors }); }

export async function GET(request: NextRequest) {
  try {
    const principal = await authenticateAgentApiKey(request);
    if (!principal || !hasAgentScope(principal, 'assets:read')) {
      return NextResponse.json({ error: 'Connect PixelSky in Figma again.' }, { status: 401, headers: figmaCors });
    }

    const publicId = request.nextUrl.searchParams.get('public_id')?.trim();
    if (!publicId || publicId.length > 512) {
      return NextResponse.json({ error: 'A valid asset is required.' }, { status: 400, headers: figmaCors });
    }

    const settings = await getCloudinarySettingsForOrg(principal.orgId);
    if (!settings) {
      return NextResponse.json({ error: 'Cloudinary is not connected for this workspace.' }, { status: 400, headers: figmaCors });
    }

    const assets = await getAssetsByIds([publicId], settings);
    const asset = assets.find((item: any) => item.public_id === publicId && assetIsInWorkspaceFolder(item, settings.folder));
    if (!asset) {
      return NextResponse.json({ error: 'This asset is not available in this workspace.' }, { status: 404, headers: figmaCors });
    }

    const baseOptions = {
      cloud_name: settings.cloudName,
      secure: true,
      resource_type: 'image' as const,
      type: 'upload' as const,
      transformation: [{
        width: 2_000,
        height: 2_000,
        crop: 'limit' as const,
        quality: 'auto:good',
        fetch_format: 'jpg',
      }],
    };

    return NextResponse.json({
      public_id: publicId,
      filename: asset.filename || publicId.split('/').pop() || publicId,
      figma_image_url: cloudinary.url(publicId, baseOptions),
      download_url: cloudinary.url(publicId, { ...baseOptions, flags: 'attachment' }),
    }, { headers: figmaCors });
  } catch (error) {
    console.error('Figma asset delivery failed:', error);
    return NextResponse.json({ error: 'Unable to retrieve this asset.' }, { status: 502, headers: figmaCors });
  }
}
