// src/services/scoreEngine.ts
//
// Powder score computation — weights and thresholds reflect real-world conditions.
//
// FIXES:
//   - Thresholds are now region-aware via optional resortProfile.region
//     Michigan/Midwest resorts max out at lower snowfall than Rockies/Sierras
//   - Alert-aware: if a blizzard/storm warning is active, score is boosted
//     for powder-seekers but flagged with a safety note
//   - tempStability scorer now also penalizes freeze-thaw cycles

import type { RiderProfile } from '@prisma/client';
import type { WeatherAlert } from './elevationWeatherService';

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

// Region affects what "great snow" means:
//   midwest:  2" = good, 6" = exceptional
//   rockies:  6" = good, 18" = exceptional
//   sierras:  4" = good, 12" = exceptional
//   northeast: 4" = good, 10" = exceptional
export type SnowRegion = 'midwest' | 'rockies' | 'sierras' | 'northeast' | 'pacific_nw' | 'default';

interface RegionThresholds {
  snow24hPerfect: number;  // inches for 100 score
  snow7dPerfect: number;
  baseDepthPerfect: number;
}

const REGION_THRESHOLDS: Record<SnowRegion, RegionThresholds> = {
  midwest:    { snow24hPerfect: 4,  snow7dPerfect: 12,  baseDepthPerfect: 30  },
  northeast:  { snow24hPerfect: 6,  snow7dPerfect: 18,  baseDepthPerfect: 48  },
  rockies:    { snow24hPerfect: 12, snow7dPerfect: 36,  baseDepthPerfect: 80  },
  sierras:    { snow24hPerfect: 10, snow7dPerfect: 30,  baseDepthPerfect: 72  },
  pacific_nw: { snow24hPerfect: 8,  snow7dPerfect: 24,  baseDepthPerfect: 60  },
  default:    { snow24hPerfect: 6,  snow7dPerfect: 24,  baseDepthPerfect: 60  },
};

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

// Individual scorers — region-aware thresholds
function scoreSnowfall24h(inches: number, t: RegionThresholds) {
  return Math.min(100, (inches / t.snow24hPerfect) * 100);
}
function scoreSnowfall7d(inches: number, t: RegionThresholds) {
  return Math.min(100, (inches / t.snow7dPerfect) * 100);
}
function scoreBaseDepth(inches: number, t: RegionThresholds) {
  return Math.min(100, (inches / t.baseDepthPerfect) * 100);
}

