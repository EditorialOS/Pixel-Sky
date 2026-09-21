import {
  chatGptClientRegistration,
  isChatGptRedirectUri,
  isMcpOAuthConfigured,
} from '@/lib/mcp-oauth';

export const runtime = 'nodejs';

function response(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function OPTIONS() {
  return response(null, 204);
}

export async function POST(request: Request) {
  if (!isMcpOAuthConfigured()) {
    return response({ error: 'server_error', error_description: 'PixelSky OAuth is not configured yet.' }, 503);
  }

  let payload: { redirect_uris?: unknown };
  try {
    payload = await request.json();
  } catch {
    return response({ error: 'invalid_client_metadata', error_description: 'A JSON registration payload is required.' }, 400);
  }

  const redirectUris = Array.isArray(payload.redirect_uris) ? payload.redirect_uris : [];
  const redirectUri = typeof redirectUris[0] === 'string' ? redirectUris[0] : '';
  if (redirectUris.length !== 1 || !isChatGptRedirectUri(redirectUri)) {
    return response({ error: 'invalid_redirect_uri', error_description: 'PixelSky currently accepts ChatGPT custom-app callbacks only.' }, 400);
  }

  return response(chatGptClientRegistration(redirectUri), 201);
}
