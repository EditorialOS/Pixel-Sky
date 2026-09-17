create table if not exists asset_packs (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  title text not null,
  brief text not null,
  channels jsonb not null default '[]'::jsonb,
  notes text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  assets jsonb not null default '[]'::jsonb,
  created_by text not null,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists asset_packs_org_updated_at_idx
  on asset_packs (org_id, updated_at desc);

create index if not exists asset_packs_org_status_idx
  on asset_packs (org_id, status);
