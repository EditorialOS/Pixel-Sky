create table if not exists agent_mcp_connections (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  name text not null,
  scopes jsonb not null default '["assets:read", "asset_packs:read", "asset_packs:write"]'::jsonb,
  created_by text not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_mcp_connections_org_id_idx
  on agent_mcp_connections (org_id, created_at desc);

alter table agent_mcp_connections enable row level security;
