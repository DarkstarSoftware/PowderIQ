import { NextRequest } from 'next/server';
import { ok, err, handleError } from '@/lib/apiResponse';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mountain = await prisma.mountain.findUnique({
      where: { id },
    });
    if (!mountain) return err('Mountain not found', 404);
    return ok(mountain);
  } catch (e) {
    return handleError(e);
  }
}
