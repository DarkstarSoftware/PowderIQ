// src/app/api/webhooks/revenuecat/route.ts
// Receives RevenueCat webhook events and syncs subscription status to DB.
// All platforms (iOS, Android, web) fire through here.
//
// Setup in RevenueCat dashboard:
//   Project → Integrations → Webhooks → https://powderiq.com/api/webhooks/revenuecat
//   Add Authorization header: Bearer REVENUECAT_WEBHOOK_SECRET

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET ?? '';

// RevenueCat event types that mean "user is Pro"
const ACTIVE_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'SUBSCRIPTION_EXTENDED',
  'TRANSFER',
]);

// RevenueCat event types that mean "user is no longer Pro"
const INACTIVE_EVENTS = new Set([
  'CANCELLATION',
  'EXPIRATION',
  'BILLING_ISSUE',
  'SUBSCRIBER_ALIAS',
]);

export async function POST(req: NextRequest) {
  // Verify webhook secret
  const auth = req.headers.get('Authorization');
  if (WEBHOOK_SECRET && auth !== `Bearer ${WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event    = body?.event;
  const type     = event?.type as string;
  const appUserId = event?.app_user_id as string; // This is the Supabase user ID we set

  if (!type || !appUserId) {
    return NextResponse.json({ ok: true }); // Ignore malformed events
  }

  console.log(`[RevenueCat] ${type} for user ${appUserId}`);

  try {
    if (ACTIVE_EVENTS.has(type)) {
      await grantPro(appUserId, event);
    } else if (INACTIVE_EVENTS.has(type)) {
      await revokePro(appUserId, event);
    }
  } catch (e: any) {
    console.error('[RevenueCat webhook]', e?.message);
    // Return 200 so RevenueCat doesn't retry — log the error for manual review
  }

  return NextResponse.json({ ok: true });
}

async function grantPro(userId: string, event: any) {
  const now = new Date();
  const expiresAt = event?.expiration_at_ms
    ? new Date(event.expiration_at_ms)
    : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year fallback

  const productId = event?.product_id ?? '';
  const store     = event?.store ?? 'unknown'; // APP_STORE | PLAY_STORE | STRIPE

  await prisma.$transaction([
    // Update or create subscription record
    prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeCustomerId:     `rc_${userId}`, // placeholder for non-Stripe
        stripeSubscriptionId: `rc_${store}_${productId}`,
        stripePriceId:        productId,
        status:               'active',
        currentPeriodEnd:     expiresAt,
      },
      update: {
        status:               'active',
        stripePriceId:        productId,
        stripeSubscriptionId: `rc_${store}_${productId}`,
        currentPeriodEnd:     expiresAt,
        updatedAt:            now,
      },
    }),
    // Promote user role to pro_user
    prisma.user.update({
      where: { id: userId },
      data:  { role: 'pro_user' },
    }),
  ]);

  // Clear any stale closed/zero scores so they recompute with Pro access
  await prisma.mountainScore.deleteMany({
    where: { score: 0 },
  }).catch(() => {});

  console.log(`[RevenueCat] ✓ Pro granted to ${userId} via ${store}, expires ${expiresAt.toISOString()}`);
}

async function revokePro(userId: string, event: any) {
  const now = new Date();

  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeCustomerId: `rc_${userId}`,
        status:           'inactive',
        currentPeriodEnd: now,
      },
      update: {
        status:           'inactive',
        currentPeriodEnd: now,
        updatedAt:        now,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data:  { role: 'user' },
    }),
  ]);

  console.log(`[RevenueCat] ✗ Pro revoked from ${userId}, reason: ${event?.type}`);
}
