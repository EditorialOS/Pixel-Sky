import { getSupabaseAdmin } from './supabase';

export type BillingRecord = {
  orgId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: string | null;
  priceId: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
};

type BillingRow = {
  org_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string | null;
  price_id: string | null;
  current_period_end: string | null;
  trial_end: string | null;
};

export async function getBillingForOrg(orgId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('organization_billing')
    .select('org_id, stripe_customer_id, stripe_subscription_id, status, price_id, current_period_end, trial_end')
    .eq('org_id', orgId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  const row = data as BillingRow;
  return {
    orgId: row.org_id,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    status: row.status,
    priceId: row.price_id,
    currentPeriodEnd: row.current_period_end,
    trialEnd: row.trial_end,
  } satisfies BillingRecord;
}

export async function upsertBillingForOrg(record: BillingRecord) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('organization_billing')
    .upsert(
      [
        {
          org_id: record.orgId,
          stripe_customer_id: record.stripeCustomerId,
          stripe_subscription_id: record.stripeSubscriptionId,
          status: record.status,
          price_id: record.priceId,
          current_period_end: record.currentPeriodEnd,
          trial_end: record.trialEnd,
          updated_at: new Date().toISOString(),
        },
      ] as any,
      { onConflict: 'org_id' },
    );

  if (error) {
    throw error;
  }
}

export function isBillingActive(record: BillingRecord | null) {
  if (!record) return false;
  if (record.status === 'active') return true;
  if (record.status === 'trialing') return true;
  return false;
}
