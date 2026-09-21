# PixelSky Figma Community submission

## Public listing

- **Name:** PixelSky
- **Tagline:** Find the right Cloudinary image, request approved use, and place it in Figma.
- **Category:** Productivity
- **Support:** `https://light-dam-v1.vercel.app/support`
- **Privacy:** `https://light-dam-v1.vercel.app/legal/privacy`
- **Logo:** `public/pixelsky-logo-512.png`

## Description

PixelSky connects a Figma file to your team's existing Cloudinary library. Search by visual intent or metadata, choose an image, and request permission for a specific campaign, placement, audience, and purpose. Once a workspace member approves the request in PixelSky, refresh the plugin and place the approved image into the selected Figma shape or a new rectangle.

PixelSky does not copy your library into another DAM and the plugin cannot approve its own requests. Cloudinary remains the source of truth; PixelSky provides agent-readable search, approval history, and controlled delivery.

## Network access

- `https://light-dam-v1.vercel.app`: pairing, search, use requests, approval status, and delivery.
- `https://res.cloudinary.com`: approved previews and image placement.

## Publisher steps

1. In Figma Desktop, create a new plugin for PixelSky or choose Publish from the imported development plugin.
2. Use the Figma-assigned plugin ID to replace `000000000000000000` in `figma-plugin/manifest.json`.
3. Test Connect, search, request, refresh, and Place in Figma from the final publisher-owned manifest.
4. Upload the logo, listing copy, and screenshots, then submit to Community review.

The plugin source is complete. Figma assigns the production ID through the publisher account, so it must not be invented or reused from another plugin.
