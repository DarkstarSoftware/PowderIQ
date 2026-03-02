import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/apiResponse';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const mountains = await prisma.mountain.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { favorites: true, alerts: true } },
      },
    });
    return ok(mountains);
  } catch (e) {
    return handleError(e);
  }
}
