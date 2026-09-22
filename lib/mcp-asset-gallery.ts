export const ASSET_GALLERY_RESOURCE_URI = 'ui://pixelsky/asset-gallery.html';

// This is intentionally dependency-free so the gallery loads immediately inside ChatGPT.
export const assetGalleryHtml = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    :root { --ink:#101010; --muted:#6b6b6b; --line:#e7e7e7; --soft:#f5f5f5; }
    * { box-sizing:border-box; }
    body { margin:0; background:#fff; color:var(--ink); font:13px/1.45 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .shell { padding:16px; }
    .heading { display:flex; justify-content:space-between; gap:12px; align-items:baseline; margin-bottom:12px; }
    h2 { margin:0; font-size:15px; letter-spacing:-.02em; } .summary { color:var(--muted); font-size:12px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; }
    .card { min-width:0; overflow:hidden; border:1px solid var(--line); border-radius:9px; background:#fff; }
    .image-link { display:block; background:var(--soft); } img { display:block; width:100%; height:210px; object-fit:cover; }
    .body { padding:10px; } .name { overflow:hidden; display:block; font-size:12px; font-weight:650; text-overflow:ellipsis; white-space:nowrap; }
    .tags { display:flex; gap:5px; min-height:24px; margin-top:7px; overflow:hidden; }
    .tag { max-width:100%; overflow:hidden; padding:3px 6px; border-radius:999px; background:var(--soft); color:#555; font-size:10px; text-overflow:ellipsis; white-space:nowrap; }
    .empty { padding:10px 0; color:var(--muted); }
  </style>
</head>
<body>
  <main id="app" class="shell"><p class="empty">Preparing PixelSky previews...</p></main>
  <script>
    const app = document.getElementById('app');
    const tagList = (asset) => [...(asset.visual_tags || []), ...(asset.tags || [])]
      .filter((tag, index, tags) => tag && tags.indexOf(tag) === index).slice(0, 2);
    const linkFor = (asset) => asset.source_url || asset.preview_url;
    function render(result) {
      const assets = result && Array.isArray(result.assets) ? result.assets : [];
      app.replaceChildren();
      if (!assets.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'No previewable assets found.'; app.append(empty); return; }
      const heading = document.createElement('div'); heading.className = 'heading';
      const title = document.createElement('h2'); title.textContent = 'PixelSky results';
      const summary = document.createElement('span'); summary.className = 'summary'; summary.textContent = assets.length + ' visual match' + (assets.length === 1 ? '' : 'es');
      heading.append(title, summary);
      const grid = document.createElement('section'); grid.className = 'grid';
      for (const asset of assets.slice(0, 5)) {
        const card = document.createElement('article'); card.className = 'card';
        const link = document.createElement('a'); link.className = 'image-link'; link.href = linkFor(asset); link.target = '_blank'; link.rel = 'noreferrer'; link.title = 'Open image';
        const image = document.createElement('img'); image.src = asset.preview_url; image.alt = asset.filename || asset.public_id || 'PixelSky asset'; image.loading = 'eager';
        link.append(image);
        const body = document.createElement('div'); body.className = 'body';
        const name = document.createElement('span'); name.className = 'name'; name.textContent = asset.filename || asset.public_id;
        const tags = document.createElement('div'); tags.className = 'tags';
        for (const tag of tagList(asset)) { const chip = document.createElement('span'); chip.className = 'tag'; chip.textContent = tag; tags.append(chip); }
        body.append(name, tags); card.append(link, body); grid.append(card);
      }
      app.append(heading, grid);
    }
    window.addEventListener('message', (event) => {
      const message = event.data || {};
      if (message.method === 'ui/notifications/tool-result') render(message.params && message.params.structuredContent);
      else if (message.structuredContent) render(message.structuredContent);
    });
  </script>
</body>
</html>`;
