import {
  exchangeAuthorizationCode,
  isChatGptClient,
  isMcpOAuthConfigured,
  refreshMcpTokens,
} from '@/lib/mcp-oauth';

export const runtime = 'nodejs';

function response(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
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

  const form = await request.formData();
  const grantType = String(form.get('grant_type') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const redirectUri = String(form.get('redirect_uri') ?? '');
  if (!isChatGptClient(clientId, redirectUri)) {
    return response({ error: 'invalid_client' }, 401);
  }

  if (grantType === 'authorization_code') {
    const code = String(form.get('code') ?? '');
    const codeVerifier = String(form.get('code_verifier') ?? '');
    const tokens = exchangeAuthorizationCode({ code, codeVerifier, redirectUri });
    return tokens ? response(tokens) : response({ error: 'invalid_grant' }, 400);
  }
  if (grantType === 'refresh_token') {
    const refreshToken = String(form.get('refresh_token') ?? '');
    const tokens = refreshMcpTokens(refreshToken);
    return tokens ? response(tokens) : response({ error: 'invalid_grant' }, 400);
  }

  return response({ error: 'unsupported_grant_type' }, 400);
}
