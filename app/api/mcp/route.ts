import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  AgentPrincipal,
  hasAgentScope,
  authenticateAgentApiKey,
} from '@/lib/agent-keys';
import {
  approveAgentAssetPack,
  createAgentAssetPackDraft,
  getApprovedAssetPack,
  listApprovedAssetPacks,
} from '@/lib/agent-asset-packs';
import { logAuditEvent } from '@/lib/audit';
import { searchDamAssets } from '@/lib/dam-search';

export const runtime = 'nodejs';

function toolResult(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : 'The request could not be completed.';
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

function createServer(principal: AgentPrincipal) {
  const server = new McpServer({
    name: 'pixelsky',
    version: '1.0.0',
  });

  if (hasAgentScope(principal, 'assets:read')) {
    server.registerTool(
      'search_assets',
      {
        title: 'Search PixelSky assets',
        description: 'Search this workspace\'s connected Cloudinary image library. Results include previews, direct source URLs, and direct attachment download URLs that can be shared with the user.',
        inputSchema: z.object({
          query: z.string().max(500).describe('Natural-language asset query.'),
          mode: z.enum(['strict', 'semantic']).optional().describe('Use semantic when the workspace has an AI index; strict is the reliable metadata search fallback.'),
          limit: z.number().int().min(1).max(100).optional().describe('Maximum number of assets to return.'),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ query, mode, limit }) => {
        try {
          const result = await searchDamAssets(principal.orgId, { query, mode, limit });
          if (query.trim()) {
            try {
              await logAuditEvent({
                orgId: principal.orgId,
                userId: `agent:${principal.id}`,
                action: 'agent_mcp_search',
                details: {
                  agentKeyId: principal.id,
                  agentName: principal.name,
                  query: result.query,
                  mode: result.mode,
                  total: result.total,
                  returned: result.assets.length,
                  fallback: result.ai_fallback,
                },
              });
            } catch (auditError) {
              console.error('Agent MCP search audit error:', auditError);
            }
          }
          return toolResult(result);
        } catch (error) {
          return toolError(error);
        }
      },
    );
  }

  if (hasAgentScope(principal, 'asset_packs:read')) {
    server.registerTool(
      'list_approved_asset_packs',
      {
        title: 'List approved PixelSky asset packs',
        description: 'List human-approved asset pack manifests. Draft and rejected packs are never returned to agents.',
        inputSchema: z.object({
          limit: z.number().int().min(1).max(100).optional(),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ limit }) => {
        try {
          return toolResult({ packs: await listApprovedAssetPacks(principal.orgId, limit) });
        } catch (error) {
          return toolError(error);
        }
      },
    );

    server.registerTool(
      'get_approved_asset_pack',
      {
        title: 'Get an approved PixelSky asset pack',
        description: 'Get one human-approved asset pack manifest, including stable source and delivery URLs. Draft and rejected packs are inaccessible.',
        inputSchema: z.object({
          id: z.string().uuid().describe('PixelSky asset pack ID.'),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ id }) => {
        try {
          return toolResult(await getApprovedAssetPack(principal.orgId, id));
        } catch (error) {
          return toolError(error);
        }
      },
    );
  }

  if (hasAgentScope(principal, 'asset_packs:write')) {
    server.registerTool(
      'create_asset_pack_draft',
      {
        title: 'Create a PixelSky asset pack draft',
        description: 'Create a draft asset pack from verified assets in this workspace. Use approve_asset_pack only when this connection has the separate approval permission.',
        inputSchema: z.object({
          title: z.string().max(140).optional(),
          brief: z.string().min(1).max(2_000).describe('Campaign or usage brief for the pack.'),
          channels: z.array(z.string().max(80)).max(12).optional(),
          notes: z.string().max(2_000).optional(),
          assets: z.array(z.object({
            public_id: z.string().min(1).max(512),
            rationale: z.string().max(600).optional(),
            variants: z.array(z.enum([
              'instagram_square',
              'instagram_portrait',
              'pinterest_standard',
              'pinterest_long',
              'pinterest_square',
              'banner',
            ])).max(6).optional(),
          })).min(1).max(20),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      async (payload) => {
        try {
          return toolResult(await createAgentAssetPackDraft({
            orgId: principal.orgId,
            actorId: `agent:${principal.id}`,
            agentKeyId: principal.id,
            payload,
          }));
        } catch (error) {
          return toolError(error);
        }
      },
    );
  }

  if (hasAgentScope(principal, 'asset_packs:approve')) {
    server.registerTool(
      'approve_asset_pack',
      {
        title: 'Approve a PixelSky asset pack',
        description: 'Approve one draft asset pack. This publishes its manifest to agents with asset_packs:read access. This action is audited as an agent approval.',
        inputSchema: z.object({
          id: z.string().uuid().describe('Draft PixelSky asset pack ID.'),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      async ({ id }) => {
        try {
          return toolResult(await approveAgentAssetPack({
            orgId: principal.orgId,
            actorId: `agent:${principal.id}`,
            agentKeyId: principal.id,
            id,
          }));
        } catch (error) {
          return toolError(error);
        }
      },
    );
  }

  return server;
}

function withCors(response: Response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID',
  );
  headers.set('Access-Control-Expose-Headers', 'MCP-Protocol-Version, MCP-Session-Id');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function unauthorizedResponse() {
  return withCors(new Response(JSON.stringify({ error: 'A valid PixelSky agent key is required.' }), {
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
    return withCors(new Response(JSON.stringify({ error: 'Agent authentication is temporarily unavailable.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }));
  }
  if (!principal) return unauthorizedResponse();

  const handler = createMcpHandler(() => createServer(principal), {
    responseMode: 'json',
  });
  try {
    return withCors(await handler.fetch(request));
  } finally {
    await handler.close();
  }
}

export async function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
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
