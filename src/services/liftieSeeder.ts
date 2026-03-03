// src/services/liftieSeeder.ts
// Seeds lift names + statuses from liftie.info on resort onboarding.
// No API key needed. Covers ~400 resorts worldwide.

import { prisma } from '@/lib/prisma';

const LIFTIE_BASE = 'https://liftie.info/api/resort';

const KNOWN_SLUGS: Record<string, string> = {
  'vail': 'vail', 'beaver creek': 'beavercreek', 'breckenridge': 'breck',
  'keystone': 'keystone', 'arapahoe basin': 'abasin', 'copper mountain': 'copper',
  'steamboat': 'steamboat', 'winter park': 'winterpark', 'park city': 'parkcity',
  'deer valley': 'deervalley', 'alta': 'alta', 'snowbird': 'snowbird',
  'jackson hole': 'jacksonhole', 'big sky': 'bigsky', 'mammoth mountain': 'mammoth',
  'heavenly': 'heavenly', 'northstar': 'northstar', 'kirkwood': 'kirkwood',
  'palisades tahoe': 'squaw', 'squaw valley': 'squaw', 'stowe': 'stowe',
  'killington': 'killington', 'sugarbush': 'sugarbush', 'sunday river': 'sundayriver',
  'sugarloaf': 'sugarloaf', 'whiteface': 'whiteface', 'hunter mountain': 'hunter',
  'okemo': 'okemo', 'mount snow': 'mountsnow', 'stratton': 'stratton',
  'loon mountain': 'loon', 'waterville valley': 'waterville', 'cannon mountain': 'cannon',
  'jay peak': 'jaypeak', 'mont tremblant': 'tremblant', 'sun valley': 'sunvalley',
  'taos ski valley': 'taos', 'aspen mountain': 'aspen', 'snowmass': 'snowmass',
  'buttermilk': 'buttermilk', 'aspen highlands': 'highlands', 'crested butte': 'crestedbutte',
  'telluride': 'telluride', 'wolf creek': 'wolfcreek', 'loveland': 'loveland',
  'eldora': 'eldora', 'monarch': 'monarch', 'purgatory': 'purgatory',
  'crystal mountain': 'crystalmountain', 'mt. bachelor': 'mtbachelor',
  'mount hood meadows': 'meadows', 'timberline lodge': 'timberline',
  'stevens pass': 'stevens', 'snoqualmie': 'snoqualmie',
  'whistler blackcomb': 'whistler', 'sun peaks': 'sunpeaks', 'big white': 'bigwhite',
  'revelstoke': 'revelstoke', 'fernie': 'fernie', 'kicking horse': 'kickinghorse',
  'lake louise': 'lakelouise', 'banff sunshine': 'sunshine',
};

function inferLiftType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('gondola') || n.includes('cable car')) return 'gondola';
  if (n.includes('tram') || n.includes('aerial')) return 'tram';
  if (n.includes('carpet') || n.includes('conveyor') || n.includes('t-bar') || n.includes('poma')) return 'surface';
  return 'chairlift';
}

function mapStatus(s: string): 'open' | 'on_hold' | 'closed' | 'scheduled' {
  switch (s?.toLowerCase()) {
    case 'open': return 'open';
    case 'hold': return 'on_hold';
    case 'scheduled': return 'scheduled';
    default: return 'closed';
  }
}

export function deriveSlug(name: string): string {
  const lower = name.toLowerCase().trim();
  if (KNOWN_SLUGS[lower]) return KNOWN_SLUGS[lower];
  return lower
    .replace(/\s*(ski resort|mountain resort|ski area|resort|ski|mtn\.?)\s*/g, '')
    .replace(/[^a-z0-9]+/g, '').trim();
}

export interface LiftieSeedResult {
  resortId: string;
  liftsSeeded: number;
  liftieSlug: string;
  source: 'liftie' | 'none';
  error?: string;
}

/** Seeds lifts from liftie.info. Safe to re-run (upserts). */
export async function seedLiftsFromLiftie(
  resortId: string,
  mountainName: string,
  customSlug?: string
): Promise<LiftieSeedResult> {
  const liftieSlug = customSlug || deriveSlug(mountainName);

  try {
    const res = await fetch(`${LIFTIE_BASE}/${liftieSlug}`, {
      headers: { 'User-Agent': 'PowderIQ/1.0 resort-operator-platform' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return { resortId, liftsSeeded: 0, liftieSlug, source: 'none', error: `Liftie ${res.status} for "${liftieSlug}"` };
    }

    const data = await res.json();
    const liftsRaw = data.lifts as Record<string, { status: string } | string> | undefined;

    if (!liftsRaw || Object.keys(liftsRaw).length === 0) {
      return { resortId, liftsSeeded: 0, liftieSlug, source: 'none', error: 'No lifts in Liftie response' };
    }

    await Promise.all(
      Object.entries(liftsRaw).map(([liftName, statusData]) => {
        const rawStatus = typeof statusData === 'string' ? statusData : (statusData as any)?.status;
        return prisma.liftStatus.upsert({
          where: { resortId_liftName: { resortId, liftName } },
          update: { status: mapStatus(rawStatus), liftType: inferLiftType(liftName) },
          create: { resortId, liftName, liftType: inferLiftType(liftName), status: mapStatus(rawStatus) },
        });
      })
    );

    // Store the slug for cron refresh jobs
    await prisma.resort.update({ where: { id: resortId }, data: { liftieSlug } });

    console.log(`[LiftieSeeder] Seeded ${Object.keys(liftsRaw).length} lifts from slug "${liftieSlug}"`);
    return { resortId, liftsSeeded: Object.keys(liftsRaw).length, liftieSlug, source: 'liftie' };
  } catch (err: any) {
    console.error('[LiftieSeeder]', err.message);
    return { resortId, liftsSeeded: 0, liftieSlug, source: 'none', error: err.message };
  }
}

/** Refreshes live lift statuses. Called by cron every 5 min during ski hours. */
export async function refreshLiftsFromLiftie(
  resortId: string,
  liftieSlug: string
): Promise<{ updated: number; error?: string }> {
  try {
    const res = await fetch(`${LIFTIE_BASE}/${liftieSlug}`, {
      headers: { 'User-Agent': 'PowderIQ/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { updated: 0, error: `Liftie ${res.status}` };

    const data = await res.json();
    const liftsRaw = data.lifts as Record<string, { status: string } | string> | undefined;
    if (!liftsRaw) return { updated: 0 };

    await Promise.all(
      Object.entries(liftsRaw).map(([liftName, statusData]) => {
        const rawStatus = typeof statusData === 'string' ? statusData : (statusData as any)?.status;
        return prisma.liftStatus.updateMany({
          where: { resortId, liftName },
          data: { status: mapStatus(rawStatus) },
        });
      })
    );
    return { updated: Object.keys(liftsRaw).length };
  } catch (err: any) {
    return { updated: 0, error: err.message };
  }
}
