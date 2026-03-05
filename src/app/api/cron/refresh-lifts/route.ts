// src/app/api/cron/refresh-lifts/route.ts
// Refreshes live lift statuses from liftie.info for all active resorts.
//
// Vercel cron — add to vercel.json:
// { "crons": [{ "path": "/api/cron/refresh-lifts", "schedule": "*/5 8-18 * * *" }] }

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { refreshLiftsFromLiftie } from '@/services/liftieSeeder';

async function handler(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ||
    req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resorts = await prisma.resort.findMany({
    where: { planStatus: { in: ['active', 'trial'] }, liftieSlug: { not: null } },
    select: { id: true, name: true, liftieSlug: true },
  });

  const results = await Promise.allSettled(
    resorts.map(r => refreshLiftsFromLiftie(r.id, r.liftieSlug!).then(res => ({ name: r.name, ...res })))
  );

  const summary = results.map((r: PromiseSettledResult<any>) =>
    r.status === 'fulfilled' ? r.value : { error: (r as PromiseRejectedResult).reason?.message }
  );

  return NextResponse.json({ refreshed: resorts.length, summary });
}

export const GET = handler;
export const POST = handler;
