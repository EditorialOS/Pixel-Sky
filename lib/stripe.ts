import Stripe from 'stripe';

let cachedStripe: Stripe | null = null;

export function getStripe() {
  if (cachedStripe) return cachedStripe;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Stripe is not configured.');
  }
  cachedStripe = new Stripe(secretKey, {
    apiVersion: '2025-12-15.clover',
  });
  return cachedStripe;
}
