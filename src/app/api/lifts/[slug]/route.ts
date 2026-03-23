// src/app/api/lifts/[slug]/route.ts
// Server-side proxy for liftie.info — bypasses CORS restrictions.
// Liftie API format: { lifts: { status: { "Lift Name": "open"|"closed"|"hold"|"scheduled" }, stats: { open, hold, scheduled, closed } } }

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug || slug.length > 60 || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'Invalid slug', lifts: [], stats: null }, { status: 400 });
  }

  try {
    const res = await fetch(`https://liftie.info/api/resort/${slug}`, {
      headers: {
        'User-Agent': 'PowderIQ/1.0 (+https://powderiq.com; contact: hello@powderiq.com)',
        'Accept': 'application/json',
      },
      next: { revalidate: 120 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Resort not found', lifts: [], stats: null }, { status: 200 });
    }

    const data = await res.json();

    // Liftie format: { lifts: { status: { "Name": "open" }, stats: { open, hold, scheduled, closed } } }
    const statusMap: Record<string, string> = data.lifts?.status ?? {};
    const stats = data.lifts?.stats ?? null;

    const lifts = Object.entries(statusMap).map(([name, status]: [string, any], i) => ({
      id: `liftie-${i}`,
      liftName: name,
      liftType: inferType(name),
      status: mapStatus(typeof status === 'string' ? status : status?.status ?? ''),
    }));

    return NextResponse.json({ lifts, stats }, {
      headers: { 'Cache-Control': 'public, max-age=120' },
    });
  } catch (e) {
    console.error('[Liftie proxy]', e);
    return NextResponse.json({ error: 'Failed to fetch lift status', lifts: [], stats: null }, { status: 200 });
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
