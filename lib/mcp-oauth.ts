import { auth, clerkClient } from '@clerk/nextjs/server';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { type AgentConnectionRecord } from '@/lib/agent-connections';
import { DEFAULT_AGENT_SCOPES, type AgentPrincipal, type AgentScope } from '@/lib/agent-keys';

const CHATGPT_CLIENT_ID = 'pixelsky-chatgpt';
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

type TokenKind = 'access' | 'authorization_code' | 'refresh';

type SignedToken = {
  clientId: string;
  connectionId?: string;
  exp: number;
  kind: TokenKind;
  orgId?: string;
  redirectUri: string;
  resourceKind?: 'connection' | 'universal';
  scope: string;
  scopes?: AgentScope[];
  userId: string;
  codeChallenge?: string;
};

export type McpOAuthResource =
  | { kind: 'connection'; connectionId: string }
  | { kind: 'universal' };

export const UNIVERSAL_MCP_PATH = '/api/mcp/chatgpt';

function signingKey() {
  const clerkSecret = process.env.CLERK_SECRET_KEY;
  if (!clerkSecret) return null;

  // Derive a dedicated signing key so OAuth artifacts never use the raw Clerk key directly.
  return createHmac('sha256', clerkSecret).update('pixelsky-mcp-oauth-v1').digest();
}

function encode(payload: SignedToken) {
  const key = signingKey();
  if (!key) throw new Error('PixelSky OAuth is not configured.');

  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', key).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function decode(value: string, expectedKind: TokenKind) {
  const key = signingKey();
  if (!key) return null;

  const [body, signature] = value.split('.');
  if (!body || !signature) return null;
  const expectedSignature = createHmac('sha256', key).update(body).digest('base64url');
  const left = Buffer.from(signature);
  const right = Buffer.from(expectedSignature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  try {
    const token = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SignedToken;
    if (token.kind !== expectedKind || token.exp <= Math.floor(Date.now() / 1000)) return null;
    return token;
  } catch {
    return null;
  }
}

function sha256Base64Url(value: string) {
  return createHash('sha256').update(value).digest('base64url');
}

function normalizeScope(value: string | null) {
  const requested = (value ?? '').split(/\s+/).filter(Boolean);
  const allowed = requested.filter((scope) => ['offline_access'].includes(scope));
  return allowed.join(' ');
}

export function isMcpOAuthConfigured() {
  return Boolean(signingKey());
}

export function getMcpOAuthIssuer(request: Request) {
  return new URL(request.url).origin;
}

export function isChatGptRedirectUri(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'chatgpt.com';
  } catch {
    return false;
  }
}

export function isChatGptClient(clientId: string, redirectUri: string) {
  return clientId === CHATGPT_CLIENT_ID && isChatGptRedirectUri(redirectUri);
}

export function chatGptClientRegistration(redirectUri: string) {
  return {
    client_id: CHATGPT_CLIENT_ID,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: 'ChatGPT',
    grant_types: ['authorization_code', 'refresh_token'],
    redirect_uris: [redirectUri],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  };
}

export function mcpOAuthResource(resource: string | null, request: Request): McpOAuthResource | null {
  if (!resource) return null;
  try {
    const url = new URL(resource);
    if (url.origin !== new URL(request.url).origin) return null;
    if (url.pathname === UNIVERSAL_MCP_PATH) return { kind: 'universal' };
    const match = url.pathname.match(/^\/api\/mcp\/([0-9a-f-]{36})$/i);
    return match?.[1] ? { kind: 'connection', connectionId: match[1] } : null;
  } catch {
    return null;
  }
}

export async function hasWorkspaceMembership(userId: string, orgId: string) {
  const client = await clerkClient();
  const memberships = await client.users.getOrganizationMembershipList({ userId, limit: 100 });
  return memberships.data.some((membership) => membership.organization.id === orgId);
}

