// src/app/api/mountains/[id]/trails/geojson/route.ts
// Returns OSM trail+lift GeoJSON for the map — served from DB cache.
// This is what MapboxMap fetches instead of hitting Overpass directly.
// Cache TTL: 24h (trail geometry doesn't change)
// First request: fetches Overpass server-side and caches
// Subsequent requests: returns from DB in <50ms

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const BBOX_PAD     = 0.045;
const OVERPASS     = 'https://overpass-api.de/api/interpreter';

function buildQuery(s: number, w: number, n: number, e: number) {
  return `[out:json][timeout:30];
(
  way["piste:type"~"downhill|nordic|snow_park|terrain_park"](${s},${w},${n},${e});
  way["aerialway"~"gondola|chair_lift|drag_lift|t-bar|magic_carpet|rope_tow|cable_car|mixed_lift"](${s},${w},${n},${e});
);
out body geom;`;
}

function parseOverpass(data: any) {
  const runs: any[] = [], lifts: any[] = [];
  for (const el of data.elements ?? []) {
    if (el.type !== 'way' || !el.geometry?.length) continue;
    const coords = el.geometry.map((p: any) => [p.lon, p.lat]);
    const t = el.tags ?? {};
    if (t['piste:type']) {
      runs.push({ type: 'Feature',
        geometry:   { type: 'LineString', coordinates: coords },
        properties: {
          name:       t.name ?? t['piste:name'] ?? '',
          difficulty: t['piste:difficulty'] ?? 'easy',
          grooming:   t['piste:grooming']   ?? '',
          pisteType:  t['piste:type'],
        },
      });
    } else if (t.aerialway) {
      lifts.push({ type: 'Feature',
        geometry:   { type: 'LineString', coordinates: coords },
        properties: {
          name:      t.name ?? '',
          aerialway: t.aerialway,
        },
      });
    }
  }
  return {
    runs:  { type: 'FeatureCollection', features: runs  },
    lifts: { type: 'FeatureCollection', features: lifts },
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const mountain = await prisma.mountain.findUnique({
      where: { id },
      select: { latitude: true, longitude: true },
    });
    if (!mountain) {
      return NextResponse.json({ runs: { type:'FeatureCollection',features:[] },
        lifts: { type:'FeatureCollection',features:[] } }, { status: 404 });
    }

    const now = new Date();

    // ── Serve from cache ──────────────────────────────────────────────────
    const cached = await prisma.snowSnapshot.findFirst({
      where: { mountainId: id, provider: 'osm-geojson', expiresAt: { gt: now } },
      orderBy: { fetchedAt: 'desc' },
    });
    if (cached) {
      return NextResponse.json(cached.payload, {
        headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
      });
    }

    // ── Fetch from Overpass server-side ───────────────────────────────────
    const { latitude: lat, longitude: lon } = mountain;
    const s = lat - BBOX_PAD, n = lat + BBOX_PAD;
    const w = lon - BBOX_PAD, e = lon + BBOX_PAD;

    const res = await fetch(OVERPASS, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    `data=${encodeURIComponent(buildQuery(s, w, n, e))}`,
      signal:  AbortSignal.timeout(30_000),
    });

    if (!res.ok) throw new Error(`Overpass ${res.status}`);
    const geo = parseOverpass(await res.json());

    // ── Cache result ──────────────────────────────────────────────────────
    if (geo.runs.features.length > 0 || geo.lifts.features.length > 0) {
      await prisma.snowSnapshot.create({
        data: {
          mountainId: id,
          provider:   'osm-geojson',
          payload:    geo as any,
          expiresAt:  new Date(now.getTime() + CACHE_TTL_MS),
        },
      });
    }

    return NextResponse.json(geo, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    });

  } catch (err: any) {
    console.error('[trails/geojson]', err?.message);
    // Return empty — map will render without trails rather than hanging
    return NextResponse.json(
      { runs: { type:'FeatureCollection',features:[] }, lifts: { type:'FeatureCollection',features:[] } },
      { headers: { 'Cache-Control': 'public, max-age=60' } }
    );
  }
}
