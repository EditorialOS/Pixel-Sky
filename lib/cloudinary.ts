import { v2 as cloudinary } from 'cloudinary';
import { getSupabaseAdmin } from './supabase';

export type CloudinarySettings = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder?: string | null;
};

type CloudinaryRow = {
  org_id: string;
  cloud_name: string;
  api_key: string;
  api_secret: string;
  folder: string | null;
};

export async function getCloudinarySettingsForOrg(orgId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('organization_cloudinary')
    .select('org_id, cloud_name, api_key, api_secret, folder')
    .eq('org_id', orgId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  const row = data as CloudinaryRow;
  return {
    cloudName: row.cloud_name,
    apiKey: row.api_key,
    apiSecret: row.api_secret,
    folder: row.folder,
  } satisfies CloudinarySettings;
}

export function configureCloudinary(settings: CloudinarySettings) {
  cloudinary.config({
    cloud_name: settings.cloudName,
    api_key: settings.apiKey,
    api_secret: settings.apiSecret,
    secure: true,
  });
}

function escapeExpressionValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const escaped = trimmed.replace(/"/g, '\\"');
  return /\s/.test(escaped) ? `"${escaped}"` : escaped;
}

export function buildAssetExpression(folder?: string | null) {
  const trimmedFolder = folder?.trim();
  const folderExpression = trimmedFolder ? ` AND folder:${escapeExpressionValue(trimmedFolder)}` : '';
  return `resource_type:image AND type:upload${folderExpression}`;
}

export async function getAssetCount(settings: CloudinarySettings, maxResults: number) {
  configureCloudinary(settings);
  const expression = buildAssetExpression(settings.folder);
  const searchQuery = cloudinary.search
    .expression(expression)
    .sort_by('created_at', 'desc')
    .max_results(maxResults);
  const result = await searchQuery.execute();
  if (typeof result.total_count === 'number') {
    return result.total_count;
  }
  return Array.isArray(result.resources) ? result.resources.length : 0;
}

export async function getAssetsByIds(publicIds: string[]) {
  if (publicIds.length === 0) return [];
  const result = await cloudinary.api.resources_by_ids(publicIds, {
    resource_type: 'image',
    type: 'upload',
    context: true,
    metadata: true,
    tags: true,
  });
  return result.resources ?? [];
}
