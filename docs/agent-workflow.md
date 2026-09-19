# PixelSky agent workflow

PixelSky uses Cloudinary for storage and metadata. PixelSky is the control point for a proposed use: an agent or designer finds candidates, requests an explicit use, a workspace admin reviews it, and only then does the integration return delivery links.

## Day in the life

1. A team connects one Cloudinary product environment at `/settings/cloudinary`. An optional workspace folder restricts the visible library. PixelSky describes and indexes the visible content so natural-language search does not depend on manually maintained tags.
2. An admin creates a new ChatGPT connection at `/settings/agents` with `Search assets`, `Request asset use`, and `Read approved uses and delivery links`. Each teammate signs in with their own PixelSky account when connecting ChatGPT. Do not reuse an older connection if it lacks the new permissions.
3. A user asks an agent to find images for any job: a landing page, social post, client deck, or newsletter. The agent calls `search_assets` and receives candidate metadata and previews, not source or download links.
4. The agent calls `request_asset_use` with one asset and the channel, campaign, placement, region, and purpose. This creates a pending request. It cannot self-approve through this workflow.
5. A workspace admin reviews the image, Cloudinary rights and credit metadata, and proposed use at `/asset-uses`, then approves or rejects it. Approval defaults to 30 days and can be revoked.
6. The agent calls `get_asset_delivery`. PixelSky rechecks the approval, expiry, workspace folder, Cloudinary asset ID, and version before returning a versioned image URL and download URL. Delivery is audit-logged.

The Figma plugin uses the same request and approval records. It can fill the selected shape or create an image rectangle, but only after approval.

## Live setup

1. Apply `supabase/migrations/202609180001_asset_use_requests.sql` and `supabase/migrations/202609190001_visual_asset_index.sql` to the PixelSky Supabase project before deploying routes that use them.
2. Deploy the Next.js app with the existing Clerk, Supabase, and Cloudinary configuration. Set `PIXELSKY_ASSET_USES_ENABLED=true` and `NEXT_PUBLIC_PIXELSKY_ASSET_USES_ENABLED=true` only after the migration and a smoke test. Without those flags, the new workflow stays hidden while the search fix can deploy safely. No Cloudinary credential should be placed in the Figma plugin or a ChatGPT prompt.
3. In `/settings/agents`, create a **new** connection with the three permissions above and install its endpoint in ChatGPT. Existing connections retain their prior, narrower scopes.
4. Search for a known Cloudinary tag, request one use, approve it in `/asset-uses`, and call `get_asset_delivery`. Check `/audit` for search, request, approval, and delivery events.
5. For Figma developer testing, follow `figma-plugin/README.md`. A public one-click Figma installation requires assigning a real Figma plugin ID and publishing through Figma.

## Current boundaries

- This is a workflow gate for agent and Figma integrations, not digital-rights DRM. A public Cloudinary URL that someone already knows remains accessible after PixelSky revokes a use. For hard revocation or private media, use Cloudinary authenticated/private delivery with appropriate signed access.
- Signed-in web DAM members can still use the original direct-download path. The new approval gate applies to the agent and Figma delivery APIs. Admins should treat legacy web downloads as source-library access.
- Cloudinary `usage_rights` and `credit` are free-text metadata. PixelSky shows them for human review but cannot verify a legal license automatically.
- Search scans at most 5,000 images in a connected product environment and fails explicitly rather than silently returning incomplete results beyond that limit. This is an initial light-DAM limit, not a large-enterprise search architecture.
- Figma pairing issues a limited 30-day token, stored in Figma client storage and revocable from `/settings/agents`. The plugin does not receive Cloudinary API credentials.
