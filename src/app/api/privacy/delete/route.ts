import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/apiResponse';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createServerSupabase } from '@/lib/supabase/server';
import { auditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    await auditLog({
      userId: user.id,
      action: 'privacy.account_delete_requested',
      ip:     req.headers.get('x-forwarded-for') || undefined,
    });

    const supabaseId = user.supabaseId;

    // Cascade deletes profile, favorites, alerts via Prisma schema
    await prisma.user.delete({ where: { id: user.id } });

    // Remove from Supabase Auth
    const supa = createServerSupabase();
    await supa.auth.admin.deleteUser(supabaseId);

    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
