import { AgentPrincipal, authenticateAgentApiKey } from '@/lib/agent-keys';
import { handleAuthenticatedMcp, withMcpCors } from '@/lib/mcp-handler';

export const runtime = 'nodejs';

function unauthorizedResponse() {
  return withMcpCors(new Response(JSON.stringify({ error: 'A valid PixelSky agent key is required.' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': 'Bearer realm="PixelSky MCP"',
    },
  }));
}

async function handleMcp(request: Request) {
  let principal: AgentPrincipal | null;
  try {
    principal = await authenticateAgentApiKey(request);
  } catch (error) {
    console.error('MCP agent authentication error:', error);
    return withMcpCors(new Response(JSON.stringify({ error: 'Agent authentication is temporarily unavailable.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }));
  }
  if (!principal) return unauthorizedResponse();

  return handleAuthenticatedMcp(request, principal);
}

export async function OPTIONS() {
  return withMcpCors(new Response(null, { status: 204 }));
}

export async function POST(request: Request) {
  return handleMcp(request);
}

export async function GET(request: Request) {
  return handleMcp(request);
}

export async function DELETE(request: Request) {
  return handleMcp(request);
}
