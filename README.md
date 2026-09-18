# PixelSky (Light DAM)

For the new agent/Figma use-approval workflow, see `docs/agent-workflow.md`. Its schema is in `supabase/migrations/202609180001_asset_use_requests.sql`; do not deploy the workflow before applying that migration. Figma developer source is in `figma-plugin/`.

PixelSky is a lightweight digital asset manager (Light DAM) designed for small marketing teams
who need a fast, searchable library of images (20-50 assets, not thousands). It uses
Cloudinary as the single source of truth for storage, metadata, previews, and download
links.

## Features

- Natural language search over tags, metadata, and filenames
- Image previews and one-click downloads
- Metadata-driven organization (photographer, usage rights, campaign, asset number)
- Upload UI with metadata form (asset #, campaign, photographer, usage rights)
- Optional AI auto-tagging and AI search mode
- Drag-and-drop + multi-upload support
- AI tag confidence display (when returned by Cloudinary)
- Optional folder scoping for multi-team libraries

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

## Environment Variables

Create a `.env.local` file or configure these in Vercel:

| Variable | Description | Required |
|----------|-------------|----------|
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Yes |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Yes |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Yes |
| `CLOUDINARY_FOLDER` | Optional folder scope for assets | No |
| `CLOUDINARY_AUTO_TAGGING_THRESHOLD` | Auto-tagging confidence (0.1-0.95) | No |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Yes (Milestone 1) |
| `CLERK_SECRET_KEY` | Clerk secret key | Yes (Milestone 1) |
| `NEXT_PUBLIC_GA_ID` | Google Analytics measurement ID | No |
| `SUPABASE_URL` | Supabase project URL | Yes (Milestone 2) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes (Milestone 2) |
| `SUPABASE_ANON_KEY` | Supabase publishable key | No |
| `LIGHT_DAM_ASSET_LIMIT` | Max assets per workspace | No (default: 50) |
| `STRIPE_SECRET_KEY` | Stripe secret key | Yes (Milestone 5) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | Yes (Milestone 5) |
| `STRIPE_PRICE_MONTHLY_ID` | Stripe monthly price ID | Yes (Milestone 5) |
| `STRIPE_PRICE_YEARLY_ID` | Stripe yearly price ID | Optional |
| `STRIPE_COUPON_YEARLY_ID` | Stripe coupon for yearly discount | Optional |
| `STRIPE_TRIAL_DAYS` | Trial length in days | Optional (default 7) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | Yes (Milestone 5) |
| `NEXT_PUBLIC_APP_URL` | Public app URL | Optional |
| `OPENAI_API_KEY` | OpenAI API key | Yes (AI magic) |
| `OPENAI_EMBEDDING_MODEL` | Embedding model | No (default text-embedding-3-small) |

## Authentication (Milestone 1)

PixelSky uses Clerk for authentication and organizations. Create a Clerk app, then set:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/`

Marketing page stays public at `/marketing`.

## Supabase setup (Milestone 2)

Create a `organization_cloudinary` table for BYOC credentials:

```sql
create table if not exists organization_cloudinary (
  org_id text primary key,
  cloud_name text not null,
  api_key text not null,
  api_secret text not null,
  folder text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

Create an `audit_logs` table for activity tracking:

```sql
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  user_id text not null,
  action text not null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists audit_logs_org_id_idx on audit_logs (org_id);
create index if not exists audit_logs_created_at_idx on audit_logs (created_at desc);
```

Create `asset_packs` for the agent-ready review workflow:

```sql
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
```

The same migration is committed at `supabase/migrations/202609170001_asset_packs.sql`.

Create a `waitlist_signups` table for marketing lead capture:

```sql
create table if not exists waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text not null default 'marketing',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

> Note: credentials are stored in Supabase and accessed via the service role key.

## AI search (Milestone 6)

Enable the vector extension and create the embeddings table:

```sql
create extension if not exists vector;

create table if not exists asset_embeddings (
  org_id text not null,
  public_id text not null,
  content text,
  embedding vector(1536),
  updated_at timestamptz default now(),
  primary key (org_id, public_id)
);

create index if not exists asset_embeddings_org_id_idx on asset_embeddings (org_id);
create index if not exists asset_embeddings_embedding_idx on asset_embeddings using ivfflat (embedding vector_cosine_ops);

create or replace function match_asset_embeddings(
  query_embedding vector(1536),
  match_count int,
  org_id text
)
returns table(public_id text, similarity float)
language sql stable
as $$
  select public_id,
         1 - (embedding <=> query_embedding) as similarity
  from asset_embeddings
  where asset_embeddings.org_id = match_asset_embeddings.org_id
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

Visit `/settings/cloudinary` and click **Build AI index** to embed existing assets.

Create an `organization_billing` table for Stripe:

```sql
create table if not exists organization_billing (
  org_id text primary key,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text,
  price_id text,
  current_period_end timestamptz,
  trial_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## Usage limits (Milestone 3)

Set `LIGHT_DAM_ASSET_LIMIT` to cap total assets per workspace. Defaults to 50.

## Audit logs (Milestone 4)

Activity is recorded for search, uploads, downloads, and settings updates.
Visit `/audit` to view the latest events.

## How It Works

1. The UI calls `GET /api/dam/search?q=...`
2. The API queries Cloudinary for the latest assets
3. Results are filtered by the search query (tags, metadata, filenames, IDs)
4. The UI renders previews and download links
5. Uploads go directly to Cloudinary using a signed upload signature (supports larger files).

## Agent-Ready Asset Packs

`/asset-packs` turns a brief into a reviewable draft. Search candidates, select the assets,
and approve the resulting pack before an agent can use it. The durable manifest is available
at `GET /api/asset-packs/:id` after approval.

Current authenticated API primitives:

- `POST /api/dam/search` searches Cloudinary with strict or semantic matching.
- `POST /api/asset-packs` creates a draft from verified workspace asset IDs.
- `GET /api/asset-packs/:id` returns the pack and `pixelsky.asset-pack/v1` JSON manifest.
- `PATCH /api/asset-packs/:id` approves or rejects a draft.

Each pack snapshots delivery URLs, metadata, selected variants, and review state. Cloudinary
remains the media source of truth; PixelSky owns the agent-facing manifest and audit trail.

## Chat App Connections (No Key)

PixelSky can expose one revocable, OAuth-protected MCP endpoint per workspace. This is
the path for non-technical users connecting ChatGPT:

1. A workspace admin opens `/settings/agents`, creates a chat connection, and chooses its permissions.
2. They paste the generated endpoint into the chat client's custom connector setting.
3. Each teammate signs in with their own PixelSky account. PixelSky verifies that person is a member of the selected workspace before any tool is available.
4. A workspace admin can revoke the connection at any time. This immediately blocks every user and client using that endpoint.

The endpoint itself is workspace-bound. OAuth identifies the user; the PixelSky connection
record determines the allowed asset and pack actions. A chat client cannot request extra
PixelSky permissions during sign-in.

### OAuth operator setup

Run `supabase/migrations/202609170003_agent_mcp_connections.sql`, expose
`agent_mcp_connections` through Supabase Data API, and keep RLS enabled.

PixelSky is its own OAuth authorization server for ChatGPT and uses the existing Clerk
session only to identify the person approving access. It accepts ChatGPT's fixed callback
URI and enforces S256 PKCE, so Clerk OAuth DCR and `PIXELSKY_OAUTH_ISSUER` are not
required for this integration. Keep Clerk DCR disabled unless another integration needs it.

## Remote MCP For Technical Clients

PixelSky exposes a remote MCP endpoint at:

```text
https://light-dam-v1.vercel.app/api/mcp
```

Run `supabase/migrations/202609170002_agent_api_keys.sql`, expose the `agent_api_keys`
table through Supabase Data API, and keep RLS enabled. A workspace admin can then create a
scoped bearer key at `/settings/agents`. The plaintext key is displayed once only; PixelSky
stores a SHA-256 hash.

The endpoint supports clients that allow a static `Authorization: Bearer psk_live_...` header.
It currently provides these tools according to the key's scopes:

- `search_assets` returns previews, source URLs, and direct Cloudinary attachment download URLs.
- `create_asset_pack_draft` validates selected asset IDs against the workspace and creates a draft.
- `list_approved_asset_packs` and `get_approved_asset_pack` return only approved manifests.
- `approve_asset_pack` is available only with the explicit `asset_packs:approve` scope and is audit logged.

Default keys can search, read approved packs, and create drafts. Add `asset_packs:approve` only
to a deliberately trusted agent connection. Static keys remain available for technical MCP
clients that cannot launch a browser OAuth sign-in.

## Metadata Conventions

PixelSky reads metadata from either Cloudinary **context** or **structured metadata**.
Populate any of these fields to power searching and UI labels:

- `asset_id` (for image number searches)
- `photographer`
- `usage_rights`
- `campaign`
- `description` / `caption`

### Example: Uploading with Context

```bash
curl -X POST \
  -F file=@hero.jpg \
  -F upload_preset=your_preset \
  -F context="asset_id=1234|photographer=Alex Rivera|usage_rights=Global paid social|campaign=Spring Launch" \
  "https://api.cloudinary.com/v1_1/<cloud-name>/image/upload"
```

## Search Tips

- Search by image number: `image #1234`
- Search by photographer: `photographer Alex`
- Search by campaign name or tag: `spring launch`
- Toggle **AI search** for broader semantic matches (uses tags + metadata)

> Note: AI auto-tagging requires the Cloudinary Auto-Tagging add-on.

## Deployment

Deploy to Vercel as a standard Next.js app. Add the Cloudinary environment variables
in Project Settings.

## Replit

This repo can be imported into Replit directly from GitHub.

1. Import `EditorialOS/Pixel-Sky`.
2. Set the environment variables from the table above in Replit Secrets.
3. Run the project with `npm run dev`.
4. If Replit prompts for a package install, use the committed `package-lock.json` so the dependency tree stays stable.

## Launch Readiness Checklist

Use this checklist before selling publicly:

1. Set production auth keys in Vercel (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) and verify they are not Clerk dev/test keys.
2. Run Supabase migrations for `organization_cloudinary`, `audit_logs`, `asset_packs`, `asset_embeddings`, `organization_billing`, `waitlist_signups`, `agent_api_keys`, and `agent_mcp_connections`; expose the required tables and `match_asset_embeddings` through Supabase Data API with RLS enabled.
3. Configure Stripe live mode keys, create live prices, and register `/api/stripe/webhook`.
4. Connect a Cloudinary account, upload test assets, and run **Build AI index** in `/settings/cloudinary`.
5. Verify these flows end-to-end:
   - sign up/sign in
   - semantic search and strict search
   - upload + download + variant generation
   - checkout + webhook status updates
   - OAuth chat connection: create, sign in as a workspace member, search assets, revoke, and confirm access is removed
   - `/audit` event visibility
   - `/asset-packs` draft, approval, and JSON manifest flows
   - `/settings/agents` key creation, revocation, MCP search, draft creation, explicit agent approval, and attachment download links
   - `/marketing` waitlist submissions
