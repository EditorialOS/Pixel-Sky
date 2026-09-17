create table if not exists agent_api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  name text not null,
  token_prefix text not null,
  token_hash text not null unique,
  scopes jsonb not null default '["assets:read", "asset_packs:read", "asset_packs:write"]'::jsonb,
  created_by text not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists agent_api_keys_org_id_idx
  on agent_api_keys (org_id, created_at desc);

alter table agent_api_keys enable row level security;
