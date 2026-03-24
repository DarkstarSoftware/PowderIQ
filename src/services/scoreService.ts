// src/services/scoreService.ts

import { prisma } from '@/lib/prisma';
import { getSnowDataCached } from './snowProvider';
import { computeScore, isSkiSeason } from './scoreEngine';
import type { RiderProfile } from '@prisma/client';

const SCORE_TTL_MS     = 60 * 60 * 1000; // 1 hour
const CLOSED_TTL_MS    = 30 * 60 * 1000;  // 30 min for season=false (re-checks quickly)

export async function getMountainScore(
  mountainId: string,
  profile: RiderProfile | null = null
): Promise<{ score: number; breakdown: object; explanation: string }> {
  const now = new Date();

  // Use cached score only for anonymous (profile-less) requests
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

  // Calculate vertical drop — used for calibrating thresholds and season detection
  const verticalFt = (mountain.topElevFt ?? 3000) - (mountain.baseElevFt ?? 1000);

  // Season check — heuristic based on vertical drop.
  // Override: if Liftie reports open lifts for this mountain, it's definitely open.
  // We check the Liftie slug-based lift status as a live signal.
  let inSeason = isSkiSeason(now, verticalFt);

  if (!inSeason) {
    // Override 1: Resort has open LiftStatus records in DB (resort account)
    const resort = await prisma.resort.findFirst({
      where: { mountainId },
      select: { id: true },
    });
    if (resort) {
      const openLifts = await prisma.liftStatus.count({
        where: { resortId: resort.id, status: 'open' },
      });
      if (openLifts > 0) inSeason = true;
    }

    // Override 2: Recent Liftie snapshot shows open lifts
    // Check SnowSnapshot for cached Liftie stats (stored by dashboard)
    if (!inSeason) {
      const liftieSnap = await prisma.snowSnapshot.findFirst({
        where: {
          mountainId,
          provider: 'liftie',
          expiresAt: { gt: now },
        },
        orderBy: { fetchedAt: 'desc' },
      });
      if (liftieSnap) {
        const payload = liftieSnap.payload as any;
        if ((payload?.stats?.open ?? 0) > 0) inSeason = true;
      }
    }
  }

  if (!inSeason) {
    const result = {
      score: 0,
      breakdown: {
        snowfall24h: 0, snowfall7d: 0, baseDepth: 0,
        wind: 0, tempStability: 0, crowd: 0, seasonPenalty: -100, total: 0,
      },
      explanation: 'This resort is currently closed for the season.',
    };

    if (!profile) {
      await prisma.mountainScore.create({
        data: {
          mountainId,
          score:       0,
          breakdown:   result.breakdown as object,
          explanation: result.explanation,
          expiresAt:   new Date(now.getTime() + CLOSED_TTL_MS),
        },
      });
    }

    return result;
  }

  const snow = await getSnowDataCached(mountainId, mountain.latitude, mountain.longitude);

  // Pass verticalFt so the engine can calibrate thresholds to resort size
  const enrichedSnow = { ...snow, verticalFt, isOpenSeason: true };
  const result = computeScore(enrichedSnow, profile);

  // Cache the base score
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
