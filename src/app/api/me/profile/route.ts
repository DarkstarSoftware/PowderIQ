import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, err, handleError } from '@/lib/apiResponse';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createServerSupabase } from '@/lib/supabase/server';

const schema = z.object({
  displayName:  z.string().max(50).optional(),
  style:        z.enum(['powder', 'all_mountain', 'freestyle', 'beginner']).optional(),
  skillLevel:   z.enum(['beginner', 'intermediate', 'expert']).optional(),
  homeMountain: z.string().optional(),
  notifications:z.boolean().optional(),
});

export async function PUT(req: NextRequest) {
  try {
    // Auto-provision user before updating profile
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (token) {
      const supa = createServerSupabase();
      const { data } = await supa.auth.getUser(token);
      if (data.user) {
        await prisma.user.upsert({
          where: { supabaseId: data.user.id },
          update: { email: data.user.email! },
          create: { supabaseId: data.user.id, email: data.user.email!, role: 'user' },
        });
      }
    }

    const user = await requireAuth(req);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return err('Validation error', 400, parsed.error.errors);

    const profile = await prisma.riderProfile.upsert({
      where: { userId: user.id },
      update: parsed.data,
      create: { userId: user.id, ...parsed.data },
    });
    return ok(profile);
  } catch (e) {
    return handleError(e);
  }
}
