export const AGENT_SCOPES = [
  'assets:read',
  'asset_packs:read',
  'asset_packs:write',
  'asset_packs:approve',
  'asset_uses:read',
  'asset_uses:request',
] as const;

export type AgentScope = (typeof AGENT_SCOPES)[number];

export const DEFAULT_AGENT_SCOPES: AgentScope[] = [
  'assets:read',
  'asset_packs:read',
  'asset_packs:write',
  'asset_uses:read',
  'asset_uses:request',
];
