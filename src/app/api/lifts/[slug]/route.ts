// src/app/api/lifts/[slug]/route.ts
// Server-side proxy for liftie.info + persists stats to DB for score accuracy.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const CACHE_MIN = 2; // cache 2 minutes client-side

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!slug || slug.length > 60 || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'Invalid slug', lifts: [], stats: null }, { status: 400 });
  }

  // Optional mountainId for DB persistence
  const mountainId = req.nextUrl.searchParams.get('mountainId') ?? null;

  try {
    const res = await fetch(`https://liftie.info/api/resort/${slug}`, {
      headers: {
        'User-Agent': 'PowderIQ/1.0 (+https://powderiq.com; contact: hello@powderiq.com)',
        'Accept': 'application/json',
      },
      next: { revalidate: 120 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Resort not found on Liftie', lifts: [], stats: null },
        { status: 200 }
      );
    }

    const data = await res.json();

    // Liftie format: { lifts: { status: { "Name": "open"|"closed"|"hold"|"scheduled" }, stats: {...} } }
    const statusMap: Record<string, string> = data.lifts?.status ?? {};
    const stats = data.lifts?.stats ?? null;

    const lifts = Object.entries(statusMap).map(([name, status]: [string, any], i) => ({
      id:       `liftie-${i}`,
      liftName: name,
      liftType: inferType(name),
      status:   mapStatus(typeof status === 'string' ? status : status?.status ?? ''),
    }));

    // Persist Liftie stats to SnowSnapshot so scoreService can use them
    // This is the bridge between client-side Liftie and server-side scoring
    if (mountainId && stats) {
      try {
        await prisma.snowSnapshot.create({
          data: {
            mountainId,
            provider:  'liftie',
            payload:   { stats, liftCount: lifts.length } as object,
            expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4h
          },
        });

        // If lifts are open, delete any stale "closed" cached scores
        // so the next score request gets a fresh computation
        if ((stats.open ?? 0) > 0) {
          await prisma.mountainScore.deleteMany({
            where: {
              mountainId,
              score: 0,
            },
          });
        }
      } catch (e) {
        // Non-fatal — just log
        console.warn('[Liftie proxy] DB persist failed:', e);
      }
    }

    return NextResponse.json({ lifts, stats }, {
      headers: { 'Cache-Control': `public, max-age=${CACHE_MIN * 60}` },
    });
  } catch (e) {
    console.error('[Liftie proxy]', e);
    return NextResponse.json({ error: 'Failed to fetch', lifts: [], stats: null }, { status: 200 });
  }
}

function inferType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('gondola') || n.includes('cable car')) return 'gondola';
  if (n.includes('tram') || n.includes('aerial'))       return 'tram';
  if (n.includes('carpet') || n.includes('conveyor') ||
      n.includes('t-bar')  || n.includes('poma'))       return 'surface';
  return 'chairlift';
}

function mapStatus(s: string): string {
  switch (s?.toLowerCase()) {
    case 'open':      return 'open';
    case 'hold':
    case 'on_hold':   return 'on_hold';
    case 'scheduled': return 'scheduled';
    default:          return 'closed';
  }
}
