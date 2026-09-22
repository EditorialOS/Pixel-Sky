# PixelSky Figma plugin (developer build)

The plugin searches the connected PixelSky library and lets a designer place or download a workspace-scoped Cloudinary image directly.

This directory is source for a Figma developer plugin, **not a published Community plugin yet**. The `manifest.json` ID is a placeholder. To test it, create a development plugin in Figma, use the ID Figma assigns, and point its manifest to this directory's `code.js` and `ui.html`. The manifest must allow `light-dam-v1.vercel.app` and `res.cloudinary.com` network access.

1. Open the plugin in a Figma design file and choose **Connect PixelSky**.
2. A browser opens PixelSky. Sign in, select the desired workspace, and approve the connection.
3. Return to Figma and search a tag, campaign, or visual description.
4. Choose **Place** to replace one selected fillable shape or create a new image rectangle. Choose **Download** to open a Cloudinary download in the browser.

The plugin stores a 30-day, read-only PixelSky key in Figma client storage. It is limited to the connected workspace and its configured Cloudinary folder. **Disconnect** revokes the key server-side. Admins can also revoke it at `https://light-dam-v1.vercel.app/settings/agents`.

Figma plugin documentation: [manifest](https://developers.figma.com/docs/plugins/manifest/), [network requests](https://developers.figma.com/docs/plugins/making-network-requests/), [image placement](https://developers.figma.com/docs/plugins/api/properties/figma-createimageasync/).
