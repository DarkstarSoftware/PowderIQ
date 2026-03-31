// src/app/api/webhooks/stripe/route.ts
// Stripe webhook — syncs subscription status to DB + RevenueCat
// so web purchases are reflected on mobile immediately.
//
// Vercel env vars needed:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET  (from Stripe Dashboard → Webhooks)
//   REVENUECAT_SECRET_KEY  (from RevenueCat → API Keys → Secret)

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { grantProEntitlement, revokeProEntitlement } from '@/services/revenueCatService';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  } catch (e: any) {
    console.error('[Stripe webhook] signature failed:', e.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;
        const userId = session.metadata?.userId;
        if (!userId) break;
        const subId = session.subscription as string;
        const sub   = await stripe.subscriptions.retrieve(subId);
        await syncActive(userId, sub);
        break;
      }

      case 'customer.subscription.updated': {
        const sub    = event.data.object as Stripe.Subscription;
        const userId = await getUserIdFromCustomer(sub.customer as string);
        if (!userId) break;
        if (sub.status === 'active' || sub.status === 'trialing') {
          await syncActive(userId, sub);
        } else {
          await syncInactive(userId, sub.status);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub    = event.data.object as Stripe.Subscription;
        const userId = await getUserIdFromCustomer(sub.customer as string);
        if (!userId) break;
        await syncInactive(userId, 'canceled');
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const userId  = await getUserIdFromCustomer(invoice.customer as string);
        if (userId) await syncInactive(userId, 'past_due');
        break;
      }
    }
  } catch (e: any) {
    console.error('[Stripe webhook] handler error:', e?.message);
    // Still return 200 so Stripe doesn't retry
  }

  return NextResponse.json({ received: true });
}

async function syncActive(userId: string, sub: Stripe.Subscription) {
  const now     = new Date();
  const expires = new Date(sub.current_period_end * 1000);
  const priceId = (sub.items.data[0]?.price?.id) ?? '';

  await prisma.$transaction([
    prisma.subscription.upsert({
      where:  { userId },
      create: {
        userId,
        stripeCustomerId:     sub.customer as string,
        stripeSubscriptionId: sub.id,
        stripePriceId:        priceId,
        status:               sub.status === 'trialing' ? 'trialing' : 'active',
        currentPeriodEnd:     expires,
      },
      update: {
        stripeSubscriptionId: sub.id,
        stripePriceId:        priceId,
        status:               sub.status === 'trialing' ? 'trialing' : 'active',
        currentPeriodEnd:     expires,
        updatedAt:            now,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data:  { role: 'pro_user' },
    }),
  ]);

  // Sync to RevenueCat so mobile reflects the web purchase
  await grantProEntitlement(userId, sub.id, expires);
  console.log(`[Stripe] ✓ Pro granted to ${userId}, expires ${expires.toISOString()}`);
}

async function syncInactive(userId: string, reason: string) {
  await prisma.$transaction([
    prisma.subscription.upsert({
      where:  { userId },
      create: {
        userId,
        stripeCustomerId: `stripe_${userId}`,
        status:           'inactive',
        currentPeriodEnd: new Date(),
      },
      update: {
        status:           reason === 'past_due' ? 'past_due' : 'inactive',
        currentPeriodEnd: new Date(),
        updatedAt:        new Date(),
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data:  { role: 'user' },
    }),
  ]);

  await revokeProEntitlement(userId);
  console.log(`[Stripe] ✗ Pro revoked from ${userId}, reason: ${reason}`);
}

async function getUserIdFromCustomer(customerId: string): Promise<string | null> {
  const sub = await prisma.subscription.findFirst({
    where:  { stripeCustomerId: customerId },
    select: { userId: true },
  });
  return sub?.userId ?? null;
}
