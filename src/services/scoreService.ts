import { prisma } from '@/lib/prisma';
import { getSnowDataCached } from './snowProvider';
import { computeScore } from './scoreEngine';
import type { RiderProfile } from '@prisma/client';

const SCORE_TTL_MS = 60 * 60 * 1000; // 1 hour

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
        score: cached.score,
        breakdown: cached.breakdown as object,
        explanation: cached.explanation,
      };
    }
  }

  const mountain = await prisma.mountain.findUnique({ where: { id: mountainId } });
  if (!mountain) throw new Error('NOT_FOUND');

  const snow = await getSnowDataCached(mountainId, mountain.latitude, mountain.longitude);
  const result = computeScore(snow, profile);

  // Cache only the base (no-profile) score
  if (!profile) {
    await prisma.mountainScore.create({
      data: {
        mountainId,
        score: result.score,
        breakdown: result.breakdown as object,
        explanation: result.explanation,
        expiresAt: new Date(now.getTime() + SCORE_TTL_MS),
      },
    });
  }

  return result;
}
