import { NextRequest } from 'next/server';
import { ok, err, handleError } from '@/lib/apiResponse';
import { prisma } from '@/lib/prisma';
import { getMountainScore } from '@/services/scoreService';
import { getAuthUser } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mountain = await prisma.mountain.findUnique({ where: { id } });
    if (!mountain) return err('Mountain not found', 404);

    const user    = await getAuthUser(req);
    const profile = user
      ? await prisma.riderProfile.findUnique({ where: { userId: user.id } })
      : null;

    const result = await getMountainScore(id, profile);
    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
