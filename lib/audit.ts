import { getSupabaseAdmin } from './supabase';

export type AuditAction =
  | 'search'
  | 'download'
  | 'upload_requested'
  | 'upload'
  | 'settings_updated'
  | 'ai_search'
  | 'ai_index'
  | 'variant_generated';

export type AuditEvent = {
  orgId: string;
  userId: string;
  action: AuditAction;
  details?: Record<string, unknown>;
};

export async function logAuditEvent(event: AuditEvent) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('audit_logs')
    .insert(
      [
        {
          org_id: event.orgId,
          user_id: event.userId,
          action: event.action,
          details: event.details ?? {},
          created_at: new Date().toISOString(),
        },
      ] as any,
    );

  if (error) {
    throw error;
  }
}
