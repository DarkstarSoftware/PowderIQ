import { prisma } from './prisma';

interface AuditOpts {
  userId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: object;
  ip?: string;
}

export async function auditLog(opts: AuditOpts): Promise<void> {
  try {
    await prisma.auditLog.create({ data: opts });
  } catch (e) {
    console.error('[audit] write failed:', e);
  }
}
