// src/app/api/stripe/webhook/route.ts
// Updated to handle resort plan provisioning and payment failures.
// Keeps existing structure and patterns.

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { auditLog } from '@/lib/audit';
import { isResortPrice, PRICE_TO_RESORT_PLAN } from '@/lib/stripePrices';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {

      // ── Checkout completed → provision access ──────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { userId, resortId, track, priceId } = session.metadata ?? {};
        if (!userId) break;

        const stripeSubId = session.subscription as string;

        if (track === 'resort' && resortId) {
          // Resort track
          const plan = PRICE_TO_RESORT_PLAN[priceId ?? ''] ?? 'starter';
          await prisma.resort.update({
            where: { id: resortId },
            data: {
              plan,
              planStatus:           'active',
              stripeSubscriptionId: stripeSubId,
            },
          });
          await auditLog({ userId, action: 'billing.resort_plan_activated' });
        } else {
          // Consumer track
          await prisma.subscription.update({
            where: { userId },
            data: {
              stripeSubscriptionId: stripeSubId,
              stripePriceId:        priceId ?? null,
              status:               'active',
            },
          });
          await prisma.user.update({
            where: { id: userId },
            data:  { role: 'pro_user' },
          });
          await auditLog({ userId, action: 'billing.subscription_activated' });
        }
        break;
      }

      // ── Subscription updated (renewals, plan changes, trial ends) ──────
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const { userId, resortId, track, priceId } = sub.metadata ?? {};
        const periodEnd = new Date(sub.current_period_end * 1000);
        const resolvedPriceId = priceId || sub.items.data[0]?.price?.id || '';

        const status = sub.status === 'trialing' ? 'trialing'
                     : sub.status === 'active'   ? 'active'
                     : sub.status === 'past_due'  ? 'past_due'
                     : 'inactive';

        if (track === 'resort' && resortId) {
          const plan = PRICE_TO_RESORT_PLAN[resolvedPriceId] ?? 'starter';
          await prisma.resort.update({
            where: { id: resortId },
            data: { plan, planStatus: status },
          });
        } else {
          // Find by subscription ID (most reliable)
          const dbSub = await prisma.subscription.findUnique({
            where: { stripeSubscriptionId: sub.id },
          });
          if (dbSub) {
            await prisma.subscription.update({
              where: { id: dbSub.id },
              data: {
                status,
                stripePriceId:    resolvedPriceId || undefined,
                currentPeriodEnd: periodEnd,
              },
            });
            // Keep user role in sync
            if (status === 'active' || status === 'trialing') {
              await prisma.user.update({ where: { id: dbSub.userId }, data: { role: 'pro_user' } });
            } else if (status === 'inactive') {
              await prisma.user.update({ where: { id: dbSub.userId }, data: { role: 'user' } });
            }
          }
        }
        break;
      }

      // ── Subscription deleted (canceled) ────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const { userId, resortId, track } = sub.metadata ?? {};

        if (track === 'resort' && resortId) {
          await prisma.resort.update({
            where: { id: resortId },
            data: {
              plan:                'starter',
              planStatus:          'canceled',
              stripeSubscriptionId: null,
            },
          });
          if (userId) await auditLog({ userId, action: 'billing.resort_plan_canceled' });
        } else {
          const dbSub = await prisma.subscription.findUnique({
            where: { stripeSubscriptionId: sub.id },
          });
          if (!dbSub) break;

          await prisma.subscription.update({
            where: { id: dbSub.id },
            data:  { status: 'canceled', stripeSubscriptionId: null },
          });
          await prisma.user.update({
            where: { id: dbSub.userId },
            data:  { role: 'user' },
          });
          await auditLog({ userId: dbSub.userId, action: 'billing.subscription_canceled' });
        }
        break;
      }

      // ── Payment succeeded → refresh period end ─────────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;

        const subId = invoice.subscription as string;
        const sub   = await stripe.subscriptions.retrieve(subId);
        const periodEnd = new Date(sub.current_period_end * 1000);

        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subId },
          data:  { status: 'active', currentPeriodEnd: periodEnd },
        });
        await prisma.resort.updateMany({
          where: { stripeSubscriptionId: subId },
          data:  { planStatus: 'active' },
        });
        break;
      }

      // ── Payment failed → mark past_due ────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;

        const subId = invoice.subscription as string;

        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subId },
          data:  { status: 'past_due' },
        });
        await prisma.resort.updateMany({
          where: { stripeSubscriptionId: subId },
          data:  { planStatus: 'past_due' },
        });
        console.warn('[webhook] Payment failed for subscription:', subId);
        break;
      }

      default:
        break;
    }
  } catch (e) {
    console.error('[webhook] Handler error:', e);
    // Return 200 so Stripe doesn't retry endlessly — investigate via logs
    return NextResponse.json({ error: 'Handler failed', received: true }, { status: 200 });
  }

  return NextResponse.json({ received: true });
}
