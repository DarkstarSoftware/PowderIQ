import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { auditLog } from '@/lib/audit';
import { handleError } from '@/lib/apiResponse';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    const [profile, favorites, alerts, subscription, auditLogs] = await Promise.all([
      prisma.riderProfile.findUnique({ where: { userId: user.id } }),
      prisma.favoriteMountain.findMany({
        where: { userId: user.id },
        include: { mountain: { select: { name: true, state: true } } },
      }),
      prisma.alertSubscription.findMany({
        where: { userId: user.id },
        include: { mountain: { select: { name: true } } },
      }),
      prisma.subscription.findUnique({ where: { userId: user.id } }),
      prisma.auditLog.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      profile,
      favorites: favorites.map((f) => ({
        mountain: f.mountain.name,
        state:    f.mountain.state,
        addedAt:  f.createdAt,
      })),
      alerts: alerts.map((a) => ({
        mountain:  a.mountain.name,
        threshold: a.threshold,
        active:    a.active,
      })),
      subscription: subscription
        ? {
            status:          subscription.status,
            currentPeriodEnd:subscription.currentPeriodEnd,
          }
        : null,
      activityLog: auditLogs.map((l) => ({
        action: l.action,
        entity: l.entity,
        ts:     l.createdAt,
      })),
    };

    await auditLog({
      userId: user.id,
      action: 'privacy.data_exported',
      ip:     req.headers.get('x-forwarded-for') || undefined,
    });

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type':        'application/json',
        'Content-Disposition': 'attachment; filename="powderiq-data.json"',
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
