// src/services/scoreEngine.ts

import type { RiderProfile } from '@prisma/client';

export interface SnowData {
  snowfall24h:  number; // inches in last 24h
  snowfall48h?: number; // inches in last 48h (optional)
  snowfall72h?: number; // inches in last 72h (optional)
  snowfall7d:   number; // inches in last 7 days
  baseDepthIn:  number; // current base depth inches
  windMph:      number;
  tempF:        number;
  tempMinF:     number;
  tempMaxF:     number;
  forecastSnow24h?: number; // optional forecast
  // Season context
  verticalFt?:  number; // resort vertical drop — used to calibrate thresholds
  isOpenSeason?: boolean; // explicitly set if known
}

export interface ScoreBreakdown {
  snowfall24h:   number;
  snowfall7d:    number;
  baseDepth:     number;
  wind:          number;
  tempStability: number;
  crowd:         number;
  seasonPenalty: number;
  total:         number;
}

type Weights = Record<string, number>;

const DEFAULT_WEIGHTS: Weights = {
  snowfall24h:   0.30,
  snowfall7d:    0.15,
  baseDepth:     0.20,
  wind:          0.15,
  tempStability: 0.10,
  crowd:         0.10,
};

function adjustWeights(profile: RiderProfile | null): Weights {
  const w = { ...DEFAULT_WEIGHTS };
  if (!profile) return w;

  if (profile.style === 'powder') {
    w.snowfall24h   = 0.40; w.snowfall7d    = 0.20;
    w.baseDepth     = 0.15; w.wind          = 0.10;
    w.tempStability = 0.05; w.crowd         = 0.10;
  } else if (profile.style === 'beginner' || profile.skillLevel === 'beginner') {
    w.wind          = 0.15; w.crowd         = 0.20;
    w.tempStability = 0.15; w.snowfall24h   = 0.20;
    w.snowfall7d    = 0.15; w.baseDepth     = 0.15;
  } else if (profile.style === 'freestyle') {
    w.snowfall24h   = 0.20; w.snowfall7d    = 0.10;
    w.baseDepth     = 0.20; w.wind          = 0.20;
    w.tempStability = 0.15; w.crowd         = 0.15;
  }

  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  Object.keys(w).forEach(k => { w[k] /= sum; });
  return w;
}

// ── Season detection ──────────────────────────────────────────────────────────
// Returns true if it's currently ski season for a given hemisphere/latitude.
// Uses Northern Hemisphere ski season: Nov 15 – Apr 15.
// Resorts at low elevation (< 2000ft vertical) tend to close earlier.
export function isSkiSeason(now: Date = new Date(), verticalFt = 1000): boolean {
  const month = now.getMonth(); // 0-indexed
  const day   = now.getDate();

  // Northern hemisphere ski season: Nov 15 – Apr 15
  const afterNov15  = month === 10 && day >= 15 || month > 10;
  const beforeApr15 = month === 3  && day <= 15 || month < 3;
  const inSeason    = afterNov15 || beforeApr15;

  if (!inSeason) return false;

  // Small/low-vertical resorts (< 500ft like Pine Knob) close by late March
  if (verticalFt < 500) {
    const afterMar20 = month === 2 && day >= 20 || month > 2;
    if (afterMar20) return false;
  }
  // Mid-sized resorts close by early April
  if (verticalFt < 1500) {
    const afterApr1 = month === 3 && day >= 1 || month > 3;
    if (afterApr1) return false;
  }

  return true;
}

// ── Calibrated component scorers ─────────────────────────────────────────────
// Thresholds scale with resort size (vertical drop).
// A 6" storm at a 300ft resort is proportionally bigger than at a 3000ft resort.
function getThresholds(verticalFt: number) {
  // Scale based on vertical: small = 300ft, large = 3000ft
  const scale = Math.min(1.0, Math.max(0.25, verticalFt / 3000));
  return {
    snow24hPerfect:  6  * scale,  // inches for perfect 24h score
    snow7dPerfect:   24 * scale,  // inches for perfect 7d score
    baseDepthFull:   60 * scale,  // inches for full base coverage
  };
}

function scoreSnowfall24h(inches: number, verticalFt: number): number {
  const { snow24hPerfect } = getThresholds(verticalFt);
  return Math.min(100, (inches / snow24hPerfect) * 100);
}

function scoreSnowfall7d(inches: number, verticalFt: number): number {
  const { snow7dPerfect } = getThresholds(verticalFt);
  return Math.min(100, (inches / snow7dPerfect) * 100);
}

function scoreBaseDepth(inches: number, verticalFt: number): number {
  const { baseDepthFull } = getThresholds(verticalFt);
  if (inches < 6) return Math.max(0, inches * 5);  // < 6" is very bad for any resort
  return Math.min(100, (inches / baseDepthFull) * 100);
}

