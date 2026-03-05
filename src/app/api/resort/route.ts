import { NextRequest } from 'next/server';
import { ok, created, err, handleError } from '@/lib/apiResponse';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { seedLiftsFromLiftie, deriveSlug } from '@/services/liftieSeeder';
import { z } from 'zod';

const CreateResortSchema = z.object({
  mountainId:   z.string().min(1),
  plan:         z.enum(['starter', 'pro', 'enterprise']).default('starter'),
  contactName:  z.string().min(1),
  contactEmail: z.string().email(),
  phone:        z.string().optional(),
  liftieSlug:   z.string().optional(),
});

const MOUNTAIN_SELECT = {
  name: true, state: true, slug: true,
  latitude: true, longitude: true,
  topElevFt: true, baseElevFt: true,
} as const;

// GET /api/resort
//   ?mountainId=xxx  → public lookup, no auth (used by guest trail map page)
//   (no params)      → list operator's own resorts, auth required
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mountainId = searchParams.get('mountainId');

    // Public lookup by mountainId — no auth needed
    if (mountainId) {
      const resort = await prisma.resort.findUnique({
        where: { mountainId },
        include: {
          mountain:      { select: MOUNTAIN_SELECT },
          liftStatuses:  { select: { status: true } },
          trailStatuses: { select: { status: true } },
        },
      });
      if (!resort) return ok([]);
      return ok([{
        ...resort,
        staffRole:   null,
        liftsOpen:   resort.liftStatuses.filter((l: any) => l.status === 'open').length,
        totalLifts:  resort.liftStatuses.length,
        trailsOpen:  resort.trailStatuses.filter((t: any) => t.status === 'open' || t.status === 'groomed').length,
        totalTrails: resort.trailStatuses.length,
      }]);
    }

    // Authenticated: list operator's own resorts
    const user = await requireAuth(req);
    const operators = await prisma.resortOperator.findMany({
      where: { userId: user.id },
      include: {
        resort: {
          include: {
            mountain:      { select: MOUNTAIN_SELECT },
            liftStatuses:  { select: { status: true } },
            trailStatuses: { select: { status: true } },
          },
        },
      },
    });

    const resorts = operators.map((op: any) => ({
      ...op.resort,
      staffRole:   op.staffRole,
      liftsOpen:   op.resort.liftStatuses.filter((l: any) => l.status === 'open').length,
      totalLifts:  op.resort.liftStatuses.length,
      trailsOpen:  op.resort.trailStatuses.filter((t: any) => t.status === 'open' || t.status === 'groomed').length,
      totalTrails: op.resort.trailStatuses.length,
    }));

    return ok(resorts);
  } catch (e) {
    return handleError(e);
  }
}

// POST /api/resort — onboard a new resort
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = CreateResortSchema.parse(await req.json());

    const mountain = await prisma.mountain.findUnique({ where: { id: body.mountainId } });
    if (!mountain) return err('Mountain not found', 404);

    const existing = await prisma.resort.findUnique({ where: { mountainId: body.mountainId } });
    if (existing) return err('This mountain already has a resort account', 409);

    const slug = mountain.slug + '-ops';
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const result = await prisma.$transaction(async (tx: any) => {
      const resort = await tx.resort.create({
        data: {
          name: mountain.name, slug,
          mountainId: body.mountainId,
          plan: body.plan, planStatus: 'trial', trialEndsAt,
          email: body.contactEmail, phone: body.phone,
          baseElevFt: mountain.baseElevFt,
          summitElevFt: mountain.topElevFt,
          midElevFt: Math.round((mountain.baseElevFt + mountain.topElevFt) / 2),
        },
      });
      await tx.resortOperator.create({ data: { userId: user.id, resortId: resort.id, staffRole: 'owner' } });
      await tx.user.update({ where: { id: user.id }, data: { role: 'resort_admin', resortId: resort.id } });
      return resort;
    });

    const liftieSlugOverride = body.liftieSlug || deriveSlug(mountain.name);
    const seedResult = await seedLiftsFromLiftie(result.id, mountain.name, liftieSlugOverride);
    console.log('[Resort onboard] Lift seed result:', seedResult);

    return created({ resort: result, liftSeed: seedResult });
  } catch (e) {
    return handleError(e);
  }
}
