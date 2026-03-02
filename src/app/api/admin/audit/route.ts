import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/apiResponse';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { user: { select: { email: true } } },
    });
    return ok(logs);
  } catch (e) {
    return handleError(e);
  }
}
