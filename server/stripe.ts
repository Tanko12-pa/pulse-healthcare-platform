import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export async function createCheckoutSession(params: {
  userId: string;
  userEmail: string;
  priceId: string;
  planType: 'monthly' | 'yearly';
  isTrial: boolean;
  successUrl: string;
  cancelUrl: string;
}) {
  const stripe = getStripe();

  // Updated to match requested structure while preserving app tracking metadata
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price: params.priceId,
      quantity: 1,
    }],
    mode: 'subscription',
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    // Essential for multi-user/real-time sync implemented earlier
    customer_email: params.userEmail,
    client_reference_id: params.userId,
    metadata: {
      userId: params.userId,
      plan: params.planType,
      isTrial: params.isTrial.toString(),
    },
    ...(params.isTrial && {
      subscription_data: {
        trial_period_days: 7,
      }
    })
  });

  return session;
}
