import { NextRequest } from 'next/server';
import { ok, created, handleError } from '@/lib/apiResponse';
import { verifyResortAccess, resortHasFeature } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/resort/[resortId]/snow-report — latest reports
export async function GET(
  req: NextRequest,
  { params }: { params: { resortId: string } }
) {
  try {
    const { resortId } = params;
    const ctx = await verifyResortAccess(req, resortId);
    if (!ctx) return handleError(new Error('RESORT_UNAUTHORIZED'), 401);

    const reports = await prisma.resortSnowReport.findMany({
      where: { resortId },
      orderBy: { reportDate: 'desc' },
      take: 10,
    });

    return ok(reports);
  } catch (e) {
    return handleError(e);
  }
}

// POST /api/resort/[resortId]/snow-report — generate AI report or save manual one
export async function POST(
  req: NextRequest,
  { params }: { params: { resortId: string } }
) {
  try {
    const { resortId } = params;
    const ctx = await verifyResortAccess(req, resortId, 'supervisor');
    if (!ctx) return handleError(new Error('RESORT_UNAUTHORIZED'), 401);

    const body = await req.json();
    const { generate, publish, narrative, ...manualData } = body;

    // Fetch current conditions for AI generation
    const [lifts, trails, weatherZones] = await Promise.all([
      prisma.liftStatus.findMany({ where: { resortId } }),
      prisma.trailStatus.findMany({ where: { resortId } }),
      prisma.elevationWeather.findMany({ where: { resortId } }),
    ]);

    const openLifts = lifts.filter(l => l.status === 'open').length;
    const openTrails = trails.filter(t => t.status === 'open' || t.status === 'groomed').length;
    const summitWeather = weatherZones.find(w => w.zone === 'summit');
    const baseWeather = weatherZones.find(w => w.zone === 'base');
    const snow24h = summitWeather?.snowfall24hIn ?? manualData.snowfall24hIn ?? 0;

    let aiNarrative = narrative || null;

    // Generate AI narrative if requested and plan supports it
    if (generate && resortHasFeature(ctx.plan, 'ai_reports')) {
      const resort = await prisma.resort.findUnique({
        where: { id: resortId },
        include: { mountain: { select: { name: true } } },
      });

      const prompt = `You are a ski resort communications writer for ${resort?.mountain?.name || 'our resort'}.
Write an enthusiastic, professional morning snow report (2–3 sentences max) based on these conditions:
- New snow (24h): ${snow24h.toFixed(1)}"
- Summit temp: ${summitWeather?.tempF?.toFixed(0) ?? 'N/A'}°F
- Base temp: ${baseWeather?.tempF?.toFixed(0) ?? 'N/A'}°F  
- Wind at summit: ${summitWeather?.windMph?.toFixed(0) ?? 'N/A'} mph
- Lifts open: ${openLifts} of ${lifts.length}
- Trails open: ${openTrails} of ${trails.length}
- Conditions: ${summitWeather?.conditionDesc ?? 'variable'}
Keep it upbeat and accurate. Do not exaggerate. No emojis.`;

      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        aiNarrative = aiData.content?.[0]?.text?.trim() || null;
      }
    }

    const report = await prisma.resortSnowReport.create({
      data: {
        resortId,
        snowfall24hIn: snow24h,
        snowfall48hIn: manualData.snowfall48hIn ?? snow24h * 1.5,
        snowfall7dIn:  manualData.snowfall7dIn ?? snow24h * 4,
        baseDepthIn:   baseWeather?.snowDepthIn ?? manualData.baseDepthIn ?? 0,
        summitDepthIn: summitWeather?.snowDepthIn ?? manualData.summitDepthIn ?? 0,
        openLifts,
        totalLifts:  lifts.length,
        openTrails,
        totalTrails: trails.length,
        narrative:   aiNarrative,
        publishedAt: publish ? new Date() : null,
        publishedBy: publish ? ctx.userId : null,
      },
    });

    return created({ report, aiGenerated: !!aiNarrative && !!generate });
  } catch (e) {
    return handleError(e);
  }
}