function scoreTempStability(min: number, max: number): number {
  const spread = max - min;
  if (spread <= 5)  return 100;
  if (spread >= 40) return 0;
  return 100 - (spread / 40) * 100;
}

function scoreWind(mph: number): number {
  if (mph <= 5)  return 100;
  if (mph >= 50) return 0;
  return 100 - ((mph - 5) / 45) * 100;
}

function scoreCrowd(dayOfWeek: number): number {
  return dayOfWeek === 0 || dayOfWeek === 6 ? 30 : 80;
}

function scoreTempBonus(tempF: number): number {
  if (tempF >= 20 && tempF <= 32) return 10;
  if (tempF > 38) return -20;   // slushy/icy
  if (tempF > 34) return -10;   // softening
  if (tempF < 5)  return -10;   // dangerously cold
  return 0;
}

// ── Main scoring function ─────────────────────────────────────────────────────

export function computeScore(
  snow: SnowData,
  profile: RiderProfile | null = null
): { score: number; breakdown: ScoreBreakdown; explanation: string } {
  const now       = new Date();
  const vertical  = snow.verticalFt ?? 1500;
  const dow       = now.getDay();
  const w         = adjustWeights(profile);

  // ── Season check ──────────────────────────────────────────────────────────
  // If explicitly told it's closed, or if we detect it's out of season, score = 0
  const inSeason = snow.isOpenSeason !== undefined
    ? snow.isOpenSeason
    : isSkiSeason(now, vertical);

  if (!inSeason) {
    const breakdown: ScoreBreakdown = {
      snowfall24h: 0, snowfall7d: 0, baseDepth: 0,
      wind: 0, tempStability: 0, crowd: 0, seasonPenalty: -100, total: 0,
    };
    return {
      score: 0,
      breakdown,
      explanation: 'This resort is currently closed for the season.',
    };
  }

  // ── Component scores ──────────────────────────────────────────────────────
  const s24h  = scoreSnowfall24h(snow.snowfall24h, vertical);
  const s7d   = scoreSnowfall7d(snow.snowfall7d,   vertical);
  const sBase = scoreBaseDepth(snow.baseDepthIn,   vertical);
  const sWind = scoreWind(snow.windMph);
  const sTemp = scoreTempStability(snow.tempMinF, snow.tempMaxF);
  const sCrd  = scoreCrowd(dow);
  const tBonus = scoreTempBonus(snow.tempF);

  const weighted = Math.round(
    s24h  * w.snowfall24h +
    s7d   * w.snowfall7d  +
    sBase * w.baseDepth   +
    sWind * w.wind        +
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
    seasonPenalty: tBonus,
    total,
  };

  return { score: total, breakdown, explanation: generateExplanation(snow, total, vertical) };
}

function generateExplanation(snow: SnowData, total: number, verticalFt: number): string {
  const parts: string[] = [];

  if (snow.snowfall24h >= 4)
    parts.push(`Great fresh snowfall — ${snow.snowfall24h}" in the last 24 hours.`);
  else if (snow.snowfall24h >= 1)
    parts.push(`Some fresh snow — ${snow.snowfall24h}" in the past day.`);
  else if (snow.snowfall24h > 0)
    parts.push(`Light dusting of ${snow.snowfall24h}" overnight.`);
  else
    parts.push('No new snowfall in the past 24 hours.');

  const depthLabel = verticalFt < 500 ? 30 : verticalFt < 1500 ? 48 : 60;
  if (snow.baseDepthIn >= depthLabel)
    parts.push(`Solid base of ${snow.baseDepthIn}".`);
  else if (snow.baseDepthIn >= depthLabel * 0.5)
    parts.push(`Base depth ${snow.baseDepthIn}" — adequate coverage.`);
  else if (snow.baseDepthIn > 0)
    parts.push(`Thin base of ${snow.baseDepthIn}" — watch for rocks on lower runs.`);
  else
    parts.push('Base depth data unavailable.');

  if (snow.windMph <= 10)
    parts.push('Calm winds.');
  else if (snow.windMph <= 25)
    parts.push(`Moderate winds at ${Math.round(snow.windMph)} mph.`);
  else
    parts.push(`High winds at ${Math.round(snow.windMph)} mph — upper lifts may be on hold.`);

  if (snow.tempF > 38)
    parts.push(`Warm at ${Math.round(snow.tempF)}°F — expect soft or slushy conditions.`);
  else if (snow.tempF >= 20 && snow.tempF <= 32)
    parts.push(`Ideal temperature at ${Math.round(snow.tempF)}°F.`);
  else if (snow.tempF < 10)
    parts.push(`Very cold at ${Math.round(snow.tempF)}°F — dress in layers.`);

  const prefix =
    total >= 80 ? 'Outstanding powder day! ' :
    total >= 65 ? 'Great conditions. ' :
    total >= 50 ? 'Decent conditions. ' :
    total >= 35 ? 'Fair conditions. ' :
                  'Challenging conditions today. ';

  return prefix + parts.join(' ');
}
