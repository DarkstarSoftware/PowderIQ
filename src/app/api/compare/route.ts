import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, err, handleError } from '@/lib/apiResponse';
import { requirePro } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMountainScore } from '@/services/scoreService';
import { rateLimit } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  try {
    const user = await requirePro(req);
    if (!rateLimit(`compare:${user.id}`, 20, 60_000)) {
      return err('Rate limit exceeded. Try again in a minute.', 429);
    }

    const { mountainIds } = z
      .object({ mountainIds: z.array(z.string()).min(2).max(4) })
      .parse(await req.json());

    const results = await Promise.all(
      mountainIds.map(async (id) => {
        const mountain = await prisma.mountain.findUnique({ where: { id } });
        if (!mountain) return null;
        const scoreData = await getMountainScore(id);
        return { mountain, scoreData };
      })
    );

    const valid = results.filter(Boolean);
    if (valid.length < 2) return err('Need at least 2 valid mountains', 400);
    return ok(valid);
  } catch (e) {
    return handleError(e);
  }
}
