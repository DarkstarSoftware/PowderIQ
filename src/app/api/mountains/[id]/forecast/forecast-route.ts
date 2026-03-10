import { NextRequest } from 'next/server';
import { ok, err, handleError } from '@/lib/apiResponse';
import { prisma } from '@/lib/prisma';
import { getSnowDataCached } from '@/services/snowProvider';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mountain = await prisma.mountain.findUnique({ where: { id } });
    if (!mountain) return err('Mountain not found', 404);

    const snow = await getSnowDataCached(
      id,
      mountain.latitude,
      mountain.longitude
    );
    return ok({ mountain, snow });
  } catch (e) {
    return handleError(e);
  }
}