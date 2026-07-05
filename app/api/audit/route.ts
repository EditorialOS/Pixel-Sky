import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: 'Workspace required.' }, { status: 403 });
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Math.min(Math.max(Number(limitParam), 1), MAX_LIMIT) : DEFAULT_LIMIT;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, details, user_id, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Audit log fetch error:', error);
    return NextResponse.json({ error: 'Unable to load audit logs.' }, { status: 500 });
  }

  return NextResponse.json({ logs: data ?? [] });
}
