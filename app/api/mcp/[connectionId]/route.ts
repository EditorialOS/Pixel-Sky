import { getActiveAgentConnection } from '@/lib/agent-connections';
import { handleAuthenticatedMcp, withMcpCors } from '@/lib/mcp-handler';
import { authenticateMcpOAuthConnection, isMcpOAuthConfigured } from '@/lib/mcp-oauth';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ connectionId: string }>;
};

function oauthUnauthorizedResponse(request: Request, connectionId: string) {
  const resourceMetadata = new URL(
    `/.well-known/oauth-protected-resource/api/mcp/${connectionId}`,
    request.url,
  ).toString();
  return withMcpCors(new Response(JSON.stringify({ error: 'Sign in with PixelSky to use this chat connection.' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadata}"`,
    },
  }));
}

async function handleMcp(request: Request, context: RouteContext) {
  const { connectionId } = await context.params;
  if (!isMcpOAuthConfigured()) {
    return withMcpCors(new Response(JSON.stringify({ error: 'PixelSky OAuth is not configured yet.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }));
  }

  let connection;
  try {
    connection = await getActiveAgentConnection(connectionId);
  } catch (error) {
    console.error('MCP connection lookup error:', error);
    return withMcpCors(new Response(JSON.stringify({ error: 'Chat connection lookup is temporarily unavailable.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }));
  }
  if (!connection) {
    return withMcpCors(new Response(JSON.stringify({ error: 'This chat connection was not found or has been revoked.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    }));
  }

  try {
    const principal = await authenticateMcpOAuthConnection(request, connection);
    if (!principal) return oauthUnauthorizedResponse(request, connectionId);
    return handleAuthenticatedMcp(request, principal);
  } catch (error) {
    console.error('MCP OAuth authentication error:', error);
    return withMcpCors(new Response(JSON.stringify({ error: 'Chat authentication is temporarily unavailable.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }));
  }
}

export async function OPTIONS() {
  return withMcpCors(new Response(null, { status: 204 }));
}

export async function POST(request: Request, context: RouteContext) {
  return handleMcp(request, context);
}

export async function GET(request: Request, context: RouteContext) {
  return handleMcp(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return handleMcp(request, context);
}
