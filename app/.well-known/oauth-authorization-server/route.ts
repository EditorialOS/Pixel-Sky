import { getMcpOAuthIssuer, isMcpOAuthConfigured } from '@/lib/mcp-oauth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isMcpOAuthConfigured()) {
    return Response.json({ error: 'PixelSky OAuth is not configured yet.' }, { status: 503 });
  }

  const issuer = getMcpOAuthIssuer(request);
  return Response.json({
    authorization_endpoint: `${issuer}/api/mcp/oauth/authorize`,
    code_challenge_methods_supported: ['S256'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    issuer,
    registration_endpoint: `${issuer}/api/mcp/oauth/register`,
    response_types_supported: ['code'],
    scopes_supported: ['offline_access'],
    token_endpoint: `${issuer}/api/mcp/oauth/token`,
    token_endpoint_auth_methods_supported: ['none'],
  }, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
