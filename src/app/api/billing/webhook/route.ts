import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { auditLog } from '@/lib/audit';
import Stripe from 'stripe';

// Raw body required for Stripe signature verification
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.userId;
        if (!userId) break;

        await prisma.subscription.update({
          where: { userId },
          data: {
            stripeSubscriptionId: session.subscription as string,
            status: 'active',
          },
        });

        await prisma.user.update({
          where: { id: userId },
          data: { role: 'pro_user' },
        });

        await auditLog({
          userId,
          action: 'billing.subscription_activated',
        });

        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;

        const dbSub = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: sub.id },
        });

        if (!dbSub) break;

        await prisma.subscription.update({
          where: { id: dbSub.id },
          data: {
            status: sub.status,
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
          },
        });

        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;

        const dbSub = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: sub.id },
        });

        if (!dbSub) break;

        await prisma.subscription.update({
          where: { id: dbSub.id },
          data: { status: 'canceled' },
        });

        await prisma.user.update({
          where: { id: dbSub.userId },
          data: { role: 'user' },
        });

        await auditLog({
          userId: dbSub.userId,
          action: 'billing.subscription_canceled',
        });

        break;
      }

      default:
        break;
    }

  } catch (e) {
    console.error('[webhook] Handler error:', e);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}