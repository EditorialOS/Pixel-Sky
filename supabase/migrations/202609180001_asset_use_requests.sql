create table if not exists asset_use_requests (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  public_id text not null,
  asset_id text not null,
  asset_version bigint not null,
  filename text not null,
  preview_url text not null,
  usage_rights text,
  credit text,
  tags jsonb not null default '[]'::jsonb,
  channel text not null,
  campaign text not null,
  placement text not null,
  region text not null,
  purpose text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'revoked')),
  requested_by text not null,
  reviewed_by text,
  reviewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists asset_use_requests_org_status_idx
  on asset_use_requests (org_id, status, created_at desc);

create index if not exists asset_use_requests_org_asset_idx
  on asset_use_requests (org_id, public_id, created_at desc);

alter table asset_use_requests enable row level security;

alter table agent_api_keys add column if not exists expires_at timestamptz;

create table if not exists figma_pairings (
  id uuid primary key default gen_random_uuid(),
  secret_hash text not null,
  approved_org_id text,
  approved_by text,
  expires_at timestamptz not null default now() + interval '10 minutes',
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists figma_pairings_expires_idx on figma_pairings (expires_at);
alter table figma_pairings enable row level security;
