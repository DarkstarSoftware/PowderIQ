import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, err, handleError } from '@/lib/apiResponse';
import { requirePro } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const user = await requirePro(req);
    const alerts = await prisma.alertSubscription.findMany({
      where: { userId: user.id },
      include: { mountain: { select: { id: true, name: true, state: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return ok(alerts);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePro(req);
    const { mountainId, threshold } = z
      .object({
        mountainId: z.string(),
        threshold:  z.number().min(30).max(95).default(70),
      })
      .parse(await req.json());

    const alert = await prisma.alertSubscription.upsert({
      where: { userId_mountainId: { userId: user.id, mountainId } },
      update: { threshold, active: true },
      create: { userId: user.id, mountainId, threshold },
      include: { mountain: { select: { id: true, name: true, state: true } } },
    });
    return ok(alert, 201);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requirePro(req);
    const { alertId } = z
      .object({ alertId: z.string() })
      .parse(await req.json());

    const deleted = await prisma.alertSubscription.deleteMany({
      where: { id: alertId, userId: user.id },
    });
    if (deleted.count === 0) return err('Alert not found', 404);
    return ok({ removed: true });
  } catch (e) {
    return handleError(e);
  }
}
