// src/app/api/resort/[resortId]/map-settings/route.ts
//
// GET  — return current map settings (custom image URL + bounds)
// PATCH — update custom trail map image settings (manager+ only)
// DELETE — clear custom map, revert to OSM

import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/apiResponse';
import { requireResortAccess } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

const BoundsSchema = z.tuple([
  z.tuple([z.number(), z.number()]),
  z.tuple([z.number(), z.number()]),
]);

const PatchSchema = z.object({
  customMapImageUrl: z.string().url().optional().nullable(),
  customMapBounds: BoundsSchema.optional().nullable(),
  customMapOpacity: z.number().min(0.1).max(1.0).optional(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ resortId: string }> }
) {
  try {
    const { resortId } = await context.params;

    const resort = await prisma.resort.findUniqueOrThrow({
      where: { id: resortId },
      select: {
        id: true,
        customMapImageUrl: true,
        customMapBounds: true,
        customMapOpacity: true,
        baseElevFt: true,
        midElevFt: true,
        summitElevFt: true,
        mountain: { select: { latitude: true, longitude: true } },
      },
    });

    return ok({
      customMap: resort.customMapImageUrl
        ? {
            imageUrl: resort.customMapImageUrl,
            bounds: resort.customMapBounds,
            opacity: resort.customMapOpacity,
          }
        : null,
    });
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

    await requireResortAccess(req, resortId, 'manager');

    const body = PatchSchema.parse(await req.json());

    const resort = await prisma.resort.update({
      where: { id: resortId },
      data: {
        customMapImageUrl: body.customMapImageUrl ?? undefined,
        customMapBounds: body.customMapBounds ?? undefined,
        customMapOpacity: body.customMapOpacity ?? undefined,
      },
    });

    return ok(resort);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ resortId: string }> }
) {
  try {
    const { resortId } = await context.params;

    await requireResortAccess(req, resortId, 'manager');

// ...

await prisma.resort.update({
  where: { id: resortId },
  data: {
    customMapImageUrl: null,
    customMapBounds: Prisma.DbNull as any,
  },
});

    return ok({ removed: true });
  } catch (e) {
    return handleError(e);
  }
}