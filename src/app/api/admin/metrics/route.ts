import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/apiResponse';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const [totalUsers, proUsers, totalFavorites, totalAlerts, totalMountains] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: 'pro_user' } }),
        prisma.favoriteMountain.count(),
        prisma.alertSubscription.count(),
        prisma.mountain.count(),
      ]);
    return ok({ totalUsers, proUsers, totalFavorites, totalAlerts, totalMountains });
  } catch (e) {
    return handleError(e);
  }
}
