import { NextRequest } from 'next/server';
import { ok, created, handleError } from '@/lib/apiResponse';
import { verifyResortAccess } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const DifficultyEnum = z.enum(['green', 'blue', 'black', 'double_black', 'terrain_park', 'backcountry']);
const StatusEnum = z.enum(['open', 'groomed', 'closed', 'patrol_only']);

const CreateTrailSchema = z.object({
  trailName:   z.string().min(1),
  difficulty:  DifficultyEnum.default('blue'),
  status:      StatusEnum.default('closed'),
  zone:        z.string().optional(),
  snowDepthIn: z.number().optional(),
});

const UpdateTrailSchema = z.object({
  trailName:   z.string().min(1),
  status:      StatusEnum,
  snowDepthIn: z.number().optional(),
  groomedAt:   z.string().datetime().optional(),
});

// GET /api/resort/[resortId]/trails
export async function GET(
  req: NextRequest,
  { params }: { params: { resortId: string } }
) {
  try {
    const { resortId } = params;
    const ctx = await verifyResortAccess(req, resortId);
    if (!ctx) return handleError(new Error('RESORT_UNAUTHORIZED'), 401);

    const trails = await prisma.trailStatus.findMany({
      where: { resortId },
      orderBy: [{ zone: 'asc' }, { difficulty: 'asc' }, { trailName: 'asc' }],
    });

    // Group by zone for dashboard display
    const byZone: Record<string, typeof trails> = {};
    for (const t of trails) {
      const z = t.zone || 'Main Mountain';
      if (!byZone[z]) byZone[z] = [];
      byZone[z].push(t);
    }

    const summary = {
      total: trails.length,
      open:       trails.filter(t => t.status === 'open').length,
      groomed:    trails.filter(t => t.status === 'groomed').length,
      patrol_only: trails.filter(t => t.status === 'patrol_only').length,
      closed:     trails.filter(t => t.status === 'closed').length,
    };

    return ok({ trails, byZone, summary });
  } catch (e) {
    return handleError(e);
  }
}

// POST /api/resort/[resortId]/trails — create a trail
export async function POST(
  req: NextRequest,
  { params }: { params: { resortId: string } }
) {
  try {
    const { resortId } = params;
    const ctx = await verifyResortAccess(req, resortId, 'supervisor');
    if (!ctx) return handleError(new Error('RESORT_UNAUTHORIZED'), 401);

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

// PATCH /api/resort/[resortId]/trails — update trail status
export async function PATCH(
  req: NextRequest,
  { params }: { params: { resortId: string } }
) {
  try {
    const { resortId } = params;
    const ctx = await verifyResortAccess(req, resortId, 'staff');
    if (!ctx) return handleError(new Error('RESORT_UNAUTHORIZED'), 401);

    const body = UpdateTrailSchema.parse(await req.json());

    const trail = await prisma.trailStatus.updateMany({
      where: { resortId, trailName: body.trailName },
      data: {
        status: body.status,
        snowDepthIn: body.snowDepthIn,
        groomedAt: body.groomedAt ? new Date(body.groomedAt) : (body.status === 'groomed' ? new Date() : undefined),
        updatedBy: ctx.userId,
      },
    });

    if (trail.count === 0) return handleError(new Error('Trail not found'), 404);
    return ok({ updated: true, trailName: body.trailName, status: body.status });
  } catch (e) {
    return handleError(e);
  }
}
