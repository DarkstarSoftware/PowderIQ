import { NextRequest } from 'next/server';
import { verifyResortAccess } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { ok, created, err, handleError } from '@/lib/apiResponse';

const DifficultyEnum = z.enum([
  'green',
  'blue',
  'black',
  'double_black',
  'terrain_park',
  'backcountry',
]);

const StatusEnum = z.enum(['open', 'groomed', 'closed', 'patrol_only']);

const CreateTrailSchema = z.object({
  trailName: z.string().min(1),
  difficulty: DifficultyEnum.default('blue'),
  status: StatusEnum.default('closed'),
  zone: z.string().optional(),
  snowDepthIn: z.number().optional(),
});

const UpdateTrailSchema = z.object({
  trailName: z.string().min(1),
  status: StatusEnum,
  snowDepthIn: z.number().optional(),
  groomedAt: z.string().datetime().optional(),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ resortId: string }> }
) {
  try {
    const { resortId } = await context.params;

    const ctx = await verifyResortAccess(req, resortId);
    if (!ctx) return handleError(new Error('RESORT_UNAUTHORIZED'));

    const trails = await prisma.trailStatus.findMany({
      where: { resortId },
      orderBy: [{ zone: 'asc' }, { difficulty: 'asc' }, { trailName: 'asc' }],
    });

    return ok(trails);
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

    const body = CreateTrailSchema.parse(await req.json());

    const trail = await prisma.trailStatus.upsert({
      where: { resortId_trailName: { resortId, trailName: body.trailName } },
      update: { ...body },
      create: { resortId, ...body },
    });

    return created(trail);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ resortId: string }> }
) {
  try {
    const { resortId } = await context.params;

    const ctx = await verifyResortAccess(req, resortId, 'staff');
    if (!ctx) return handleError(new Error('RESORT_UNAUTHORIZED'));

    const body = UpdateTrailSchema.parse(await req.json());

    const trail = await prisma.trailStatus.updateMany({
      where: { resortId, trailName: body.trailName },
      data: {
        status: body.status,
        snowDepthIn: body.snowDepthIn,
        groomedAt: body.groomedAt
          ? new Date(body.groomedAt)
          : body.status === 'groomed'
          ? new Date()
          : undefined,
        updatedBy: ctx.userId,
      },
    });

    if (trail.count === 0) return err('Trail not found', 404);

    return ok({ updated: true });
  } catch (e) {
    return handleError(e);
  }
}