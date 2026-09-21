import { getActiveAgentConnection } from '@/lib/agent-connections';
import { getMcpOAuthIssuer } from '@/lib/mcp-oauth';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ connectionId: string }>;
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export async function OPTIONS() {
  return response(null, 204);
}

export async function GET(request: Request, context: RouteContext) {
  const { connectionId } = await context.params;
  if (connectionId !== 'chatgpt') {
    try {
      const connection = await getActiveAgentConnection(connectionId);
      if (!connection) return response({ error: 'Chat connection not found.' }, 404);
    } catch (error) {
      console.error('OAuth metadata connection lookup error:', error);
      return response({ error: 'Chat connection lookup is temporarily unavailable.' }, 503);
    }
  }

  const resource = new URL(`/api/mcp/${connectionId}`, request.url).toString();
  return response({
    resource,
    authorization_servers: [getMcpOAuthIssuer(request)],
    resource_name: 'PixelSky',
    resource_documentation: new URL('/settings/agents', request.url).toString(),
  });
}
