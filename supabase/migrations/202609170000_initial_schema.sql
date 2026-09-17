create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists organization_cloudinary (
  org_id text primary key,
  cloud_name text not null,
  api_key text not null,
  api_secret text not null,
  folder text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  user_id text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_org_id_idx on audit_logs (org_id);
create index if not exists audit_logs_created_at_idx on audit_logs (created_at desc);

create table if not exists waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text not null default 'marketing',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists asset_embeddings (
  org_id text not null,
  public_id text not null,
  content text,
  embedding vector(1536),
  updated_at timestamptz not null default now(),
  primary key (org_id, public_id)
);

create index if not exists asset_embeddings_org_id_idx on asset_embeddings (org_id);
create index if not exists asset_embeddings_embedding_idx
  on asset_embeddings using ivfflat (embedding vector_cosine_ops);

create or replace function match_asset_embeddings(
  query_embedding vector(1536),
  match_count integer,
  org_id text
)
returns table(public_id text, similarity double precision)
language sql stable
as $$
  select asset_embeddings.public_id,
         1 - (asset_embeddings.embedding <=> query_embedding) as similarity
  from asset_embeddings
  where asset_embeddings.org_id = match_asset_embeddings.org_id
  order by asset_embeddings.embedding <=> query_embedding
  limit match_count;
$$;

create table if not exists organization_billing (
  org_id text primary key,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text,
  price_id text,
  current_period_end timestamptz,
  trial_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
