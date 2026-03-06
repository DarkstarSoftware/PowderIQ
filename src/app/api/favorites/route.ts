import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, err, handleError } from '@/lib/apiResponse';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { auditLog } from '@/lib/audit';
import { fetchSkimapImage } from '@/lib/skimap';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const favorites = await prisma.favoriteMountain.findMany({
      where: { userId: user.id },
      include: { mountain: true },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich mountains with skimap trail map images
    const enriched = await Promise.all(
      favorites.map(async (f) => {
        // Already has an image, skip
        if (f.mountain.imageUrl) return f;
        // Has a skimap area ID, fetch the most recent trail map
        if ((f.mountain as any).skimapAreaId) {
          const imageUrl = await fetchSkimapImage((f.mountain as any).skimapAreaId);
          if (imageUrl) {
            return {
              ...f,
              mountain: { ...f.mountain, imageUrl },
            };
          }
        }
        return f;
      })
    );

    return ok(enriched);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { mountainId } = z
      .object({ mountainId: z.string() })
      .parse(await req.json());

    const fav = await prisma.favoriteMountain.create({
      data: { userId: user.id, mountainId },
      include: { mountain: true },
    });
    await auditLog({
      userId: user.id,
      action: 'favorite.add',
      entity: 'mountain',
      entityId: mountainId,
      ip: req.headers.get('x-forwarded-for') || undefined,
    });
    return ok(fav, 201);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { mountainId } = z
      .object({ mountainId: z.string() })
      .parse(await req.json());

    const deleted = await prisma.favoriteMountain.deleteMany({
      where: { userId: user.id, mountainId },
    });
    if (deleted.count === 0) return err('Not found', 404);

    await auditLog({
      userId: user.id,
      action: 'favorite.remove',
      entity: 'mountain',
      entityId: mountainId,
    });
    return ok({ removed: true });
  } catch (e) {
    return handleError(e);
  }
}
