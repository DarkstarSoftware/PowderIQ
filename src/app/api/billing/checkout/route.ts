import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/apiResponse';
import { requireAuth } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { auditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    // Get or create Stripe customer
    let sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
    let customerId = sub?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      sub = await prisma.subscription.upsert({
        where: { userId: user.id },
        update: { stripeCustomerId: customerId },
        create: { userId: user.id, stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer:   customerId,
      mode:       'subscription',
      line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID!, quantity: 1 }],
      success_url:`${process.env.NEXT_PUBLIC_APP_URL}/account?upgraded=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/account`,
      metadata:   { userId: user.id },
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
