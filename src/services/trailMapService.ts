// src/services/trailMapService.ts
//
// Fetches ski trail + lift geometry from OpenStreetMap via Overpass API.
// Returns GeoJSON FeatureCollections for runs and lifts within a bounding box.
// Data is cached in the DB for 24 hours to avoid hammering Overpass.
//
// OSM tags used:
//   Trails: way["piste:type"="downhill"] — piste:difficulty, piste:name, piste:grooming
//   Lifts:  way["aerialway"]             — aerialway (gondola/chair/drag/etc), name
//
// Overpass bbox order: south, west, north, east

import { prisma } from '@/lib/prisma';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — OSM geometry rarely changes
const BBOX_PADDING_DEG = 0.04; // ~4km padding around resort center

export interface OSMRunFeature {
  type: 'Feature';
  geometry: { type: 'LineString' | 'Polygon'; coordinates: number[][] | number[][][] };
  properties: {
    osmId: number;
    name: string | null;
    difficulty: 'novice' | 'easy' | 'intermediate' | 'advanced' | 'expert' | 'freeride' | null;
    pisteType: string | null;
    grooming: string | null;
    lit: boolean;
    oneway: boolean;
  };
}

export interface OSMLiftFeature {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: number[][] };
  properties: {
    osmId: number;
    name: string | null;
    aerialwayType: string; // gondola | chair_lift | drag_lift | t-bar | magic_carpet | etc
    capacity: number | null;
    duration: string | null; // e.g. "8" (minutes)
  };
}

export interface ResortMapGeoJSON {
  runs: {
    type: 'FeatureCollection';
    features: OSMRunFeature[];
  };
  lifts: {
    type: 'FeatureCollection';
    features: OSMLiftFeature[];
  };
  bbox: [number, number, number, number]; // [south, west, north, east]
  fetchedAt: string;
  source: 'osm' | 'cache' | 'empty';
}

// ─── Overpass Query ───────────────────────────────────────────────────────────

function buildOverpassQuery(south: number, west: number, north: number, east: number): string {
  const bbox = `${south},${west},${north},${east}`;
  return `
[out:json][timeout:30];
(
  way["piste:type"="downhill"](${bbox});
  way["piste:type"="nordic"](${bbox});
  way["aerialway"](${bbox});
  way["aerialway"="gondola"](${bbox});
  way["aerialway"="chair_lift"](${bbox});
  way["aerialway"="drag_lift"](${bbox});
  way["aerialway"="t-bar"](${bbox});
  way["aerialway"="magic_carpet"](${bbox});
  way["aerialway"="rope_tow"](${bbox});
);
out body geom;
`.trim();
}

// ─── OSM → GeoJSON conversion ─────────────────────────────────────────────────

function osmDifficultyToStandard(diff: string | undefined): OSMRunFeature['properties']['difficulty'] {
  switch (diff) {
    case 'novice':       return 'novice';
    case 'easy':         return 'easy';
    case 'intermediate': return 'intermediate';
    case 'advanced':     return 'advanced';
    case 'expert':       return 'expert';
    case 'freeride':     return 'freeride';
    default:             return null;
  }
}

// Map OSM difficulty → PowderIQ Difficulty enum (for matching against TrailStatus)
export function osmDifficultyToAppDifficulty(osmDiff: string | null): string {
  switch (osmDiff) {
    case 'novice':
    case 'easy':         return 'green';
    case 'intermediate': return 'blue';
    case 'advanced':     return 'black';
    case 'expert':       return 'double_black';
    case 'freeride':     return 'backcountry';
    default:             return 'blue';
  }
}

function parseOSMWayToRun(element: any): OSMRunFeature | null {
  if (!element.geometry || element.geometry.length < 2) return null;

  const coords = element.geometry.map((pt: any) => [pt.lon, pt.lat]);
  const tags = element.tags || {};

  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: {
      osmId:      element.id,
      name:       tags.name || tags['piste:name'] || null,
      difficulty: osmDifficultyToStandard(tags['piste:difficulty']),
      pisteType:  tags['piste:type'] || null,
      grooming:   tags['piste:grooming'] || null,
      lit:        tags.lit === 'yes',
      oneway:     tags.oneway === 'yes',
    },
  };
}

