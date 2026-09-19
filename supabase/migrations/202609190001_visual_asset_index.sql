alter table asset_embeddings
  add column if not exists asset_id text,
  add column if not exists asset_version bigint,
  add column if not exists visual_description text,
  add column if not exists visual_tags text[] not null default '{}',
  add column if not exists status text not null default 'pending',
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_error text,
  add column if not exists indexed_at timestamptz;

update asset_embeddings
set status = 'complete', indexed_at = coalesce(indexed_at, updated_at)
where embedding is not null and status = 'pending';

alter table asset_embeddings
  drop constraint if exists asset_embeddings_status_check;

alter table asset_embeddings
  add constraint asset_embeddings_status_check
  check (status in ('pending', 'complete', 'failed'));

create index if not exists asset_embeddings_org_status_idx
  on asset_embeddings (org_id, status);

alter table asset_embeddings enable row level security;

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
    and asset_embeddings.status = 'complete'
    and asset_embeddings.embedding is not null
  order by asset_embeddings.embedding <=> query_embedding
  limit match_count;
$$;
