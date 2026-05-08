/**
 * Client-side service for handling Stripe-related operations.
 */

export interface SubscriptionPlan {
  id: string;
  priceId: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  description: string;
  features: string[];
}

/**
 * Fetches available subscription plans (products) from the server.
 * @param _options Optional configuration (unused but matches user request signature)
 */
export async function getSubscriptions(_options: any[] = []): Promise<SubscriptionPlan[]> {
  const response = await fetch('/api/subscription-plans');
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch plans: ${response.statusText}`);
  }
  return response.json();
}
