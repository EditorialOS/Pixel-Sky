import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getStripe } from '@/lib/stripe';
import { getBillingForOrg, upsertBillingForOrg } from '@/lib/billing';

type CheckoutPayload = {
  plan?: 'monthly' | 'yearly';
};

export async function POST(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: 'Workspace required.' }, { status: 403 });
  }

  const body = (await request.json()) as CheckoutPayload;
  const plan = body.plan ?? 'monthly';

  const priceMonthly = process.env.STRIPE_PRICE_MONTHLY_ID;
  const priceYearly = process.env.STRIPE_PRICE_YEARLY_ID;
  const couponYearly = process.env.STRIPE_COUPON_YEARLY_ID;
  const trialDays = Number(process.env.STRIPE_TRIAL_DAYS ?? '7');

  const priceId = plan === 'yearly' ? priceYearly : priceMonthly;
  if (!priceId) {
    return NextResponse.json({ error: 'Stripe price is not configured.' }, { status: 500 });
  }

  const stripe = getStripe();
  let billing = null;
  try {
    billing = await getBillingForOrg(orgId);
  } catch (error) {
    console.error('Billing lookup error:', error);
    return NextResponse.json({ error: 'Billing is not configured.' }, { status: 500 });
  }

  let customerId = billing?.stripeCustomerId ?? null;
  if (!customerId) {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const org = await client.organizations.getOrganization({ organizationId: orgId });
    const customer = await stripe.customers.create({
      email: user.emailAddresses?.[0]?.emailAddress,
      name: org.name ?? 'PixelSky Workspace',
      metadata: {
        orgId,
        userId,
      },
    });
    customerId = customer.id;
    try {
      await upsertBillingForOrg({
        orgId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: billing?.stripeSubscriptionId ?? null,
        status: billing?.status ?? null,
        priceId: billing?.priceId ?? null,
        currentPeriodEnd: billing?.currentPeriodEnd ?? null,
        trialEnd: billing?.trialEnd ?? null,
      });
    } catch (error) {
      console.error('Billing update error:', error);
    }
  }

  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';
  const successUrl = `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/billing`;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      trial_period_days: Number.isFinite(trialDays) ? trialDays : 7,
      metadata: {
        orgId,
      },
    },
    discounts: plan === 'yearly' && couponYearly ? [{ coupon: couponYearly }] : undefined,
    allow_promotion_codes: plan !== 'yearly',
  });

  return NextResponse.json({ url: session.url });
}

