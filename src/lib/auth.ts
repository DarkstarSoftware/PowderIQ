import { NextRequest } from 'next/server';
import { createServerSupabase } from './supabase/server';
import { prisma } from './prisma';
import type { User } from '@prisma/client';

// ─── Existing Consumer Auth ───────────────────────────────────────────────────

export async function getAuthUser(req: NextRequest): Promise<User | null> {
  const authHeader = req.headers.get('authorization');
  const token =
    authHeader?.replace('Bearer ', '') ||
    req.cookies.get('sb-access-token')?.value;
  if (!token) return null;

  const supabase = createServerSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return prisma.user.findUnique({ where: { supabaseId: data.user.id } });
}

export async function requireAuth(req: NextRequest): Promise<User> {
  const user = await getAuthUser(req);
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}

export async function requirePro(req: NextRequest): Promise<User> {
  const user = await requireAuth(req);
  if (user.role !== 'pro_user' && user.role !== 'admin') throw new Error('PRO_REQUIRED');
  return user;
}

export async function requireAdmin(req: NextRequest): Promise<User> {
  const user = await requireAuth(req);
  if (user.role !== 'admin') throw new Error('FORBIDDEN');
  return user;
}

// ─── Resort B2B Auth ──────────────────────────────────────────────────────────

export interface OperatorContext {
  userId: string;
  resortId: string;
  staffRole: string;
  plan: string;
}

const ROLE_HIERARCHY = ['staff', 'supervisor', 'manager', 'owner'];

/**
 * Verifies the requesting user is an operator of the given resort.
 * Returns the operator context or null if unauthorized.
 */
export async function verifyResortAccess(
  req: NextRequest,
  resortId: string,
  minRole?: 'staff' | 'supervisor' | 'manager' | 'owner'
): Promise<OperatorContext | null> {
  const user = await getAuthUser(req);
  if (!user) return null;

  // Admins bypass all resort checks
  if (user.role === 'admin') {
    const resort = await prisma.resort.findUnique({ where: { id: resortId } });
    if (!resort) return null;
    return { userId: user.id, resortId, staffRole: 'owner', plan: resort.plan };
  }

  const operator = await prisma.resortOperator.findUnique({
    where: { userId_resortId: { userId: user.id, resortId } },
    include: { resort: { select: { plan: true, planStatus: true } } },
  });

  if (!operator) return null;
  if (operator.resort.planStatus === 'suspended') return null;

  if (minRole) {
    const opIdx = ROLE_HIERARCHY.indexOf(operator.staffRole);
    const reqIdx = ROLE_HIERARCHY.indexOf(minRole);
    if (opIdx < reqIdx) return null;
  }

  return { userId: user.id, resortId, staffRole: operator.staffRole, plan: operator.resort.plan };
}

/**
 * Like verifyResortAccess but throws on failure.
 */
export async function requireResortAccess(
  req: NextRequest,
  resortId: string,
  minRole?: 'staff' | 'supervisor' | 'manager' | 'owner'
): Promise<OperatorContext> {
  const ctx = await verifyResortAccess(req, resortId, minRole);
  if (!ctx) throw new Error('RESORT_UNAUTHORIZED');
  return ctx;
}

/**
 * Checks if a resort plan includes a specific feature.
 */
export function resortHasFeature(
  plan: string,
  feature: 'analytics' | 'ai_reports' | 'notifications' | 'api_access' | 'snowmaking'
): boolean {
  const features: Record<string, string[]> = {
    starter:    ['notifications'],
    pro:        ['notifications', 'analytics', 'ai_reports'],
    enterprise: ['notifications', 'analytics', 'ai_reports', 'api_access', 'snowmaking'],
  };
  return features[plan]?.includes(feature) ?? false;
}
