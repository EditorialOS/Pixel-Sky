import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getBillingForOrg, isBillingActive } from '@/lib/billing';

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: 'Workspace required.' }, { status: 403 });
  }

  try {
    const billing = await getBillingForOrg(orgId);
    return NextResponse.json({
      active: isBillingActive(billing),
      status: billing?.status ?? 'inactive',
      priceId: billing?.priceId ?? null,
      currentPeriodEnd: billing?.currentPeriodEnd ?? null,
      trialEnd: billing?.trialEnd ?? null,
    });
  } catch (error) {
    console.error('Billing status error:', error);
    return NextResponse.json({ error: 'Unable to load billing status.' }, { status: 500 });
  }
}
