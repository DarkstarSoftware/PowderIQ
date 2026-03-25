// src/services/scoreService.ts

import { prisma } from '@/lib/prisma';
import { getSnowDataCached } from './snowProvider';
import { computeScore, isSkiSeason } from './scoreEngine';
import type { RiderProfile } from '@prisma/client';

const SCORE_TTL_MS  = 60 * 60 * 1000;  // 1 hour
const CLOSED_TTL_MS = 20 * 60 * 1000;  // 20 min for closed — re-checks faster

export async function getMountainScore(
  mountainId: string,
  profile: RiderProfile | null = null
): Promise<{ score: number; breakdown: object; explanation: string; isOpen: boolean }> {
  const now = new Date();

  // Cached score — skip for profile-personalized requests
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
        isOpen:      cached.score > 0,
      };
    }
  }

  const mountain = await prisma.mountain.findUnique({ where: { id: mountainId } });
  if (!mountain) throw new Error('NOT_FOUND');

  // Vertical drop — if elevation data missing, default to 3000ft (large resort assumption)
  // This keeps Steamboat/Snowmass/Vail in the right season tier even without DB elevation
  const rawVertical = mountain.topElevFt && mountain.baseElevFt
    ? mountain.topElevFt - mountain.baseElevFt
    : null;
  const verticalFt = rawVertical ?? 3000; // 3000ft default = large western resort

  // ── Determine if resort is open ───────────────────────────────────────────
  // Priority order (most reliable → least reliable):
  //   1. DB LiftStatus records (resort operator account) — most reliable
  //   2. Cached Liftie stats (saved by /api/lifts proxy)
  //   3. isSkiSeason heuristic — last resort only

  let isOpen = false;
  let openSignalSource = 'none';

  // 1. Resort operator DB data
  const resort = await prisma.resort.findFirst({
    where: { mountainId },
    select: { id: true },
  });
  if (resort) {
    const openLifts = await prisma.liftStatus.count({
      where: { resortId: resort.id, status: 'open' },
    });
    if (openLifts > 0) { isOpen = true; openSignalSource = 'liftStatus'; }
    else if (await prisma.liftStatus.count({ where: { resortId: resort.id } }) > 0) {
      // We have lift data but nothing is open — resort is closed
      isOpen = false; openSignalSource = 'liftStatus-closed';
    }
  }

  // 2. Liftie cache (written by /api/lifts/[slug]/route.ts)
  if (openSignalSource === 'none') {
    const liftieSnap = await prisma.snowSnapshot.findFirst({
      where: {
        mountainId,
        provider: 'liftie',
        fetchedAt: { gt: new Date(now.getTime() - 4 * 60 * 60 * 1000) }, // max 4h old
      },
      orderBy: { fetchedAt: 'desc' },
    });
    if (liftieSnap) {
      const p = liftieSnap.payload as any;
      const openCount = p?.stats?.open ?? 0;
      const totalLifts = (p?.stats?.open ?? 0) + (p?.stats?.closed ?? 0) +
                         (p?.stats?.hold ?? 0) + (p?.stats?.scheduled ?? 0);
      if (totalLifts > 0) {
        // We have real Liftie data — trust it
        isOpen = openCount > 0 || (p?.stats?.scheduled ?? 0) > 0;
        openSignalSource = 'liftie';
      }
    }
  }

  // 3. Season heuristic — only when we have NO live signal at all
  if (openSignalSource === 'none') {
    const month = now.getMonth(); // 0=Jan
    // During peak ski season (Dec=11, Jan=0, Feb=1, Mar=2, Apr=3) assume all
    // destination resorts (>1000ft vertical) are open — the heuristic is
    // only useful for shoulder season edge cases
    if (month === 11 || month <= 3) {
      isOpen = verticalFt >= 1000 ? true : isSkiSeason(now, verticalFt);
    } else {
      isOpen = isSkiSeason(now, verticalFt);
    }
    openSignalSource = 'heuristic';
  }

  // ── Score = 0 if closed ───────────────────────────────────────────────────
  if (!isOpen) {
    const result = {
      score: 0,
      breakdown: {
        snowfall24h: 0, snowfall7d: 0, baseDepth: 0,
        wind: 0, tempStability: 0, crowd: 0, seasonPenalty: -100, total: 0,
      },
      explanation: 'This resort is currently closed for the season.',
      isOpen: false,
    };
    if (!profile) {
      await prisma.mountainScore.upsert({
        where: { id: `closed-${mountainId}` },
        // Use a stable ID so we don't create infinite "closed" records
        create: {
          id: `closed-${mountainId}`,
          mountainId,
          score: 0,
          breakdown: result.breakdown as object,
          explanation: result.explanation,
          expiresAt: new Date(now.getTime() + CLOSED_TTL_MS),
        },
        update: {
          score: 0,
          explanation: result.explanation,
          expiresAt: new Date(now.getTime() + CLOSED_TTL_MS),
        },
      }).catch(async () => {
        // upsert failed (no unique id field) — just create
        await prisma.mountainScore.create({
          data: {
            mountainId,
            score: 0,
            breakdown: result.breakdown as object,
            explanation: result.explanation,
            expiresAt: new Date(now.getTime() + CLOSED_TTL_MS),
          },
        });
      });
    }
    return result;
  }

  // ── Fetch snow data and compute score ─────────────────────────────────────
  const snow = await getSnowDataCached(mountainId, mountain.latitude, mountain.longitude);
  const enrichedSnow = { ...snow, verticalFt, isOpenSeason: true };
  const result = computeScore(enrichedSnow, profile);

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

  return { ...result, isOpen: true };
}
