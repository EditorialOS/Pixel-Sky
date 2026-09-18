# PixelSky Figma plugin (developer build)

The plugin searches the connected PixelSky library, requests permission for a specific use, and places an approved image in Figma. It cannot approve images.

This directory is source for a Figma developer plugin, **not a published Community plugin yet**. The `manifest.json` ID is a placeholder. To test it, create a development plugin in Figma, use the ID Figma assigns, and point its manifest to this directory's `code.js` and `ui.html`. The manifest must allow `light-dam-v1.vercel.app` and `res.cloudinary.com` network access.

1. Open the plugin in a Figma design file and choose **Connect PixelSky**.
2. A browser opens PixelSky. Sign in, select the desired workspace, and approve the connection.
3. Return to Figma. Search a tag or campaign, choose an image, and enter the channel, campaign, placement, region, and purpose.
4. A workspace admin approves the request at `https://light-dam-v1.vercel.app/asset-uses`.
5. Refresh requests in Figma, then choose **Place in Figma**. If one fillable shape is selected, its fill is replaced. Otherwise the plugin creates a new rectangle.

The plugin stores a 30-day, limited PixelSky key in Figma client storage. **Disconnect** revokes the key server-side. Admins can also revoke it at `https://light-dam-v1.vercel.app/settings/agents`.

Figma plugin documentation: [manifest](https://developers.figma.com/docs/plugins/manifest/), [network requests](https://developers.figma.com/docs/plugins/making-network-requests/), [image placement](https://developers.figma.com/docs/plugins/api/properties/figma-createimageasync/).
