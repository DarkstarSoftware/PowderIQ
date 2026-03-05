import { NextRequest } from 'next/server';
import { ok, created, handleError } from '@/lib/apiResponse';
import { verifyResortAccess } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ resortId: string }> }
) {
  try {
    const { resortId } = await context.params;

    const ctx = await verifyResortAccess(req, resortId);
    if (!ctx) return handleError(new Error('RESORT_UNAUTHORIZED'));

    const reports = await prisma.resortSnowReport.findMany({
      where: { resortId },
      orderBy: { reportDate: 'desc' },
      take: 10,
    });

    return ok(reports);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ resortId: string }> }
) {
  try {
    const { resortId } = await context.params;

    const ctx = await verifyResortAccess(req, resortId, 'supervisor');
    if (!ctx) return handleError(new Error('RESORT_UNAUTHORIZED'));

    const body = await req.json();

    const report = await prisma.resortSnowReport.create({
      data: {
        resortId,
        ...body,
      },
    });

    return created(report);
  } catch (e) {
    return handleError(e);
  }
}