function parseOSMWayToLift(element: any): OSMLiftFeature | null {
  if (!element.geometry || element.geometry.length < 2) return null;

  const coords = element.geometry.map((pt: any) => [pt.lon, pt.lat]);
  const tags = element.tags || {};

  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: {
      osmId:         element.id,
      name:          tags.name || null,
      aerialwayType: tags.aerialway || 'unknown',
      capacity:      tags['aerialway:capacity'] ? parseInt(tags['aerialway:capacity']) : null,
      duration:      tags['aerialway:duration'] || null,
    },
  };
}

function parseOverpassResponse(data: any): { runs: OSMRunFeature[]; lifts: OSMLiftFeature[] } {
  const runs: OSMRunFeature[] = [];
  const lifts: OSMLiftFeature[] = [];

  for (const element of data.elements || []) {
    if (element.type !== 'way') continue;
    const tags = element.tags || {};

    if (tags['piste:type']) {
      const run = parseOSMWayToRun(element);
      if (run) runs.push(run);
    } else if (tags.aerialway) {
      const lift = parseOSMWayToLift(element);
      if (lift) lifts.push(lift);
    }
  }

  return { runs, lifts };
}

// ─── Main exported function ───────────────────────────────────────────────────

export async function getResortMapGeoJSON(resortId: string): Promise<ResortMapGeoJSON> {
  // Check DB cache
  const resort = await prisma.resort.findUniqueOrThrow({
    where: { id: resortId },
    include: { mountain: true },
  });

  // Check if we have fresh cached map data
  if ((resort as any).mapGeoJSON && (resort as any).mapCacheExpiresAt) {
    const expiresAt = new Date((resort as any).mapCacheExpiresAt);
    if (expiresAt > new Date()) {
      const cached = (resort as any).mapGeoJSON as any;
      return { ...cached, source: 'cache' };
    }
  }

  const { mountain } = resort;
  const lat = mountain.latitude;
  const lon = mountain.longitude;

  // Build bounding box from mountain coords + elevation-based padding
  const elevRange = mountain.topElevFt - mountain.baseElevFt;
  const latPad = Math.max(BBOX_PADDING_DEG, elevRange / 200000); // larger resorts get bigger bbox
  const lonPad = latPad * 1.2;

  const bbox: [number, number, number, number] = [
    lat - latPad,
    lon - lonPad,
    lat + latPad,
    lon + lonPad,
  ];

  try {
    const query = buildOverpassQuery(...bbox);
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'PowderIQ/1.0 (resort-operator-platform; contact@powderiq.com)',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(35000),
    });

    if (!res.ok) throw new Error(`Overpass API ${res.status}`);

    const data = await res.json();
    const { runs, lifts } = parseOverpassResponse(data);

    const result: ResortMapGeoJSON = {
      runs:    { type: 'FeatureCollection', features: runs },
      lifts:   { type: 'FeatureCollection', features: lifts },
      bbox,
      fetchedAt: new Date().toISOString(),
      source: (runs.length + lifts.length > 0) ? 'osm' : 'empty',
    };

    // Cache in DB for 24 hours
    await prisma.$executeRawUnsafe(
      `UPDATE "Resort" SET "mapGeoJSON" = $1::jsonb, "mapCacheExpiresAt" = $2 WHERE id = $3`,
      JSON.stringify(result),
      new Date(Date.now() + CACHE_TTL_MS).toISOString(),
      resortId
    );

    console.log(`[TrailMapService] Fetched ${runs.length} runs + ${lifts.length} lifts for resort ${resortId}`);
    return result;

  } catch (err: any) {
    console.error('[TrailMapService] Overpass fetch failed:', err.message);
    // Return empty on error — map still renders with live status pins
    return {
      runs:  { type: 'FeatureCollection', features: [] },
      lifts: { type: 'FeatureCollection', features: [] },
      bbox,
      fetchedAt: new Date().toISOString(),
      source: 'empty',
    };
  }
}

// ─── Name-matching helper ─────────────────────────────────────────────────────
// Fuzzy-matches OSM feature names to PowderIQ lift/trail names
// so we can overlay live status onto OSM geometry.

export function matchOSMNameToStatus<T extends { liftName?: string; trailName?: string }>(
  osmName: string | null,
  statusRecords: T[]
): T | undefined {
  if (!osmName) return undefined;

  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const osmNorm = normalize(osmName);

  return statusRecords.find(r => {
    const name = r.liftName || r.trailName || '';
    const norm = normalize(name);
    return norm === osmNorm ||
      norm.includes(osmNorm) ||
      osmNorm.includes(norm) ||
      levenshtein(norm, osmNorm) <= 2;
  });
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}
