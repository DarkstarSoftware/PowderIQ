// src/app/api/billing/portal/route.ts
// Creates a Stripe Customer Portal session for managing subscriptions.

import { NextRequest } from 'next/server';
import { ok, err, handleError } from '@/lib/apiResponse';
import { requireAuth } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://powder-iq.vercel.app';

export async function POST(req: NextRequest) {
  try {
    const user     = await requireAuth(req);
    const body     = await req.json().catch(() => ({}));
    const resortId = body?.resortId as string | undefined;

    let customerId: string | null = null;
    let returnUrl = `${APP_URL}/account`;

    if (resortId) {
      const resort = await prisma.resort.findFirst({
        where: { id: resortId },
      });
      customerId = resort?.stripeCustomerId ?? null;
      returnUrl  = `${APP_URL}/resort/dashboard`;
    } else {
      const sub  = await prisma.subscription.findUnique({ where: { userId: user.id } });
      customerId = sub?.stripeCustomerId ?? null;
    }

    if (!customerId) {
      return err('No billing account found. Please subscribe first.', 404);
    }

    const session = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: returnUrl,
    });

    return ok({ url: session.url });
  } catch (e) {
    return handleError(e);
  }
}
