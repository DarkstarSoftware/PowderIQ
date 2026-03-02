import { NextRequest } from 'next/server';
import { createServerSupabase } from './supabase/server';
import { prisma } from './prisma';
import type { User } from '@prisma/client';

export async function getAuthUser(req: NextRequest): Promise<User | null> {
  const authHeader = req.headers.get('authorization');
  const token =
    authHeader?.replace('Bearer ', '') ||
    req.cookies.get('sb-access-token')?.value;
  if (!token) return null;

  const supabase = createServerSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  const user = await prisma.user.findUnique({
    where: { supabaseId: data.user.id },
  });
  return user;
}

export async function requireAuth(req: NextRequest): Promise<User> {
  const user = await getAuthUser(req);
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}

export async function requirePro(req: NextRequest): Promise<User> {
  const user = await requireAuth(req);
  if (user.role !== 'pro_user' && user.role !== 'admin') {
    throw new Error('PRO_REQUIRED');
  }
  return user;
}

export async function requireAdmin(req: NextRequest): Promise<User> {
  const user = await requireAuth(req);
  if (user.role !== 'admin') throw new Error('FORBIDDEN');
  return user;
}
