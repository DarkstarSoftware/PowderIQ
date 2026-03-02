import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMountainScore } from '@/services/scoreService';
import { sendAlertEmail } from '@/lib/email';
import { createLogger } from '@/lib/logger';

// Accepts both POST (external cron) and GET (Vercel cron)
async function handler(req: NextRequest) {
  const secret =
    req.headers.get('x-cron-secret') ||
    req.headers.get('authorization')?.replace('Bearer ', '');

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const logger = createLogger();
  logger.info('cron:evaluate-alerts started');

  const activeAlerts = await prisma.alertSubscription.findMany({
    where: { active: true },
    include: { mountain: true, user: true },
  });

  logger.info(`Evaluating ${activeAlerts.length} alerts`);

  let fired   = 0;
  let skipped = 0;

  for (const alert of activeAlerts) {
    try {
      const { score } = await getMountainScore(alert.mountainId);

      if (score < alert.threshold) {
        skipped++;
        continue;
      }

      // Deduplicate: skip if we already fired in last 24 hours
      const recent = await prisma.alertEvent.findFirst({
        where: {
          subscriptionId: alert.id,
          createdAt:      { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });
      if (recent) {
        skipped++;
        continue;
      }

      const event = await prisma.alertEvent.create({
        data: { subscriptionId: alert.id, score },
      });

      await sendAlertEmail(alert.user.email, alert.mountain.name, score);
      await prisma.alertEvent.update({
        where: { id: event.id },
        data:  { emailSent: true },
      });

      fired++;
      logger.info(`Alert fired`, {
        user:     alert.user.email,
        mountain: alert.mountain.name,
        score,
        threshold: alert.threshold,
      });
    } catch (e) {
      logger.error(`Alert eval failed for subscription ${alert.id}`, {
        error: String(e),
      });
    }
  }

  logger.info('cron:evaluate-alerts complete', {
    evaluated: activeAlerts.length,
    fired,
    skipped,
  });

  return NextResponse.json({
    ok: true,
    evaluated: activeAlerts.length,
    fired,
    skipped,
  });
}

export const GET  = handler;
export const POST = handler;
