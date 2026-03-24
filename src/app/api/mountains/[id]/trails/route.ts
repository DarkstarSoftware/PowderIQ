// src/app/api/mountains/[id]/trails/route.ts
//
// Returns trail list for any mountain using OSM/Overpass as the source.
// Works for ALL mountains — not just those with resort accounts.
// Results cached in SnowSnapshot table (re-using the Json payload field)
// with a 24h TTL so we don't hammer Overpass.
//
// Response shape:
// { data: { trails: Trail[], source: 'osm'|'cache'|'empty' } }

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const CACHE_TTL_MS  = 24 * 60 * 60 * 1000;  // 24h — trail names don't change often
const OVERPASS_URL  = 'https://overpass-api.de/api/interpreter';
const BBOX_PAD      = 0.045;  // ~5km — large enough for most resorts

export interface TrailItem {
  id: string;
  trailName: string;
  difficulty: 'green' | 'blue' | 'black' | 'double_black' | 'terrain_park' | 'backcountry';
  status: 'open' | 'groomed' | 'closed';
  snowDepthIn?: number;
  grooming?: string | null;
  zone?: string;
}

// OSM piste:difficulty → our difficulty enum
function mapDifficulty(osmDiff: string | null, pisteType: string | null): TrailItem['difficulty'] {
  if (pisteType === 'nordic' || pisteType === 'backcountry') return 'backcountry';
  if (pisteType === 'snow_park' || pisteType === 'terrain_park') return 'terrain_park';
  switch (osmDiff?.toLowerCase()) {
    case 'novice':
    case 'easy':        return 'green';
    case 'intermediate': return 'blue';
    case 'advanced':
    case 'difficult':   return 'black';
    case 'expert':
    case 'freeride':    return 'double_black';
    default:            return 'blue';
  }
}

// Grooming tag → status
function mapStatus(grooming: string | null): TrailItem['status'] {
  if (!grooming) return 'open';
  if (grooming.includes('groomed') || grooming === 'yes') return 'groomed';
  return 'open';
}

function buildQuery(south: number, west: number, north: number, east: number): string {
  const bbox = `${south},${west},${north},${east}`;
  return `[out:json][timeout:25];
(
  way["piste:type"~"downhill|nordic|snow_park|terrain_park"](${bbox});
  relation["piste:type"~"downhill|nordic|snow_park|terrain_park"](${bbox});
);
out tags;`;
}

async function fetchFromOverpass(lat: number, lon: number): Promise<TrailItem[]> {
  const s = lat - BBOX_PAD, n = lat + BBOX_PAD;
  const w = lon - BBOX_PAD, e = lon + BBOX_PAD;

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(buildQuery(s, w, n, e))}`,
    signal: AbortSignal.timeout(28_000),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);

  const data = await res.json();
  const trails: TrailItem[] = [];
  const seen = new Set<string>();

  for (const el of data.elements ?? []) {
    const tags = el.tags ?? {};
    const name = tags.name || tags['piste:name'] || null;
    if (!name) continue;                   // skip unnamed features
    const key = name.toLowerCase().trim();
    if (seen.has(key)) continue;           // deduplicate by name
    seen.add(key);

    trails.push({
      id: `osm-${el.type}-${el.id}`,
      trailName: name,
      difficulty: mapDifficulty(tags['piste:difficulty'], tags['piste:type']),
      status: mapStatus(tags['piste:grooming']),
      grooming: tags['piste:grooming'] ?? null,
      zone: tags['area'] ?? tags['piste:area'] ?? undefined,
    });
  }

  // Sort: groomed first, then by difficulty order
  const DIFF_ORDER: Record<string, number> = { green:0, blue:1, black:2, double_black:3, terrain_park:4, backcountry:5 };
  trails.sort((a, b) => {
    if (a.status === 'groomed' && b.status !== 'groomed') return -1;
    if (b.status === 'groomed' && a.status !== 'groomed') return  1;
    return (DIFF_ORDER[a.difficulty] ?? 9) - (DIFF_ORDER[b.difficulty] ?? 9);
  });

  return trails;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const mountain = await prisma.mountain.findUnique({
      where: { id },
      select: { id:true, latitude:true, longitude:true, name:true },
    });
    if (!mountain) {
      return NextResponse.json({ error:'Mountain not found' }, { status:404 });
    }

    const cacheKey = `trails:${id}`;
    const now = new Date();

    // 1. Check cache (reuse SnowSnapshot table with provider='osm-trails')
    const cached = await prisma.snowSnapshot.findFirst({
      where: { mountainId: id, provider: 'osm-trails', expiresAt: { gt: now } },
      orderBy: { fetchedAt: 'desc' },
    });
    if (cached) {
      const payload = cached.payload as unknown as { trails: TrailItem[] };
      return NextResponse.json({
        data: { trails: payload.trails ?? [], source: 'cache' },
      }, { headers: { 'Cache-Control': 'public, max-age=3600' } });
    }

    // 2. Try resort's existing TrailStatus records (resort accounts)
    const resort = await prisma.resort.findFirst({
      where: { mountainId: id },
      select: { id: true, trailStatuses: { select: {
        id:true, trailName:true, difficulty:true,
        status:true, snowDepthIn:true, zone:true,
      }}},
    });

    if (resort && resort.trailStatuses.length > 0) {
      const trails: TrailItem[] = resort.trailStatuses.map(t => ({
        id: t.id,
        trailName: t.trailName,
        difficulty: (t.difficulty as TrailItem['difficulty']) ?? 'blue',
        status: (t.status === 'groomed' ? 'groomed' : t.status === 'open' ? 'open' : 'closed') as TrailItem['status'],
        snowDepthIn: t.snowDepthIn ?? undefined,
        zone: t.zone ?? undefined,
      }));

      return NextResponse.json({ data: { trails, source: 'resort' } });
    }

    // 3. Fetch from Overpass OSM
    const trails = await fetchFromOverpass(mountain.latitude, mountain.longitude);

    // Cache result
    if (trails.length > 0) {
      await prisma.snowSnapshot.create({
        data: {
          mountainId: id,
          provider: 'osm-trails',
          payload: { trails } as any,
          expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
        },
      });
    }

    return NextResponse.json({
      data: { trails, source: trails.length > 0 ? 'osm' : 'empty' },
    }, { headers: { 'Cache-Control': 'public, max-age=3600' } });

  } catch (err: any) {
    console.error('[trails route]', err?.message ?? err);
    return NextResponse.json({ data: { trails:[], source:'empty' } }, { status: 200 });
  }
}
