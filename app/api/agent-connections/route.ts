import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  AgentScope,
  createAgentConnection,
  listAgentConnections,
  revokeAgentConnection,
} from '@/lib/agent-connections';
import { normalizeAgentScopes } from '@/lib/agent-keys';
import { logAuditEvent } from '@/lib/audit';
import { isMcpOAuthConfigured } from '@/lib/mcp-oauth';

async function requireWorkspaceAdmin() {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) };
  if (!orgId) return { error: NextResponse.json({ error: 'Workspace required.' }, { status: 403 }) };
  if (orgRole !== 'org:admin') {
    return { error: NextResponse.json({ error: 'Workspace admin access is required.' }, { status: 403 }) };
  }
  return { userId, orgId };
}

function unavailableResponse(error: unknown) {
  console.error('Agent connection database error:', error);
  return NextResponse.json(
    { error: 'Chat connections are unavailable. Run the PixelSky OAuth-connection migration first.' },
    { status: 503 },
  );
}

export async function GET() {
  const context = await requireWorkspaceAdmin();
  if ('error' in context) return context.error;
  try {
    const connections = await listAgentConnections(context.orgId);
    return NextResponse.json({ connections, oauthReady: isMcpOAuthConfigured() });
  } catch (error) {
    return unavailableResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const context = await requireWorkspaceAdmin();
  if ('error' in context) return context.error;

  let payload: { name?: unknown; scopes?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const name = typeof payload.name === 'string' ? payload.name.trim().slice(0, 120) : '';
  if (!name) return NextResponse.json({ error: 'A connection name is required.' }, { status: 400 });

  const scopes = payload.scopes === undefined
    ? undefined
    : normalizeAgentScopes(payload.scopes) as AgentScope[];
  if (payload.scopes !== undefined && (!scopes || scopes.length === 0)) {
    return NextResponse.json({ error: 'Choose at least one valid permission.' }, { status: 400 });
  }

  try {
    const connection = await createAgentConnection({
      orgId: context.orgId,
      userId: context.userId,
      name,
      scopes,
    });
    try {
      await logAuditEvent({
        orgId: context.orgId,
        userId: context.userId,
        action: 'agent_connection_created',
        details: { connectionId: connection.id, name: connection.name, scopes: connection.scopes },
      });
    } catch (auditError) {
      console.error('Agent connection audit error:', auditError);
    }
    return NextResponse.json({
      connection,
      endpoint: new URL(`/api/mcp/${connection.id}`, request.url).toString(),
      oauthReady: isMcpOAuthConfigured(),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Choose at least one agent permission.') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return unavailableResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  const context = await requireWorkspaceAdmin();
  if ('error' in context) return context.error;
  let payload: { id?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const id = typeof payload.id === 'string' ? payload.id : '';
  if (!id) return NextResponse.json({ error: 'A connection id is required.' }, { status: 400 });

  try {
    const revoked = await revokeAgentConnection({ id, orgId: context.orgId });
    if (!revoked) return NextResponse.json({ error: 'Active chat connection not found.' }, { status: 404 });
    try {
      await logAuditEvent({
        orgId: context.orgId,
        userId: context.userId,
        action: 'agent_connection_revoked',
        details: { connectionId: id },
      });
    } catch (auditError) {
      console.error('Agent connection audit error:', auditError);
    }
    return NextResponse.json({ revoked: true });
  } catch (error) {
    return unavailableResponse(error);
  }
}
