// src/services/scoreEngine.ts

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
  snowfall24h:   0.30,
  snowfall7d:    0.15,
  baseDepth:     0.15,
  wind:          0.20,
  tempStability: 0.10,
  crowd:         0.10,
};

function adjustWeights(profile: RiderProfile | null): Weights {
  const w = { ...DEFAULT_WEIGHTS };
  if (!profile) return w;

  if (profile.style === 'powder') {
    w.snowfall24h  = 0.40; w.snowfall7d   = 0.20;
    w.baseDepth    = 0.15; w.wind         = 0.10;
    w.tempStability= 0.05; w.crowd        = 0.10;
  } else if (profile.style === 'beginner' || profile.skillLevel === 'beginner') {
    w.wind         = 0.15; w.crowd        = 0.20;
    w.tempStability= 0.15; w.snowfall24h  = 0.20;
    w.snowfall7d   = 0.15; w.baseDepth    = 0.15;
  } else if (profile.style === 'freestyle') {
    w.snowfall24h  = 0.20; w.snowfall7d   = 0.10;
    w.baseDepth    = 0.20; w.wind         = 0.20;
    w.tempStability= 0.15; w.crowd        = 0.15;
  }

  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  Object.keys(w).forEach(k => { w[k] /= sum; });
  return w;
}

// Individual component scorers (0–100)
// Thresholds reflect real-world conditions, not inflated mock data:
//   - 6" in 24h is an excellent powder day (not 18")
//   - 24" in 7 days is exceptional (not 36")
//   - 48" base is solid coverage (not 120")
const scoreSnowfall24h   = (i: number) => Math.min(100, (i / 6)  * 100);  // 6"  = perfect
const scoreSnowfall7d    = (i: number) => Math.min(100, (i / 24) * 100);  // 24" = perfect
const scoreBaseDepth     = (i: number) => Math.min(100, (i / 60) * 100);  // 60" = full coverage
const scoreTempStability = (min: number, max: number) => {
  const spread = max - min;
  if (spread <= 5)  return 100;
  if (spread >= 40) return 0;
  return 100 - (spread / 40) * 100;
};
const scoreWind = (mph: number) => {
  if (mph <= 5)  return 100;
  if (mph >= 50) return 0;
  return 100 - ((mph - 5) / 45) * 100;
};
const scoreCrowd = (dayOfWeek: number) =>
  dayOfWeek === 0 || dayOfWeek === 6 ? 30 : 80;

// Temperature penalty: very warm (above 38°F) softens snow, very cold (below 5°F) is harsh
function scoreTempBonus(tempF: number): number {
  if (tempF >= 20 && tempF <= 32) return 10;  // ideal skiing temp — small bonus
  if (tempF > 36) return -15;                  // slushy/icy — penalty
  if (tempF < 5)  return -10;                  // dangerously cold — penalty
  return 0;
}

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
  const tBonus = scoreTempBonus(snow.tempF);

  const weighted = Math.round(
    s24h  * w.snowfall24h +
    s7d   * w.snowfall7d +
    sBase * w.baseDepth +
    sWind * w.wind +
    sTemp * w.tempStability +
    sCrd  * w.crowd
  );

  const total = Math.min(100, Math.max(0, weighted + tBonus));

  const breakdown: ScoreBreakdown = {
    snowfall24h:   Math.round(s24h),
    snowfall7d:    Math.round(s7d),
    baseDepth:     Math.round(sBase),
    wind:          Math.round(sWind),
    tempStability: Math.round(sTemp),
    crowd:         Math.round(sCrd),
    total,
  };

  return { score: total, breakdown, explanation: generateExplanation(snow, total) };
}

function generateExplanation(snow: SnowData, total: number): string {
  const parts: string[] = [];

  if (snow.snowfall24h >= 6)
    parts.push(`Excellent fresh snowfall of ${snow.snowfall24h}" in the last 24 hours.`);
  else if (snow.snowfall24h >= 2)
    parts.push(`Good recent snowfall of ${snow.snowfall24h}" in the past day.`);
  else if (snow.snowfall24h > 0)
    parts.push(`Light dusting of ${snow.snowfall24h}" in the past 24 hours.`);
  else
    parts.push('No new snowfall in the past 24 hours.');

  if (snow.baseDepthIn >= 60)
    parts.push(`Deep base of ${snow.baseDepthIn}" ensures full coverage.`);
  else if (snow.baseDepthIn >= 30)
    parts.push(`Moderate base depth of ${snow.baseDepthIn}".`);
  else
    parts.push(`Thin base of ${snow.baseDepthIn}" — watch for rocks on lower runs.`);

  if (snow.windMph <= 10)
    parts.push('Calm winds — ideal conditions.');
  else if (snow.windMph <= 25)
    parts.push(`Moderate winds at ${Math.round(snow.windMph)} mph.`);
  else
    parts.push(`High winds at ${Math.round(snow.windMph)} mph may close upper lifts.`);

  if (snow.tempF > 36)
    parts.push(`Warm temps at ${Math.round(snow.tempF)}°F — expect soft or slushy conditions.`);
  else if (snow.tempF < 10)
    parts.push(`Very cold at ${Math.round(snow.tempF)}°F — dress in layers.`);

  const prefix =
    total >= 80 ? 'Outstanding conditions! ' :
    total >= 65 ? 'Great day on the mountain. ' :
    total >= 50 ? 'Decent conditions. ' :
    total >= 35 ? 'Fair conditions with some caveats. ' :
                  'Challenging conditions today. ';

  return prefix + parts.join(' ');
}
