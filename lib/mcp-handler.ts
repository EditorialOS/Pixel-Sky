import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { AgentPrincipal, hasAgentScope } from '@/lib/agent-keys';
import {
  approveAgentAssetPack,
  createAgentAssetPackDraft,
  getApprovedAssetPack,
  listApprovedAssetPacks,
} from '@/lib/agent-asset-packs';
import { logAuditEvent } from '@/lib/audit';
import { agentAssetUseRequest, agentCandidate } from '@/lib/agent-output';
import {
  createAssetUseRequest,
  deliverAssetUse,
  getAssetUseRequest,
  listAssetUseRequests,
} from '@/lib/asset-use-requests';
import { searchDamAssets } from '@/lib/dam-search';
import { assetUseWorkflowEnabled } from '@/lib/workflow-flags';
import { ASSET_GALLERY_RESOURCE_URI, assetGalleryHtml } from '@/lib/mcp-asset-gallery';

function toolResult(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

function toolResultWithGallery(value: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

const searchAssetsOutputSchema = z.object({
  query: z.string(),
  total: z.number(),
  assets: z.array(z.object({
    public_id: z.string(),
    filename: z.string(),
    preview_url: z.string(),
    tags: z.array(z.string()).optional(),
    visual_tags: z.array(z.string()).optional(),
  }).passthrough()),
}).passthrough();

function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : 'The request could not be completed.';
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

function principalAuditDetails(principal: AgentPrincipal) {
  return {
    agentAuthType: principal.authType,
    agentIdentity: principal.id,
    agentName: principal.name,
    ...(principal.connectionId ? { connectionId: principal.connectionId } : {}),
  };
}

function createServer(principal: AgentPrincipal) {
  const server = new McpServer({
    name: 'pixelsky',
    version: '1.0.0',
  });

  server.registerResource(
    'pixelsky-asset-gallery',
    ASSET_GALLERY_RESOURCE_URI,
    { mimeType: 'text/html;profile=mcp-app' },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: 'text/html;profile=mcp-app',
        text: assetGalleryHtml,
        _meta: {
          ui: {
            prefersBorder: true,
            csp: { resourceDomains: ['https://res.cloudinary.com'] },
          },
        },
      }],
    }),
  );

  if (hasAgentScope(principal, 'assets:read')) {
    server.registerTool(
      'search_assets',
      {
        title: 'Search PixelSky assets',
        description: assetUseWorkflowEnabled()
          ? 'Find candidate images in this workspace. Results include previews and metadata, not delivery links. Request a specific use and wait for human approval before delivery.'
          : 'Search this workspace\'s connected Cloudinary image library. Results include previews and download links.',
        inputSchema: z.object({
          query: z.string().max(500).describe('Natural-language asset query.'),
          mode: z.enum(['strict', 'semantic']).optional().describe('Use semantic for visual and metadata search; strict is the exact metadata search fallback.'),
          limit: z.number().int().min(1).max(100).optional().describe('Maximum number of assets to return.'),
        }),
        outputSchema: searchAssetsOutputSchema,
        _meta: {
          ui: { resourceUri: ASSET_GALLERY_RESOURCE_URI },
          'openai/outputTemplate': ASSET_GALLERY_RESOURCE_URI,
          'openai/toolInvocation/invoking': 'Searching PixelSky...',
          'openai/toolInvocation/invoked': 'PixelSky results ready',
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      async ({ query, mode, limit }) => {
        try {
          const result = await searchDamAssets(principal.orgId, {
            query,
            mode: mode ?? 'semantic',
            limit,
          });
          if (query.trim()) {
            try {
              await logAuditEvent({
                orgId: principal.orgId,
                userId: principal.actorId,
                action: 'agent_mcp_search',
                details: {
                  ...principalAuditDetails(principal),
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
          const agentResult = assetUseWorkflowEnabled()
            ? { ...result, assets: result.assets.map(agentCandidate) }
            : result;
          return toolResultWithGallery(agentResult);
        } catch (error) {
          return toolError(error);
        }
      },
    );
  }

  if (assetUseWorkflowEnabled() && hasAgentScope(principal, 'asset_uses:request')) {
    server.registerTool(
      'request_asset_use',
      {
        title: 'Request permission to use a PixelSky image',
        description: 'Request human review for one image and one explicit use. Does not approve or deliver the image.',
        inputSchema: z.object({
          public_id: z.string().min(1).max(512),
          channel: z.string().min(1).max(80).describe('For example: email, website, paid social, or Figma design.'),
          campaign: z.string().min(1).max(140),
          placement: z.string().min(1).max(140).describe('Where the image will appear.'),
          region: z.string().min(1).max(80).describe('Audience or usage territory, such as US or global.'),
          purpose: z.string().min(1).max(1_000).describe('What the image will communicate or support.'),
        }),
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async (input) => {
        try {
          const request = await createAssetUseRequest(principal.orgId, principal.actorId, input);
          return toolResult({ request: agentAssetUseRequest(request) });
        } catch (error) {
          return toolError(error);
        }
      },
    );
  }

  if (assetUseWorkflowEnabled() && hasAgentScope(principal, 'asset_uses:read')) {
    server.registerTool(
      'list_asset_use_requests',
      {
        title: 'List PixelSky asset-use requests',
        description: 'Check whether image-use requests are pending, approved, rejected, or revoked.',
        inputSchema: z.object({ status: z.enum(['pending', 'approved', 'rejected', 'revoked']).optional() }),
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async ({ status }) => {
        try {
          const requests = await listAssetUseRequests(principal.orgId, status);
          return toolResult({ requests: requests.map(agentAssetUseRequest) });
        } catch (error) {
          return toolError(error);
        }
      },
    );
    server.registerTool(
      'get_asset_use_request',
      {
        title: 'Get a PixelSky asset-use request',
        description: 'Check the current approval state and intended use for one request.',
        inputSchema: z.object({ id: z.string().uuid() }),
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async ({ id }) => {
        try {
          const request = await getAssetUseRequest(principal.orgId, id);
          return toolResult({ request: agentAssetUseRequest(request) });
        } catch (error) {
          return toolError(error);
        }
      },
    );
    server.registerTool(
      'get_asset_delivery',
      {
        title: 'Get an approved PixelSky image',
        description: 'Return image and download links only when this exact use was approved and the Cloudinary asset has not changed.',
        inputSchema: z.object({ id: z.string().uuid() }),
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      async ({ id }) => {
        try {
          return toolResult(await deliverAssetUse(principal.orgId, principal.actorId, id));
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
        description: 'List approved asset pack manifests. Draft and rejected packs are never returned to agents.',
        inputSchema: z.object({
          limit: z.number().int().min(1).max(100).optional(),
        }),
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
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
        description: 'Get one approved asset pack manifest, including stable source and delivery URLs. Draft and rejected packs are inaccessible.',
        inputSchema: z.object({
          id: z.string().uuid().describe('PixelSky asset pack ID.'),
        }),
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
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
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async (payload) => {
        try {
          return toolResult(await createAgentAssetPackDraft({
            orgId: principal.orgId,
            actorId: principal.actorId,
            agentIdentity: principal.id,
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
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async ({ id }) => {
        try {
          return toolResult(await approveAgentAssetPack({
            orgId: principal.orgId,
            actorId: principal.actorId,
            agentIdentity: principal.id,
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

export function withMcpCors(response: Response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID',
  );
  headers.set('Access-Control-Expose-Headers', 'MCP-Protocol-Version, MCP-Session-Id, WWW-Authenticate');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function handleAuthenticatedMcp(request: Request, principal: AgentPrincipal) {
  const handler = createMcpHandler(() => createServer(principal), {
    responseMode: 'json',
  });
  try {
    return withMcpCors(await handler.fetch(request));
  } finally {
    await handler.close();
  }
}
