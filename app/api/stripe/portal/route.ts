import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getStripe } from '@/lib/stripe';
import { getBillingForOrg } from '@/lib/billing';

export async function POST(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: 'Workspace required.' }, { status: 403 });
  }

  let billing = null;
  try {
    billing = await getBillingForOrg(orgId);
  } catch (error) {
    console.error('Billing lookup error:', error);
    return NextResponse.json({ error: 'Billing is not configured.' }, { status: 500 });
  }
  if (!billing?.stripeCustomerId) {
    return NextResponse.json({ error: 'No billing customer found.' }, { status: 400 });
  }

  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: billing.stripeCustomerId,
    return_url: `${origin}/billing`,
  });

  return NextResponse.json({ url: session.url });
}

