import { NextResponse } from 'next/server';
import { getActiveAgentConnection } from '@/lib/agent-connections';
import {
  createAuthorizationCode,
  currentOAuthIdentity,
  hasWorkspaceMembership,
  isChatGptClient,
  isMcpOAuthConfigured,
  mcpOAuthResource,
  requestedScope,
} from '@/lib/mcp-oauth';

export const runtime = 'nodejs';

function errorResponse(request: Request, message: string, status = 400) {
  return NextResponse.json({ error: 'invalid_request', error_description: message }, { status });
}

export async function GET(request: Request) {
  if (!isMcpOAuthConfigured()) return errorResponse(request, 'PixelSky OAuth is not configured.', 503);

  const url = new URL(request.url);
  const clientId = url.searchParams.get('client_id') ?? '';
  const redirectUri = url.searchParams.get('redirect_uri') ?? '';
  const responseType = url.searchParams.get('response_type');
  const codeChallenge = url.searchParams.get('code_challenge');
  const codeChallengeMethod = url.searchParams.get('code_challenge_method');
  const resource = mcpOAuthResource(url.searchParams.get('resource'), request);

  if (!isChatGptClient(clientId, redirectUri)) {
    return errorResponse(request, 'This OAuth client is not registered for PixelSky.', 400);
  }
  if (responseType !== 'code' || !codeChallenge || codeChallengeMethod !== 'S256') {
    return errorResponse(request, 'PixelSky requires Authorization Code flow with S256 PKCE.', 400);
  }
  if (!resource) {
    return errorResponse(request, 'The PixelSky MCP resource is missing from the authorization request.', 400);
  }

  const { userId, orgId } = await currentOAuthIdentity();
  if (!userId) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect_url', request.url);
    return NextResponse.redirect(signInUrl);
  }

  let authorizedOrgId = orgId ?? undefined;
  if (resource.kind === 'connection') {
    const connection = await getActiveAgentConnection(resource.connectionId);
    if (!connection) return errorResponse(request, 'This PixelSky workspace connection was not found or was revoked.', 404);
    authorizedOrgId = connection.org_id;
  } else if (!authorizedOrgId) {
    return errorResponse(request, 'Select or create a PixelSky workspace, then connect ChatGPT again.', 403);
  }

  if (!authorizedOrgId || !(await hasWorkspaceMembership(userId, authorizedOrgId))) {
    return errorResponse(request, 'Your PixelSky account is not a member of this workspace.', 403);
  }

  const callback = new URL(redirectUri);
  callback.searchParams.set('code', createAuthorizationCode({
    resource,
    userId,
    orgId: authorizedOrgId,
    redirectUri,
    codeChallenge,
    scope: requestedScope(url.searchParams.get('scope')),
  }));
  const state = url.searchParams.get('state');
  if (state) callback.searchParams.set('state', state);
  return NextResponse.redirect(callback);
}
