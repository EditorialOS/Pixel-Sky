# PixelSky Figma Community submission

## Public listing

- **Name:** PixelSky
- **Tagline:** Search your Cloudinary library and place the right image in Figma.
- **Category:** Productivity
- **Support:** `https://light-dam-v1.vercel.app/support`
- **Privacy:** `https://light-dam-v1.vercel.app/legal/privacy`
- **Logo:** `public/pixelsky-logo-512.png`

## Description

PixelSky connects a Figma file to your team's existing Cloudinary library. Search by visual intent or metadata, inspect large previews, then place an image into the selected Figma shape or a new rectangle. Download opens a Cloudinary delivery link when a source file is needed outside Figma.

PixelSky does not copy your library into another DAM. Cloudinary remains the source of truth; PixelSky provides agent-readable search and workspace-scoped delivery.

## Network access

- `https://light-dam-v1.vercel.app`: pairing, search, and delivery.
- `https://res.cloudinary.com`: previews, image placement, and downloads.

## Publisher steps

1. In Figma Desktop, create a new plugin for PixelSky or choose Publish from the imported development plugin.
2. Use the Figma-assigned plugin ID to replace `000000000000000000` in `figma-plugin/manifest.json`.
3. Test Connect, search, Place, and Download from the final publisher-owned manifest.
4. Upload the logo, listing copy, and screenshots, then submit to Community review.

The plugin source is complete. Figma assigns the production ID through the publisher account, so it must not be invented or reused from another plugin.
