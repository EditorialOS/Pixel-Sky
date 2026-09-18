import { auth, clerkClient } from '@clerk/nextjs/server';
import { type AgentConnectionRecord } from '@/lib/agent-connections';
import { type AgentPrincipal } from '@/lib/agent-keys';

function oauthIssuer() {
  const rawIssuer = process.env.PIXELSKY_OAUTH_ISSUER?.trim();
  if (!rawIssuer) return null;

  try {
    const issuer = new URL(rawIssuer);
    if (issuer.protocol !== 'https:' && issuer.hostname !== 'localhost') return null;
    return issuer.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function getMcpOAuthIssuer() {
  return oauthIssuer();
}

export function isMcpOAuthConfigured() {
  return Boolean(oauthIssuer());
}

export async function authenticateMcpOAuthConnection(
  connection: AgentConnectionRecord,
): Promise<AgentPrincipal | null> {
  const issuer = oauthIssuer();
  if (!issuer) return null;

  const identity = await auth({ acceptsToken: 'oauth_token' });
  if (!identity.isAuthenticated || identity.tokenType !== 'oauth_token' || !identity.userId) {
    return null;
  }

  const client = await clerkClient();
  const memberships = await client.users.getOrganizationMembershipList({
    userId: identity.userId,
    limit: 100,
  });
  const isWorkspaceMember = memberships.data.some(
    (membership) => membership.organization.id === connection.org_id,
  );
  if (!isWorkspaceMember) return null;

  return {
    id: identity.id,
    orgId: connection.org_id,
    name: connection.name,
    // PixelSky permissions are fixed by the workspace admin's connection record.
    // OAuth proves the user's identity; it does not let a chat client escalate scope.
    scopes: connection.scopes,
    actorId: identity.userId,
    authType: 'oauth',
    connectionId: connection.id,
  };
}
