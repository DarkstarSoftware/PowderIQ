// src/app/api/billing/checkout/route.ts
// Updated to support all price IDs (consumer + resort tracks).
// Keeps existing patterns: requireAuth, auditLog, @/lib/stripe.

import { NextRequest } from 'next/server';
import { ok, err, handleError } from '@/lib/apiResponse';
import { requireAuth } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { auditLog } from '@/lib/audit';
import { ALL_PRICE_IDS, isResortPrice, PRICE_TO_RESORT_PLAN } from '@/lib/stripePrices';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://powder-iq.vercel.app';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    const body     = await req.json().catch(() => ({}));
    // priceId defaults to consumer pro monthly for backward compatibility
    const priceId  = (body.priceId as string) || process.env.STRIPE_PRO_PRICE_ID!;
    const resortId = body.resortId as string | undefined;

    // Validate price ID
    if (!ALL_PRICE_IDS.has(priceId)) {
      return err('Invalid price ID', 400);
    }

    // Resort track requires resortId + operator check
    if (isResortPrice(priceId)) {
      if (!resortId) return err('resortId required for resort plans', 400);
      const operator = await prisma.resortOperator.findFirst({
        where: { resortId, userId: user.id },
      });
      if (!operator) return err('Not authorized for this resort', 403);
    }

    // ── Get or create Stripe customer ──────────────────────────────────────

    let customerId: string;

    if (isResortPrice(priceId) && resortId) {
      // Resort track — customer on the Resort record
      const resort = await prisma.resort.findUnique({ where: { id: resortId } });
      if (!resort) return err('Resort not found', 404);

      if (resort.stripeCustomerId) {
        customerId = resort.stripeCustomerId;
      } else {
        const customer = await stripe.customers.create({
          email:    user.email,
          name:     resort.name,
          metadata: { resortId, userId: user.id, track: 'resort' },
        });
        customerId = customer.id;
        await prisma.resort.update({
          where: { id: resortId },
          data:  { stripeCustomerId: customer.id },
        });
      }
    } else {
      // Consumer track — customer on the Subscription record
      let sub = await prisma.subscription.findUnique({ where: { userId: user.id } });

      if (sub?.stripeCustomerId) {
        customerId = sub.stripeCustomerId;
      } else {
        const customer = await stripe.customers.create({
          email:    user.email,
          metadata: { userId: user.id, track: 'consumer' },
        });
        customerId = customer.id;
        sub = await prisma.subscription.upsert({
          where:  { userId: user.id },
          update: { stripeCustomerId: customer.id },
          create: { userId: user.id, stripeCustomerId: customer.id },
        });
      }
    }

    // ── Create checkout session ────────────────────────────────────────────

    const session = await stripe.checkout.sessions.create({
      customer:              customerId,
      mode:                  'subscription',
      payment_method_types:  ['card'],
      line_items:            [{ price: priceId, quantity: 1 }],
      metadata: {
        userId:   user.id,
        priceId,
        resortId: resortId ?? '',
        track:    isResortPrice(priceId) ? 'resort' : 'consumer',
      },
      subscription_data: {
        metadata: {
          userId:   user.id,
          priceId,
          resortId: resortId ?? '',
          track:    isResortPrice(priceId) ? 'resort' : 'consumer',
        },
        trial_period_days: isResortPrice(priceId) ? 14 : undefined,
      },
      success_url: isResortPrice(priceId)
        ? `${APP_URL}/resort/dashboard?upgraded=1`
        : `${APP_URL}/account?upgraded=1`,
      cancel_url: isResortPrice(priceId)
        ? `${APP_URL}/resort/dashboard`
        : `${APP_URL}/account`,
      allow_promotion_codes: true,
    });

    await auditLog({
      userId: user.id,
      action: 'billing.checkout_started',
      ip:     req.headers.get('x-forwarded-for') || undefined,
    });

    return ok({ sessionId: session.id, url: session.url });
  } catch (e) {
    return handleError(e);
  }
}
