import type { RiderProfile } from '@prisma/client';

export interface SnowData {
  snowfall24h: number; // inches
  snowfall7d: number;  // inches
  baseDepthIn: number;
  windMph: number;
  tempF: number;
  tempMinF: number;
  tempMaxF: number;
}

export interface ScoreBreakdown {
  snowfall24h: number;
  snowfall7d: number;
  baseDepth: number;
  wind: number;
  tempStability: number;
  crowd: number;
  total: number;
}

type Weights = Record<string, number>;

const DEFAULT_WEIGHTS: Weights = {
  snowfall24h:  0.30,
  snowfall7d:   0.15,
  baseDepth:    0.15,
  wind:         0.20,
  tempStability:0.10,
  crowd:        0.10,
};

function adjustWeights(profile: RiderProfile | null): Weights {
  const w = { ...DEFAULT_WEIGHTS };
  if (!profile) return w;

  if (profile.style === 'powder') {
    w.snowfall24h  = 0.40;
    w.snowfall7d   = 0.20;
    w.baseDepth    = 0.15;
    w.wind         = 0.10;
    w.tempStability= 0.05;
    w.crowd        = 0.10;
  } else if (profile.style === 'beginner' || profile.skillLevel === 'beginner') {
    w.wind          = 0.15;
    w.crowd         = 0.20;
    w.tempStability = 0.15;
    w.snowfall24h   = 0.20;
    w.snowfall7d    = 0.15;
    w.baseDepth     = 0.15;
  } else if (profile.style === 'freestyle') {
    w.snowfall24h  = 0.20;
    w.snowfall7d   = 0.10;
    w.baseDepth    = 0.20;
    w.wind         = 0.20;
    w.tempStability= 0.15;
    w.crowd        = 0.15;
  }

  // Normalize to sum to 1
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  Object.keys(w).forEach((k) => { w[k] /= sum; });
  return w;
}

// Individual component scorers (0–100)
const scoreSnowfall24h  = (in_: number) => Math.min(100, (in_ / 18) * 100);
const scoreSnowfall7d   = (in_: number) => Math.min(100, (in_ / 36) * 100);
const scoreBaseDepth    = (in_: number) => Math.min(100, (in_ / 120) * 100);
const scoreTempStability = (min: number, max: number) => {
  const spread = max - min;
  if (spread <= 5)  return 100;
  if (spread >= 40) return 0;
  return 100 - (spread / 40) * 100;
};
const scoreWind = (mph: number) => {
  if (mph <= 5)  return 100;
  if (mph >= 60) return 0;
  return 100 - ((mph - 5) / 55) * 100;
};
const scoreCrowd = (dayOfWeek: number) =>
  dayOfWeek === 0 || dayOfWeek === 6 ? 30 : 80;

export function computeScore(
  snow: SnowData,
  profile: RiderProfile | null = null
): { score: number; breakdown: ScoreBreakdown; explanation: string } {
  const w   = adjustWeights(profile);
  const dow = new Date().getDay();

  const s24h  = scoreSnowfall24h(snow.snowfall24h);
  const s7d   = scoreSnowfall7d(snow.snowfall7d);
  const sBase = scoreBaseDepth(snow.baseDepthIn);
  const sWind = scoreWind(snow.windMph);
  const sTemp = scoreTempStability(snow.tempMinF, snow.tempMaxF);
  const sCrd  = scoreCrowd(dow);

  const total = Math.round(
    s24h  * w.snowfall24h +
    s7d   * w.snowfall7d +
    sBase * w.baseDepth +
    sWind * w.wind +
    sTemp * w.tempStability +
    sCrd  * w.crowd
  );

  const breakdown: ScoreBreakdown = {
    snowfall24h:  Math.round(s24h),
    snowfall7d:   Math.round(s7d),
    baseDepth:    Math.round(sBase),
    wind:         Math.round(sWind),
    tempStability:Math.round(sTemp),
    crowd:        Math.round(sCrd),
    total,
  };

  return { score: total, breakdown, explanation: generateExplanation(snow, total) };
}

function generateExplanation(snow: SnowData, total: number): string {
  const parts: string[] = [];

  if (snow.snowfall24h >= 12)
    parts.push(`Outstanding fresh snowfall of ${snow.snowfall24h}" in the last 24 hours — prime powder.`);
  else if (snow.snowfall24h >= 6)
    parts.push(`Good recent snowfall of ${snow.snowfall24h}" in the past day.`);
  else if (snow.snowfall24h > 0)
    parts.push(`Light snowfall of ${snow.snowfall24h}" in the past 24 hours.`);
  else
    parts.push('No new snowfall in the past 24 hours.');

  if (snow.baseDepthIn >= 80)
    parts.push(`Deep base of ${snow.baseDepthIn}" ensures excellent coverage everywhere.`);
  else if (snow.baseDepthIn >= 40)
    parts.push(`Solid base depth of ${snow.baseDepthIn}".`);
  else
    parts.push(`Thin base of ${snow.baseDepthIn}" — watch for rocks on lower runs.`);

  if (snow.windMph <= 10)
    parts.push('Calm winds mean ideal lift operations and clear visibility.');
  else if (snow.windMph <= 25)
    parts.push(`Moderate winds at ${snow.windMph} mph — some upper chairs may be slow.`);
  else
    parts.push(`High winds at ${snow.windMph} mph may close upper lifts and reduce visibility.`);

  const prefix =
    total >= 80 ? 'Outstanding powder day! ' :
    total >= 60 ? 'Good conditions worth riding. ' :
    total >= 40 ? 'Decent conditions with some caveats. ' :
                  'Challenging conditions today. ';

  return prefix + parts.join(' ');
}
