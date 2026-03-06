import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/apiResponse';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const near   = searchParams.get('near');
    const radius = Number(searchParams.get('radius') || '200');
    const slug   = searchParams.get('slug');
    const id     = searchParams.get('id');

    if (slug) {
      const mountain = await prisma.mountain.findUnique({ where: { slug } });
      return ok(mountain ? [mountain] : []);
    }

    if (id) {
      const mountain = await prisma.mountain.findUnique({ where: { id } });
      return ok(mountain ? [mountain] : []);
    }

    const mountains = await prisma.mountain.findMany({
      orderBy: { name: 'asc' },
    });

    if (near) {
      const [lat, lon] = near.split(',').map(Number);
      const filtered = mountains.filter((m: any) => {
        const distKm =
          Math.sqrt(
            Math.pow((m.latitude - lat) * 111, 2) +
            Math.pow((m.longitude - lon) * 85, 2)
          );
        return distKm <= radius;
      });
      return ok(filtered);
    }

    return ok(mountains);
  } catch (e) {
    return handleError(e);
  }
}
