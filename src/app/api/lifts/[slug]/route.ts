// src/app/api/lifts/[slug]/route.ts
// Server-side proxy for liftie.info — bypasses CORS restrictions.
// Usage: GET /api/lifts/steamboat

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug || slug.length > 60 || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://liftie.info/api/resort/${slug}`, {
      headers: {
        'User-Agent': 'PowderIQ/1.0 (+https://powderiq.com; contact: hello@powderiq.com)',
        'Accept': 'application/json',
      },
      next: { revalidate: 120 }, // cache 2 minutes
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Resort not found', lifts: [] }, { status: 200 });
    }

    const data = await res.json();

    // Liftie returns { lifts: { "Lift Name": { status, stats } } } or array
    // Normalize to array format
    let lifts: { id: string; liftName: string; liftType: string; status: string; waitMinutes?: number }[] = [];

    if (Array.isArray(data.lifts)) {
      lifts = data.lifts.map((l: any, i: number) => ({
        id: `liftie-${i}`,
        liftName: l.name ?? l.title ?? `Lift ${i + 1}`,
        liftType: inferType(l.name ?? ''),
        status: mapStatus(l.status ?? ''),
        waitMinutes: l.wait ?? undefined,
      }));
    } else if (data.lifts && typeof data.lifts === 'object') {
      // Object format: { "Lift Name": { status: "open" } }
      lifts = Object.entries(data.lifts).map(([name, info]: [string, any], i) => ({
        id: `liftie-${i}`,
        liftName: name,
        liftType: inferType(name),
        status: mapStatus(info?.status ?? info?.state ?? ''),
        waitMinutes: info?.wait ?? undefined,
      }));
    }

    return NextResponse.json({ lifts }, {
      headers: { 'Cache-Control': 'public, max-age=120' },
    });
  } catch (e) {
    console.error('[Liftie proxy]', e);
    return NextResponse.json({ error: 'Failed to fetch lift status', lifts: [] }, { status: 200 });
  }
}

function inferType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('gondola') || n.includes('cable car')) return 'gondola';
  if (n.includes('tram') || n.includes('aerial')) return 'tram';
  if (n.includes('carpet') || n.includes('conveyor') || n.includes('t-bar') || n.includes('poma')) return 'surface';
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
