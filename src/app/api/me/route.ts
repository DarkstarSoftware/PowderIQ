// src/app/api/me/route.ts
// Returns current user profile + subscription status.
// Used by the dashboard to determine feature access (isPro gating).

import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/apiResponse';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    const [profile, subscription, resort] = await Promise.all([
      prisma.riderProfile.findUnique({ where: { userId: user.id } }),
      prisma.subscription.findUnique({ where: { userId: user.id },
        select: { status: true, stripePriceId: true, currentPeriodEnd: true } }),
      prisma.resort.findFirst({ where: { userId: user.id }, select: { id: true } }),
    ]);

    return ok({
      id:    user.id,
      email: user.email,
      role:  user.role,
      profile: profile ? {
        displayName: profile.displayName,
        avatarUrl:   null, // populated from storage bucket separately
        style:       profile.style,
        skillLevel:  profile.skillLevel,
        homeMountain: profile.homeMountain,
      } : null,
      subscription: subscription ? {
        status:         subscription.status,
        stripePriceId:  subscription.stripePriceId,
        currentPeriodEnd: subscription.currentPeriodEnd,
      } : { status: 'inactive', stripePriceId: null, currentPeriodEnd: null },
      hasResort: !!resort,
    });
  } catch (e) {
    return handleError(e);
  }
}
