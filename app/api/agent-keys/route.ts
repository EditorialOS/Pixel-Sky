import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  AgentScope,
  createAgentApiKey,
  listAgentApiKeys,
  normalizeAgentScopes,
  revokeAgentApiKey,
} from '@/lib/agent-keys';
import { logAuditEvent } from '@/lib/audit';

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
  console.error('Agent key database error:', error);
  return NextResponse.json(
    { error: 'Agent access is unavailable. Run the PixelSky agent-key migration first.' },
    { status: 503 },
  );
}

export async function GET() {
  const context = await requireWorkspaceAdmin();
  if ('error' in context) return context.error;
  try {
    const keys = await listAgentApiKeys(context.orgId);
    return NextResponse.json({ keys });
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
  if (!name) return NextResponse.json({ error: 'A key name is required.' }, { status: 400 });

  const scopes = payload.scopes === undefined
    ? undefined
    : normalizeAgentScopes(payload.scopes) as AgentScope[];
  if (payload.scopes !== undefined && (!scopes || scopes.length === 0)) {
    return NextResponse.json({ error: 'Choose at least one valid permission.' }, { status: 400 });
  }

  try {
    const { key, token } = await createAgentApiKey({
      orgId: context.orgId,
      userId: context.userId,
      name,
      scopes,
    });
    try {
      await logAuditEvent({
        orgId: context.orgId,
        userId: context.userId,
        action: 'agent_key_created',
        details: { agentKeyId: key.id, name: key.name, scopes: key.scopes },
      });
    } catch (auditError) {
      console.error('Agent key audit error:', auditError);
    }
    return NextResponse.json({ key, token }, { status: 201 });
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
  if (!id) return NextResponse.json({ error: 'A key id is required.' }, { status: 400 });

  try {
    const revoked = await revokeAgentApiKey({ id, orgId: context.orgId });
    if (!revoked) return NextResponse.json({ error: 'Active agent key not found.' }, { status: 404 });
    try {
      await logAuditEvent({
        orgId: context.orgId,
        userId: context.userId,
        action: 'agent_key_revoked',
        details: { agentKeyId: id },
      });
    } catch (auditError) {
      console.error('Agent key audit error:', auditError);
    }
    return NextResponse.json({ revoked: true });
  } catch (error) {
    return unavailableResponse(error);
  }
}
