const API = 'https://light-dam-v1.vercel.app';
const TOKEN_KEY = 'pixelsky_token';
const EXPIRY_KEY = 'pixelsky_token_expiry';

figma.showUI(__html__, { width: 480, height: 720, themeColors: false });

function send(type, data) {
  figma.ui.postMessage({ type, ...data });
}

async function token() {
  const expiry = await figma.clientStorage.getAsync(EXPIRY_KEY);
  if (!expiry || new Date(expiry).getTime() <= Date.now()) return null;
  return await figma.clientStorage.getAsync(TOKEN_KEY);
}

async function api(path, options = {}) {
  const currentToken = await token();
  if (!currentToken) throw new Error('Connect PixelSky first.');
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${currentToken}`, ...(options.headers || {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'PixelSky request failed.');
  return body;
}

async function connect() {
  const response = await fetch(`${API}/api/figma/pair/start`, { method: 'POST' });
  const pairing = await response.json();
  if (!response.ok) throw new Error(pairing.error || 'Could not start connection.');
  figma.openExternal(pairing.connect_url);
  send('PAIRING', { message: 'Approve the connection in your browser, then return here.' });
  const deadline = new Date(pairing.expires_at).getTime();
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const claimResponse = await fetch(`${API}/api/figma/pair/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pairing.id, secret: pairing.secret }),
    });
    const result = await claimResponse.json();
    if (!claimResponse.ok) throw new Error(result.error || 'Pairing failed.');
    if (result.status === 'connected') {
      await figma.clientStorage.setAsync(TOKEN_KEY, result.token);
      await figma.clientStorage.setAsync(EXPIRY_KEY, result.expires_at);
      send('CONNECTED', { message: 'Connected to PixelSky.' });
      return;
    }
  }
  throw new Error('Pairing expired. Try Connect again.');
}

async function deliveryFor(publicId) {
  return api(`/api/figma/assets/delivery?public_id=${encodeURIComponent(publicId)}`);
}

async function place(publicId) {
  const delivery = await deliveryFor(publicId);
  const image = await figma.createImageAsync(delivery.figma_image_url);
  const selection = figma.currentPage.selection;
  let node;
  if (selection.length === 1 && 'fills' in selection[0]) {
    node = selection[0];
  } else {
    node = figma.createRectangle();
    const size = await image.getSizeAsync();
    node.resize(size.width, size.height);
    node.x = figma.viewport.center.x - size.width / 2;
    node.y = figma.viewport.center.y - size.height / 2;
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
  }
  node.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
  node.setPluginData('pixelsky_public_id', delivery.public_id);
  send('PLACED', { message: `Placed ${delivery.filename}.` });
}

async function download(publicId) {
  const delivery = await deliveryFor(publicId);
  figma.openExternal(delivery.download_url);
  send('DOWNLOADED', { message: `Opening download for ${delivery.filename}.` });
}

figma.ui.onmessage = async (message) => {
  try {
    switch (message.type) {
      case 'CONNECT':
        await connect();
        break;
      case 'DISCONNECT':
        await api('/api/figma/disconnect', { method: 'POST' });
        await figma.clientStorage.deleteAsync(TOKEN_KEY);
        await figma.clientStorage.deleteAsync(EXPIRY_KEY);
        send('DISCONNECTED', {});
        break;
      case 'SEARCH': {
        const query = encodeURIComponent(message.query || '');
        const body = await api(`/api/figma/search?q=${query}`);
        send('RESULTS', { assets: body.assets || [], outsideScopeMatches: body.outside_scope_matches || 0 });
        break;
      }
      case 'PLACE':
        await place(message.publicId);
        break;
      case 'DOWNLOAD':
        await download(message.publicId);
        break;
    }
  } catch (error) {
    send('ERROR', { message: error instanceof Error ? error.message : 'PixelSky request failed.' });
  }
};

token().then(async (current) => {
  send('STATE', { connected: Boolean(current) });
}).catch((error) => send('ERROR', { message: error.message }));
