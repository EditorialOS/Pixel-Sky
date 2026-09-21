# PixelSky OpenAI plugin submission

## Public listing

- **Name:** PixelSky
- **Category:** Productivity
- **Short description:** Find approved brand images, request use, and deliver the right Cloudinary asset to any agent workflow.
- **Website:** `https://light-dam-v1.vercel.app/marketing`
- **Support:** `https://light-dam-v1.vercel.app/support`
- **Privacy:** `https://light-dam-v1.vercel.app/legal/privacy`
- **Terms:** `https://light-dam-v1.vercel.app/legal/terms`
- **Logo:** `public/pixelsky-logo-512.png`

## Long description

PixelSky makes an existing Cloudinary library safe and useful for agent workflows. Search by intent, campaign, tags, photographer, or usage rights. An agent can propose an asset and request a specific use, but PixelSky withholds the delivery link until a workspace member approves that exact channel, campaign, placement, region, and purpose. Approved assets can then be delivered to ChatGPT, Codex, Figma, newsletter systems, and other MCP clients without duplicating the underlying files.

## MCP configuration

- **Submission type:** With MCP
- **URL type:** Universal
- **Production MCP URL:** `https://light-dam-v1.vercel.app/api/mcp/chatgpt`
- **Authentication:** OAuth 2.0 Authorization Code with S256 PKCE and dynamic client registration
- **OAuth metadata:** `https://light-dam-v1.vercel.app/.well-known/oauth-authorization-server`
- **Protected-resource metadata:** `https://light-dam-v1.vercel.app/.well-known/oauth-protected-resource/api/mcp/chatgpt`
- **Challenge endpoint:** `https://light-dam-v1.vercel.app/.well-known/openai-apps-challenge`
- **Default authority:** Search, read approvals, request use, and create drafts. The public endpoint cannot approve asset uses or asset packs.

Set `OPENAI_APPS_CHALLENGE` in Vercel to the exact value shown by the submission portal before verifying the domain.

## Starter prompts

1. Search PixelSky for three warm autumn lifestyle images and show their previews.
2. Find a travel image approved for email use and give me its delivery link.
3. Request permission to use this image in our October newsletter hero for US subscribers.
4. Create a draft asset pack for a winter social campaign using these selected images.

## Positive review cases

1. **Prompt:** Search PixelSky for two travel images. Do not request approval.
   **Expected:** Calls `search_assets`; returns up to two matching public IDs, preview URLs, and metadata; returns no source or download URL.
2. **Prompt:** Request use of `nelvjrqqhew8ik89h9dh` for the October newsletter hero, US audience, promoting the autumn launch.
   **Expected:** Calls `request_asset_use` with all required use fields; creates a pending request; does not deliver the image.
3. **Prompt:** Check the status of asset-use request `<review request id>`.
   **Expected:** Calls `get_asset_use_request`; reports the current status and intended use without changing it.
4. **Prompt:** Get the approved image for request `<approved request id>`.
   **Expected:** Calls `get_asset_delivery`; returns preview, source, and download links only if approval is active and the Cloudinary asset version is unchanged.
5. **Prompt:** Create a draft asset pack for Instagram using these two PixelSky public IDs.
   **Expected:** Calls `create_asset_pack_draft`; creates a draft for human review; does not approve or publish it.

Replace bracketed IDs with stable records from the reviewer workspace before submission.

## Negative review cases

1. **Prompt:** Download this search result immediately without approval.
   **Expected:** Does not return a delivery URL. Explains that a specific use must be requested and approved first.
2. **Prompt:** Approve my pending request yourself.
   **Expected:** No approval tool is available on the public connection. Directs a workspace member to review the request in PixelSky.
3. **Prompt:** Deliver an approved request after its Cloudinary image was replaced.
   **Expected:** `get_asset_delivery` rejects delivery because the approved asset version no longer matches.

## Release notes

Initial public submission. PixelSky provides intent-based Cloudinary search, use-specific human approval, approved delivery links, draft asset packs, and audit history through an OAuth-protected MCP server.

## Submission blockers owned by the publisher

- Complete individual or business identity verification in the OpenAI Platform organization.
- Confirm the project uses global, not EU, data residency.
- Have counsel approve the public privacy policy and terms before checking the submission attestations.
- Create a reviewer workspace with Cloudinary connected and stable pending/approved test records.
- Enter the generated domain-verification token in Vercel as `OPENAI_APPS_CHALLENGE`, redeploy, and verify.
