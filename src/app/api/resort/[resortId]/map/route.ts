// src/app/api/resort/[resortId]/map/route.ts
// Returns merged map data: OSM geometry + live lift/trail statuses + weather pins.
// Public endpoint (no auth required) — safe for guest-facing pages too.

import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/apiResponse';
import { prisma } from '@/lib/prisma';
import { fetchSkimapImage } from '@/lib/skimap';
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
            customMapImageUrl: true,
            customMapBounds: true,
            customMapOpacity: true,
            mapCacheExpiresAt: true,
            mountain: {
              select: {
                latitude: true,
                longitude: true,
                skimapAreaId: true,
              },
            },
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

    const geo = mapGeoJSON as unknown as { features?: any[] } | null;
    const features = geo?.features ?? [];

    const liftByName = new Map<string, any>(
      liftStatuses.map((l: any) => [l.liftName.toLowerCase(), l])
    );
    const trailByName = new Map<string, any>(
      trailStatuses.map((t: any) => [t.trailName.toLowerCase(), t])
    );

    const enrichedFeatures = features.map((f: any) => {
      const props = f.properties || {};
      const name = (props.name || props.ref || '').toString();
      const kind = (props.piste_type || props.kind || props.type || '').toString();

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

    // Resolve trail map image:
    // 1. Resort's manually uploaded custom map (highest priority)
    // 2. Most recent map from skimap.org (automatic fallback)
    let overlays = null;

    if (resort.customMapImageUrl && resort.customMapBounds) {
      overlays = {
        type: 'customMap',
        imageUrl: resort.customMapImageUrl,
        bounds: resort.customMapBounds,
        opacity: resort.customMapOpacity ?? 0.85,
      };
    } else if (resort.mountain?.skimapAreaId) {
      const skimapImageUrl = await fetchSkimapImage(resort.mountain.skimapAreaId);
      if (skimapImageUrl) {
        overlays = {
          type: 'skimapImage',
          imageUrl: skimapImageUrl,
          skimapAreaId: resort.mountain.skimapAreaId,
        };
      }
    }

    return ok({
      resort: {
        id: resort.id,
        name: resort.name,
        slug: resort.slug,
        baseElevFt: resort.baseElevFt,
        midElevFt: resort.midElevFt,
        summitElevFt: resort.summitElevFt,
        mountain: resort.mountain,
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
