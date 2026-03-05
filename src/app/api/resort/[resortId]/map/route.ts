// src/app/api/resort/[resortId]/map/route.ts
// Returns merged map data: OSM geometry + live lift/trail statuses + weather pins.
// Public endpoint (no auth required) — safe for guest-facing pages too.

import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/apiResponse';
import { prisma } from '@/lib/prisma';
import {
  getResortMapGeoJSON,
  matchOSMNameToStatus,
  osmDifficultyToAppDifficulty,
} from '@/services/trailMapService';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ resortId: string }> }
) {
  try {
    const { resortId } = await context.params;

    // Fetch in parallel: OSM geometry + live statuses + weather zones
    const [mapGeoJSON, liftStatuses, trailStatuses, weatherZones, resort] =
      await Promise.all([
        getResortMapGeoJSON(resortId),
        prisma.liftStatus.findMany({
          where: { resortId },
          orderBy: { liftName: 'asc' },
        }),
        prisma.trailStatus.findMany({
          where: { resortId },
          orderBy: { trailName: 'asc' },
        }),
        prisma.elevationWeather.findMany({
          where: { resortId },
          orderBy: { zone: 'asc' },
        }),
        prisma.resort.findUnique({
          where: { id: resortId },
          select: {
            id: true,
            name: true,
            slug: true,
            baseElevFt: true,
            midElevFt: true,
            summitElevFt: true,
            // Map override fields (optional)
            customMapImageUrl: true,
            customMapBounds: true,
            customMapOpacity: true,
            // Cached map fields (optional)
            mapCacheExpiresAt: true,
          },
        }),
      ]);

    if (!resort) {
      return ok({
        resortId,
        map: null,
        lifts: [],
        trails: [],
        weatherZones: [],
        overlays: null,
      });
    }

    // Defensive: geojson might be null if cache/service fails
   const geo = mapGeoJSON as unknown as { features?: any[] } | null;
const features = geo?.features ?? [];

    // Build name lookup maps for status matching
    const liftByName = new Map(
      liftStatuses.map((l: any) => [l.liftName.toLowerCase(), l])
    );
    const trailByName = new Map(
      trailStatuses.map((t: any) => [t.trailName.toLowerCase(), t])
    );

    // Enrich OSM features with statuses + normalized difficulty
    const enrichedFeatures = features.map((f: any) => {
      const props = f.properties || {};
      const name = (props.name || props.ref || '').toString();
      const kind = (props.piste_type || props.kind || props.type || '').toString();

      // Determine if this is lift or trail-ish
      const isLift =
        props.aerialway ||
        kind === 'lift' ||
        kind === 'aerialway' ||
        props.lift ||
        props.way === 'aerialway';

      const isTrail =
        props.piste_type === 'downhill' ||
        props.piste_type === 'nordic' ||
        props.piste_type === 'sled' ||
        props.piste_type === 'hike' ||
        props.route === 'piste' ||
        kind === 'trail' ||
        props.piste;

      let status: any = null;
      let difficulty: any = null;

      if (name) {
        if (isLift) {
          const matched = matchOSMNameToStatus(name, liftByName);
          if (matched) status = matched;
        } else if (isTrail) {
          const matched = matchOSMNameToStatus(name, trailByName);
          if (matched) status = matched;
        }
      }

      // Normalize difficulty for trails
      if (isTrail) {
        const osmDiff = props.piste_difficulty || props.difficulty || props.color;
        difficulty = osmDifficultyToAppDifficulty(osmDiff);
      }

      return {
        ...f,
        properties: {
          ...props,
          displayName: name || props.id || 'Unnamed',
          isLift: Boolean(isLift),
          isTrail: Boolean(isTrail),
          status: status ? status.status : null,
          waitMinutes: status?.waitMinutes ?? null,
          updatedAt: status?.updatedAt ?? null,
          difficulty,
        },
      };
    });

    // Prepare overlays (custom trail map image), if the resort provided one
    const overlays =
      resort.customMapImageUrl && resort.customMapBounds
        ? {
            type: 'customMap',
            imageUrl: resort.customMapImageUrl,
            bounds: resort.customMapBounds,
            opacity: resort.customMapOpacity ?? 0.85,
          }
        : null;

    return ok({
      resort: {
        id: resort.id,
        name: resort.name,
        slug: resort.slug,
        baseElevFt: resort.baseElevFt,
        midElevFt: resort.midElevFt,
        summitElevFt: resort.summitElevFt,
      },
      map: {
        ...mapGeoJSON,
        features: enrichedFeatures,
      },
      lifts: liftStatuses,
      trails: trailStatuses,
      weatherZones,
      overlays,
    });
  } catch (e) {
    return handleError(e);
  }
}