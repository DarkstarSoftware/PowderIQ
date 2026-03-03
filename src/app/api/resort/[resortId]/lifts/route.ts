import { NextRequest } from 'next/server';
import { ok, created, handleError } from '@/lib/apiResponse';
import { verifyResortAccess } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const CreateLiftSchema = z.object({
  liftName:   z.string().min(1),
  liftType:   z.string().default('chairlift'),
  status:     z.enum(['open', 'on_hold', 'closed', 'scheduled']).default('closed'),
  topElevFt:  z.number().optional(),
  baseElevFt: z.number().optional(),
  waitMinutes: z.number().optional(),
});

const UpdateLiftSchema = z.object({
  liftName:   z.string().min(1),
  status:     z.enum(['open', 'on_hold', 'closed', 'scheduled']),
  waitMinutes: z.number().optional(),
});

// GET /api/resort/[resortId]/lifts
export async function GET(
  req: NextRequest,
  { params }: { params: { resortId: string } }
) {
  try {
    const { resortId } = params;
    const ctx = await verifyResortAccess(req, resortId);
    if (!ctx) return handleError(new Error('RESORT_UNAUTHORIZED'), 401);

    const lifts = await prisma.liftStatus.findMany({
      where: { resortId },
      orderBy: { liftName: 'asc' },
    });

    const summary = {
      total: lifts.length,
      open:      lifts.filter(l => l.status === 'open').length,
      on_hold:   lifts.filter(l => l.status === 'on_hold').length,
      scheduled: lifts.filter(l => l.status === 'scheduled').length,
      closed:    lifts.filter(l => l.status === 'closed').length,
    };

    return ok({ lifts, summary });
  } catch (e) {
    return handleError(e);
  }
}

// POST /api/resort/[resortId]/lifts — create a single lift
export async function POST(
  req: NextRequest,
  { params }: { params: { resortId: string } }
) {
  try {
    const { resortId } = params;
    const ctx = await verifyResortAccess(req, resortId, 'supervisor');
    if (!ctx) return handleError(new Error('RESORT_UNAUTHORIZED'), 401);

    const body = CreateLiftSchema.parse(await req.json());

    const lift = await prisma.liftStatus.upsert({
      where: { resortId_liftName: { resortId, liftName: body.liftName } },
      update: { ...body },
      create: { resortId, ...body },
    });

    return created(lift);
  } catch (e) {
    return handleError(e);
  }
}

// PATCH /api/resort/[resortId]/lifts — update a lift's status
export async function PATCH(
  req: NextRequest,
  { params }: { params: { resortId: string } }
) {
  try {
    const { resortId } = params;
    const ctx = await verifyResortAccess(req, resortId, 'staff');
    if (!ctx) return handleError(new Error('RESORT_UNAUTHORIZED'), 401);

    const body = UpdateLiftSchema.parse(await req.json());

    const lift = await prisma.liftStatus.updateMany({
      where: { resortId, liftName: body.liftName },
      data: {
        status: body.status,
        waitMinutes: body.waitMinutes,
        updatedBy: ctx.userId,
      },
    });

    if (lift.count === 0) return handleError(new Error('Lift not found'), 404);
    return ok({ updated: true, liftName: body.liftName, status: body.status });
  } catch (e) {
    return handleError(e);
  }
}