function scoreTempStability(min: number, max: number): number {
  const spread = max - min;
  // Freeze-thaw penalty: if min < 32 and max > 36, icy conditions likely
  if (min < 32 && max > 36) return Math.max(0, 40 - spread * 2);
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

function tempBonus(tempF: number): number {
  if (tempF >= 18 && tempF <= 30) return 10;  // ideal cold powder temp
  if (tempF > 36)  return -15;                // slushy
  if (tempF < 0)   return -15;                // dangerously cold
  if (tempF < 10)  return -5;
  return 0;
}

// Alert bonus: severe storm = powder hunters love it, but add safety flag
function alertBonus(alerts: WeatherAlert[], profile: RiderProfile | null): number {
  if (!alerts.length) return 0;
  const severe = alerts.some(a => a.severity === 'Extreme' || a.severity === 'Severe');
  const isBlizzard = alerts.some(a => a.event.toLowerCase().includes('blizzard'));
  if (!severe && !isBlizzard) return 0;
  // Powder seekers get a boost; beginners get a penalty
  if (profile?.style === 'powder') return 5;
  if (profile?.style === 'beginner' || profile?.skillLevel === 'beginner') return -10;
  return 0; // neutral for other styles
}

export function computeScore(
  snow: SnowData,
  profile: RiderProfile | null = null,
  region: SnowRegion = 'default',
  alerts: WeatherAlert[] = [],
): { score: number; breakdown: ScoreBreakdown; explanation: string } {
  const w     = adjustWeights(profile);
  const t     = REGION_THRESHOLDS[region] || REGION_THRESHOLDS.default;
  const dow   = new Date().getDay();

  const s24h  = scoreSnowfall24h(snow.snowfall24h, t);
  const s7d   = scoreSnowfall7d(snow.snowfall7d, t);
  const sBase = scoreBaseDepth(snow.baseDepthIn, t);
  const sWind = scoreWind(snow.windMph);
  const sTemp = scoreTempStability(snow.tempMinF, snow.tempMaxF);
  const sCrd  = scoreCrowd(dow);
  const tBon  = tempBonus(snow.tempF);
  const aBon  = alertBonus(alerts, profile);

  const weighted = Math.round(
    s24h  * w.snowfall24h  +
    s7d   * w.snowfall7d   +
    sBase * w.baseDepth    +
    sWind * w.wind         +
    sTemp * w.tempStability +
    sCrd  * w.crowd
  );

  const total = Math.min(100, Math.max(0, weighted + tBon + aBon));

  const breakdown: ScoreBreakdown = {
    snowfall24h:   Math.round(s24h),
    snowfall7d:    Math.round(s7d),
    baseDepth:     Math.round(sBase),
    wind:          Math.round(sWind),
    tempStability: Math.round(sTemp),
    crowd:         Math.round(sCrd),
    total,
  };

  return {
    score: total,
    breakdown,
    explanation: generateExplanation(snow, total, region, alerts),
  };
}

function generateExplanation(
  snow: SnowData,
  total: number,
  region: SnowRegion,
  alerts: WeatherAlert[],
): string {
  const parts: string[] = [];

  // Alert first — most important
  const blizzard = alerts.find(a =>
    a.event.toLowerCase().includes('blizzard') || a.event.toLowerCase().includes('winter storm')
  );
  if (blizzard) {
    parts.push(`⚠ ${blizzard.event} in effect. ${blizzard.headline.split('.')[0]}.`);
  }

  const t = REGION_THRESHOLDS[region] || REGION_THRESHOLDS.default;

  if (snow.snowfall24h >= t.snow24hPerfect)
    parts.push(`Outstanding fresh snowfall — ${snow.snowfall24h}" in the last 24 hours.`);
  else if (snow.snowfall24h >= t.snow24hPerfect * 0.4)
    parts.push(`Good recent snowfall of ${snow.snowfall24h}" in the past day.`);
  else if (snow.snowfall24h > 0)
    parts.push(`Light dusting of ${snow.snowfall24h}" in the past 24 hours.`);
  else
    parts.push('No new snowfall in the past 24 hours.');

  if (snow.baseDepthIn >= t.baseDepthPerfect)
    parts.push(`Deep base of ${snow.baseDepthIn}" ensures full coverage.`);
  else if (snow.baseDepthIn >= t.baseDepthPerfect * 0.4)
    parts.push(`Moderate base depth of ${snow.baseDepthIn}".`);
  else
    parts.push(`Thin base of ${snow.baseDepthIn}" — watch for rocks on lower runs.`);

  if (snow.windMph <= 10)
    parts.push('Calm winds — ideal conditions.');
  else if (snow.windMph <= 25)
    parts.push(`Moderate winds at ${Math.round(snow.windMph)} mph.`);
  else
    parts.push(`High winds at ${Math.round(snow.windMph)} mph — upper lifts may be on hold.`);

  if (snow.tempF > 36)
    parts.push(`Warm temps at ${Math.round(snow.tempF)}°F — expect soft or slushy conditions.`);
  else if (snow.tempF < 10)
    parts.push(`Very cold at ${Math.round(snow.tempF)}°F — dress in layers.`);
  else if (snow.tempF >= 18 && snow.tempF <= 30)
    parts.push(`Ideal temperature at ${Math.round(snow.tempF)}°F.`);

  const prefix =
    total >= 80 ? 'Outstanding conditions! ' :
    total >= 65 ? 'Great day on the mountain. ' :
    total >= 50 ? 'Decent conditions. ' :
    total >= 35 ? 'Fair conditions with some caveats. ' :
                  'Challenging conditions today. ';

  return prefix + parts.join(' ');
}