export function createAuthorizationCode({
  resource,
  userId,
  orgId,
  redirectUri,
  codeChallenge,
  scope,
}: {
  resource: McpOAuthResource;
  userId: string;
  orgId?: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
}) {
  if (resource.kind === 'universal' && !orgId) {
    throw new Error('A PixelSky workspace is required for the public ChatGPT connection.');
  }
  return encode({
    clientId: CHATGPT_CLIENT_ID,
    ...(resource.kind === 'connection' ? { connectionId: resource.connectionId } : {}),
    codeChallenge,
    exp: Math.floor(Date.now() / 1000) + 5 * 60,
    kind: 'authorization_code',
    ...(resource.kind === 'universal' ? {
      orgId,
      resourceKind: 'universal' as const,
      scopes: DEFAULT_AGENT_SCOPES,
    } : { resourceKind: 'connection' as const }),
    redirectUri,
    scope,
    userId,
  });
}

export function exchangeAuthorizationCode({ code, codeVerifier, redirectUri }: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}) {
  const payload = decode(code, 'authorization_code');
  if (!payload || !payload.codeChallenge || payload.redirectUri !== redirectUri) return null;
  if (sha256Base64Url(codeVerifier) !== payload.codeChallenge) return null;
  return issueTokens(payload);
}

export function refreshMcpTokens(refreshToken: string) {
  const payload = decode(refreshToken, 'refresh');
  return payload ? issueTokens(payload) : null;
}

function issueTokens(payload: SignedToken) {
  const now = Math.floor(Date.now() / 1000);
  const shared = {
    clientId: payload.clientId,
    ...(payload.connectionId ? { connectionId: payload.connectionId } : {}),
    ...(payload.orgId ? { orgId: payload.orgId } : {}),
    redirectUri: payload.redirectUri,
    ...(payload.resourceKind ? { resourceKind: payload.resourceKind } : {}),
    scope: payload.scope,
    ...(payload.scopes ? { scopes: payload.scopes } : {}),
    userId: payload.userId,
  };
  const accessToken = encode({ ...shared, exp: now + ACCESS_TOKEN_TTL_SECONDS, kind: 'access' });
  const refreshToken = encode({ ...shared, exp: now + REFRESH_TOKEN_TTL_SECONDS, kind: 'refresh' });
  return {
    access_token: accessToken,
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: payload.scope,
    token_type: 'Bearer',
  };
}

export async function authenticateMcpOAuthConnection(
  request: Request,
  connection: AgentConnectionRecord,
): Promise<AgentPrincipal | null> {
  const authorization = request.headers.get('authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const token = decode(match[1], 'access');
  if (!token || token.resourceKind === 'universal' || token.connectionId !== connection.id || token.clientId !== CHATGPT_CLIENT_ID) return null;
  if (!(await hasWorkspaceMembership(token.userId, connection.org_id))) return null;

  return {
    id: `oauth:${token.userId}:${connection.id}`,
    orgId: connection.org_id,
    name: connection.name,
    scopes: connection.scopes,
    actorId: token.userId,
    authType: 'oauth',
    connectionId: connection.id,
  };
}

export async function authenticateUniversalMcpOAuth(request: Request): Promise<AgentPrincipal | null> {
  const authorization = request.headers.get('authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const token = decode(match[1], 'access');
  if (!token || token.resourceKind !== 'universal' || token.clientId !== CHATGPT_CLIENT_ID) return null;
  if (!token.orgId || !token.scopes || !(await hasWorkspaceMembership(token.userId, token.orgId))) return null;

  return {
    id: `oauth:${token.userId}:chatgpt:${token.orgId}`,
    orgId: token.orgId,
    name: 'PixelSky for ChatGPT',
    scopes: token.scopes,
    actorId: token.userId,
    authType: 'oauth',
  };
}

export async function currentOAuthIdentity() {
  const identity = await auth();
  return { userId: identity.userId, orgId: identity.orgId };
}

export function requestedScope(value: string | null) {
  return normalizeScope(value);
}
