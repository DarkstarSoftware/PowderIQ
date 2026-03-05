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

// Bounds: [[southLat, westLon], [northLat, eastLon]]
// Must bracket the mountain bounding box — validated server-side
const BoundsSchema = z.tuple([
  z.tuple([z.number(), z.number()]),
  z.tuple([z.number(), z.number()]),
]);

const PatchSchema = z.object({
  customMapImageUrl: z.string().url().optional().nullable(),
  customMapBounds:   BoundsSchema.optional().nullable(),
  customMapOpacity:  z.number().min(0.1).max(1.0).optional(),
});

// GET — public, returns enough for the map component to render
export async function GET(
  _req: NextRequest,
  { params }: { params: { resortId: string } }
) {
  try {
    const resort = await prisma.resort.findUniqueOrThrow({
      where:  { id: params.resortId },
      select: {
        id: true,
        customMapImageUrl: true,
        customMapBounds:   true,
        customMapOpacity:  true,
        baseElevFt:   true,
        midElevFt:    true,
        summitElevFt: true,
        mountain: { select: { latitude: true, longitude: true } },
      },
    });

    return ok({
      customMap: resort.customMapImageUrl ? {
        imageUrl: resort.customMapImageUrl,
        bounds:   resort.customMapBounds,
        opacity:  resort.customMapOpacity,
      } : null,
      suggestedBounds: computeSuggestedBounds(
        resort.mountain.latitude,
        resort.mountain.longitude,
        resort.baseElevFt,
        resort.summitElevFt,
      ),
    });
  } catch (e) {
    return handleError(e);
  }
}

// PATCH — set custom map image (manager+ only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { resortId: string } }
) {
  try {
    await requireResortAccess(req, params.resortId, 'manager');
    const body = PatchSchema.parse(await req.json());

    // If providing image, bounds are required
    if (body.customMapImageUrl && !body.customMapBounds) {
      return handleError(
        new Error('customMapBounds [[s,w],[n,e]] required when setting a custom map image'),
        400
      );
    }

    // Validate bounds make geographic sense
    if (body.customMapBounds) {
      const [[s, w], [n, e]] = body.customMapBounds;
      if (n <= s) return handleError(new Error('North bound must be greater than south bound'), 400);
      if (e <= w) return handleError(new Error('East bound must be greater than west bound'), 400);
      // Sanity — bounds shouldn't be wider than ~1 degree (~100km)
      if ((n - s) > 0.5 || (e - w) > 0.5) {
        return handleError(new Error('Bounds span too large — must be within ~50km'), 400);
      }
    }

    const resort = await prisma.resort.update({
      where: { id: params.resortId },
      data:  {
        customMapImageUrl: body.customMapImageUrl ?? undefined,
        customMapBounds:   body.customMapBounds   ?? undefined,
        customMapOpacity:  body.customMapOpacity  ?? undefined,
      },
      select: { customMapImageUrl: true, customMapBounds: true, customMapOpacity: true },
    });

    return ok({
      updated: true,
      customMap: resort.customMapImageUrl ? {
        imageUrl: resort.customMapImageUrl,
        bounds:   resort.customMapBounds,
        opacity:  resort.customMapOpacity,
      } : null,
    });
  } catch (e) {
    return handleError(e);
  }
}

// DELETE — remove custom map, fall back to OSM satellite
export async function DELETE(
  req: NextRequest,
  { params }: { params: { resortId: string } }
) {
  try {
    await requireResortAccess(req, params.resortId, 'manager');
    await prisma.resort.update({
      where: { id: params.resortId },
      data:  { customMapImageUrl: null, customMapBounds: null },
    });
    return ok({ cleared: true });
  } catch (e) {
    return handleError(e);
  }
}

// ─── Helper: compute a reasonable bounding box from elevation + center ─────────

function computeSuggestedBounds(
  lat: number,
  lon: number,
  baseElevFt: number,
  summitElevFt: number,
): [[number, number], [number, number]] {
  const elevRange = summitElevFt - baseElevFt;
  const pad = Math.max(0.025, elevRange / 180000); // ~1.4km per 1000ft vert
  return [
    [parseFloat((lat - pad).toFixed(5)), parseFloat((lon - pad * 1.3).toFixed(5))],
    [parseFloat((lat + pad).toFixed(5)), parseFloat((lon + pad * 1.3).toFixed(5))],
  ];
}
