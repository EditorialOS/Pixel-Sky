const DEFAULT_ASSET_LIMIT = 50;
const MAX_ASSET_LIMIT = 500;

export function getAssetLimit() {
  const raw = process.env.LIGHT_DAM_ASSET_LIMIT;
  if (!raw) return DEFAULT_ASSET_LIMIT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_ASSET_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_ASSET_LIMIT);
}
