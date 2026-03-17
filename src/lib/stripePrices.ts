// src/lib/stripePrices.ts
// Single source of truth for all Stripe Price IDs.

export const PRICES = {
  consumer: {
    pro: {
      monthly: 'price_1TBoTfBQF80h6BXMKPq90eqC', // $9.99/mo
      yearly:  'price_1TBoUyBQF80h6BXMmUpv0p3T', // $99.00/yr
    },
  },
  resort: {
    starter: {
      monthly: 'price_1TByR1BQF80h6BXMIqkcbOmO', // $49/mo
      yearly:  'price_1TByRaBQF80h6BXM9tDwJ39o', // $490/yr
    },
    pro: {
      monthly: 'price_1TC265BQF80h6BXMjNfXYnIw', // $149/mo
      yearly:  'price_1TC26SBQF80h6BXMFxN7Gf0k', // $1,490/yr
    },
    enterprise: {
      monthly: 'price_1TC27EBQF80h6BXMZgiqD9Nl', // $499/mo
      yearly:  'price_1TC27kBQF80h6BXMIl34pf9d', // $4,990/yr
    },
  },
} as const;

export const ALL_PRICE_IDS = new Set([
  PRICES.consumer.pro.monthly,
  PRICES.consumer.pro.yearly,
  PRICES.resort.starter.monthly,
  PRICES.resort.starter.yearly,
  PRICES.resort.pro.monthly,
  PRICES.resort.pro.yearly,
  PRICES.resort.enterprise.monthly,
  PRICES.resort.enterprise.yearly,
]);

export const PRICE_TO_RESORT_PLAN: Record<string, 'starter' | 'pro' | 'enterprise'> = {
  [PRICES.resort.starter.monthly]: 'starter',
  [PRICES.resort.starter.yearly]:  'starter',
  [PRICES.resort.pro.monthly]:     'pro',
  [PRICES.resort.pro.yearly]:      'pro',
  [PRICES.resort.enterprise.monthly]: 'enterprise',
  [PRICES.resort.enterprise.yearly]:  'enterprise',
};

export function isResortPrice(priceId: string): boolean {
  return priceId in PRICE_TO_RESORT_PLAN;
}
