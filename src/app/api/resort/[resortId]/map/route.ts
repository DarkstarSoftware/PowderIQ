// src/app/api/resort/[resortId]/map/route.ts
// Returns merged map data: OSM geometry + live lift/trail statuses + weather pins.
// Public endpoint (no auth required) — safe for guest-facing pages too.

import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/apiResponse';
import { prisma } from '@/lib/prisma';
import { getResortMapGeoJSON, matchOSMNameToStatus, osmDifficultyToAppDifficulty } from '@/services/trailMapService';

export async function GET(
  req: NextRequest,
  { params }: { params: { resortId: string } }
) {
  try {
    const { resortId } = params;

    // Fetch in parallel: OSM geometry + live statuses + weather zones
    const [mapGeoJSON, liftStatuses, trailStatuses, weatherZones, resort] = await Promise.all([
      getResortMapGeoJSON(resortId),
      prisma.liftStatus.findMany({ where: { resortId } }),
      prisma.trailStatus.findMany({ where: { resortId } }),
      prisma.elevationWeather.findMany({ where: { resortId } }),
      prisma.resort.findUniqueOrThrow({
        where: { id: resortId },
        include: { mountain: true },
      }),
    ]);

    // ── Enrich lift features with live status ─────────────────────────────────
    const enrichedLifts = mapGeoJSON.lifts.features.map(feature => {
      const match = matchOSMNameToStatus(feature.properties.name, liftStatuses.map(l => ({ ...l, liftName: l.liftName })));
      return {
        ...feature,
        properties: {
          ...feature.properties,
          // Live status from PowderIQ DB
          status:      match?.status ?? null,
          waitMinutes: match?.waitMinutes ?? null,
          dbId:        match?.id ?? null,
          // Display helpers
          statusColor: liftStatusColor(match?.status ?? null),
          statusLabel: match ? match.status.replace('_', ' ') : 'unknown',
        },
      };
    });

    // Add any DB lifts that didn't match OSM geometry (show as point markers at resort center)
    const matchedOSMNames = new Set(
      enrichedLifts.map(f => f.properties.name?.toLowerCase()).filter(Boolean)
    );
    const unmatchedLifts = liftStatuses.filter(l => {
      const norm = l.liftName.toLowerCase();
      return ![...matchedOSMNames].some(m => m?.includes(norm) || norm.includes(m ?? ''));
    });

    // ── Enrich trail features with live status ────────────────────────────────
    const enrichedTrails = mapGeoJSON.runs.features.map(feature => {
      const match = matchOSMNameToStatus(feature.properties.name, trailStatuses.map(t => ({ ...t, trailName: t.trailName })));
      const appDifficulty = match?.difficulty ?? osmDifficultyToAppDifficulty(feature.properties.difficulty);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          status:       match?.status ?? null,
          snowDepthIn:  match?.snowDepthIn ?? null,
          groomedAt:    match?.groomedAt ?? null,
          appDifficulty,
          dbId:         match?.id ?? null,
          // Display helpers
          trailColor:   trailDifficultyColor(appDifficulty, match?.status ?? null),
          strokeWeight: match?.status === 'groomed' ? 4 : 3,
          dashArray:    match?.status === 'closed' ? '6,4' : null,
        },
      };
    });

    // ── Weather pins at summit / mid / base ───────────────────────────────────
    const { mountain } = resort;
    const baseElev  = resort.baseElevFt  || mountain.baseElevFt;
    const summitElev = resort.summitElevFt || mountain.topElevFt;
    const midElev   = resort.midElevFt   || Math.round((baseElev + summitElev) / 2);
    const elevRange = summitElev - baseElev;
    const latDelta  = elevRange / 364000;

    const weatherPins = weatherZones.map(zone => {
      const pinLat = zone.zone === 'summit'
        ? mountain.latitude + latDelta
        : zone.zone === 'mid'
        ? mountain.latitude + latDelta * 0.5
        : mountain.latitude;

      return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [mountain.longitude, pinLat] },
        properties: {
          zone:         zone.zone,
          elevFt:       zone.elevFt,
          tempF:        zone.tempF,
          feelsLikeF:   zone.feelsLikeF,
          windMph:      zone.windMph,
          windGustMph:  zone.windGustMph,
          windDir:      zone.windDir,
          conditionDesc: zone.conditionDesc,
          snowfall24hIn: zone.snowfall24hIn,
          snowDepthIn:  zone.snowDepthIn,
          forecastHigh: zone.forecastHigh,
          forecastLow:  zone.forecastLow,
          windHold:     (zone.windMph ?? 0) > 35,
        },
      };
    });

    // ── Unmatched lifts as point markers ──────────────────────────────────────
    const unmatchedLiftPoints = unmatchedLifts.map((lift, i) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        // Spread them slightly north of resort center so they're visible
        coordinates: [mountain.longitude + (i * 0.002), mountain.latitude + 0.01],
      },
      properties: {
        osmId:        null,
        name:         lift.liftName,
        aerialwayType: lift.liftType,
        status:       lift.status,
        waitMinutes:  lift.waitMinutes,
        statusColor:  liftStatusColor(lift.status),
        statusLabel:  lift.status.replace('_', ' '),
        dbId:         lift.id,
        isUnmatched:  true,
      },
    }));

    // ── Summary stats ─────────────────────────────────────────────────────────
    const summary = {
      lifts: {
        total:     liftStatuses.length,
        open:      liftStatuses.filter(l => l.status === 'open').length,
        on_hold:   liftStatuses.filter(l => l.status === 'on_hold').length,
        scheduled: liftStatuses.filter(l => l.status === 'scheduled').length,
        closed:    liftStatuses.filter(l => l.status === 'closed').length,
        osmMatched: enrichedLifts.filter(f => f.properties.dbId).length,
      },
      trails: {
        total:     trailStatuses.length,
        open:      trailStatuses.filter(t => t.status === 'open').length,
        groomed:   trailStatuses.filter(t => t.status === 'groomed').length,
        closed:    trailStatuses.filter(t => t.status === 'closed').length,
        osmRuns:   enrichedTrails.length,
        osmMatched: enrichedTrails.filter(f => f.properties.dbId).length,
      },
      osmSource: mapGeoJSON.source,
      osmFetchedAt: mapGeoJSON.fetchedAt,
    };

    return ok({
      resort: {
        id:   resort.id,
        name: resort.name,
        plan: resort.plan,
        customMap: resort.customMapImageUrl ? {
          imageUrl:  resort.customMapImageUrl,
          bounds:    resort.customMapBounds,   // [[s,w],[n,e]]
          opacity:   resort.customMapOpacity ?? 0.85,
        } : null,
        mountain: {
          name:      mountain.name,
          latitude:  mountain.latitude,
          longitude: mountain.longitude,
          baseElevFt,
          summitElevFt,
          midElevFt,
        },
      },
      bbox: mapGeoJSON.bbox,
      layers: {
        trails:        { type: 'FeatureCollection', features: enrichedTrails },
        lifts:         { type: 'FeatureCollection', features: enrichedLifts },
        liftPoints:    { type: 'FeatureCollection', features: unmatchedLiftPoints },
        weatherPins:   { type: 'FeatureCollection', features: weatherPins },
      },
      summary,
    });
  } catch (e) {
    return handleError(e);
  }
}

// ─── Color helpers (used by frontend for consistent styling) ──────────────────

function liftStatusColor(status: string | null): string {
  switch (status) {
    case 'open':      return '#10b981'; // emerald
    case 'on_hold':   return '#f59e0b'; // amber
    case 'scheduled': return '#3b82f6'; // blue
    case 'closed':    return '#ef4444'; // red
    default:          return '#6b7280'; // gray (unknown)
  }
}

function trailDifficultyColor(difficulty: string, status: string | null): string {
  if (status === 'closed') return '#ef4444'; // red = closed regardless of difficulty
  switch (difficulty) {
    case 'green':        return '#22c55e';
    case 'blue':         return '#3b82f6';
    case 'black':        return '#e2e8f0';
    case 'double_black': return '#cbd5e1';
    case 'terrain_park': return '#f97316';
    case 'backcountry':  return '#fbbf24';
    default:             return '#6b7280';
  }
}
