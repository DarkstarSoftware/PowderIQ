// src/services/scoreService.ts
import { prisma } from '@/lib/prisma';
import { getSnowDataCached } from './snowProvider';
import { computeScore, type SnowRegion } from './scoreEngine';
import type { RiderProfile } from '@prisma/client';

const SCORE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Map US state → snow region for accurate scoring thresholds
const STATE_TO_REGION: Record<string, SnowRegion> = {
  MI: 'midwest', WI: 'midwest', MN: 'midwest', OH: 'midwest',
  IN: 'midwest', IL: 'midwest', IA: 'midwest', MO: 'midwest',
  CO: 'rockies', UT: 'rockies', WY: 'rockies', MT: 'rockies', ID: 'rockies',
  CA: 'sierras',
  WA: 'pacific_nw', OR: 'pacific_nw',
  VT: 'northeast', NH: 'northeast', ME: 'northeast',
  NY: 'northeast', MA: 'northeast', CT: 'northeast',
};

export async function getMountainScore(
  mountainId: string,
  profile: RiderProfile | null = null,
): Promise<{ score: number; breakdown: object; explanation: string }> {
  const now = new Date();

  // Use cached score only for anonymous (no-profile) requests
  if (!profile) {
    const cached = await prisma.mountainScore.findFirst({
      where: { mountainId, expiresAt: { gt: now } },
      orderBy: { computedAt: 'desc' },
    });
    if (cached) {
      return {
        score:       cached.score,
        breakdown:   cached.breakdown as object,
        explanation: cached.explanation,
      };
    }
  }

  const mountain = await prisma.mountain.findUnique({ where: { id: mountainId } });
  if (!mountain) throw new Error('NOT_FOUND');

  // Determine region from state for accurate thresholds
  const stateCode = mountain.state?.toUpperCase().trim() ?? '';
  const region: SnowRegion = STATE_TO_REGION[stateCode] ?? 'default';

  const snow = await getSnowDataCached(mountainId, mountain.latitude, mountain.longitude);

  // Pull active NWS alerts — import lazily to avoid circular deps
  let alerts: import('./elevationWeatherService').WeatherAlert[] = [];
  try {
    const { fetchNWSAlerts } = await import('./elevationWeatherService') as any;
    if (typeof fetchNWSAlerts === 'function' && mountain.country === 'US') {
      // fetchNWSAlerts is not exported from the current version; use the resort weather cache
      const resort = await prisma.resort.findFirst({ where: { mountainId }, select: { id: true } });
      if (resort) {
        // Use cached elevation weather if available — it already ran the alert fetch
        const cached = await prisma.elevationWeather.findFirst({
          where: { resortId: resort.id, expiresAt: { gt: now } },
        });
        // alerts are stored on the ResortWeatherReport, not in the DB — we'll skip for now
      }
    }
  } catch { /* non-fatal */ }

  const result = computeScore(snow, profile, region, alerts);

  // Cache base score (no-profile only)
  if (!profile) {
    await prisma.mountainScore.create({
      data: {
        mountainId,
        score:       result.score,
        breakdown:   result.breakdown as object,
        explanation: result.explanation,
        expiresAt:   new Date(now.getTime() + SCORE_TTL_MS),
      },
    });
  }

  return result;
}
