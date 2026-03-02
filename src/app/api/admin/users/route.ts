import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/apiResponse';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, email: true, role: true, createdAt: true,
        _count: { select: { favorites: true, alerts: true } },
      },
    });
    return ok(users);
  } catch (e) {
    return handleError(e);
  }
}
