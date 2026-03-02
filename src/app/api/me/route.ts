import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/apiResponse';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    // Auto-provision user in DB on first request
    const authHeader = req.headers.get('authorization');
    const token =
      authHeader?.replace('Bearer ', '') ||
      req.cookies.get('sb-access-token')?.value;

    if (token) {
      const supa = createServerSupabase();
      const { data } = await supa.auth.getUser(token);
      if (data.user) {
        await prisma.user.upsert({
          where: { supabaseId: data.user.id },
          update: { email: data.user.email! },
          create: {
            supabaseId: data.user.id,
            email: data.user.email!,
            role: 'user',
          },
        });
      }
    }

    const user = await requireAuth(req);
    const full = await prisma.user.findUnique({
      where: { id: user.id },
      include: { profile: true, subscription: true },
    });
    return ok(full);
  } catch (e) {
    return handleError(e);
  }
}
