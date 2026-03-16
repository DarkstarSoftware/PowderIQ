// src/services/snowProvider.ts
//
// Reads snow/weather data for scoring and the forecast API endpoint.
// Priority:
//   1. ElevationWeather DB cache (populated by elevationWeatherService — most accurate)
//   2. Direct Open-Meteo fetch with past_days=3 (no API key needed)
//   3. Mock fallback (deterministic from mountainId seed)
//
// FIXES:
//   - SnowData now includes snowfall48h, snowfall72h, forecastSnow24h
//   - Open-Meteo fallback uses past_days=3 and correct mm→inch conversion
//   - ElevationWeather reader maps all new fields

import { prisma } from '@/lib/prisma';
import type { SnowData } from './scoreEngine';

export { SnowData };

const CACHE_TTL_MS  = 3 * 60 * 60 * 1000; // 3 hours for snapshot cache
const MM_TO_IN      = 1 / 25.4;

// ─── Read from ElevationWeather cache ────────────────────────────────────────
// This is populated by elevationWeatherService (blends Open-Meteo + OWM + NOAA)
// and has all the new snowfall window fields.

async function getSnowFromElevationWeather(mountainId: string): Promise<SnowData | null> {
  const resort = await prisma.resort.findFirst({
    where: { mountainId },
    select: { id: true },
  });
  if (!resort) return null;

  const now   = new Date();
  const zones = await prisma.elevationWeather.findMany({
    where: { resortId: resort.id, expiresAt: { gt: now } },
  });
  if (!zones.length) return null;

  // Prefer summit for snowfall (more accumulation), base for depth
  const summit = zones.find(z => z.zone === 'summit');
  const base   = zones.find(z => z.zone === 'base');
  const best   = summit ?? base ?? zones[0];

  return {
    snowfall24h:      best.snowfall24hIn ?? 0,
    snowfall48h:      (best as any).snowfall48hIn ?? (best.snowfall24hIn * 1.8),
    snowfall72h:      (best as any).snowfall72hIn ?? (best.snowfall24hIn * 2.5),
    forecastSnow24h:  (best as any).forecastSnow24hIn ?? (best.forecastSnowIn ?? 0),
    snowfall7d:       (best.forecastSnowIn ?? 0) * 7,
    baseDepthIn:      base?.snowDepthIn ?? best.snowDepthIn ?? 0,
    windMph:          summit?.windMph ?? best.windMph ?? 0,
    tempF:            best.tempF ?? 28,
    tempMinF:         best.forecastLow  ?? (best.tempF - 8),
    tempMaxF:         best.forecastHigh ?? (best.tempF + 5),
  };
}

// ─── Direct Open-Meteo fetch ──────────────────────────────────────────────────
// Used when ElevationWeather cache is cold (first load, new resort, etc.)
// Uses past_days=3 to get real historical snowfall for 24/48/72h windows.

async function fetchOpenMeteoSnow(
  lat: number,
  lon: number,
  baseElevFt: number,
  summitElevFt: number,
): Promise<SnowData> {
  const summitElevM = Math.round(summitElevFt * 0.3048);
  const baseElevM   = Math.round(baseElevFt   * 0.3048);

  const [summitRes, baseRes] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,windspeed_10m,snowfall,snow_depth` +
      `&hourly=snowfall,snow_depth` +
      `&daily=temperature_2m_max,temperature_2m_min,snowfall_sum` +
      `&temperature_unit=fahrenheit&windspeed_unit=mph&precipitation_unit=inch` +
      `&timezone=auto&forecast_days=7&past_days=3` +  // past_days gives 72h history
      `&elevation=${summitElevM}`,
      { cache: 'no-store' },
    ),
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=snow_depth` +
      `&temperature_unit=fahrenheit&windspeed_unit=mph&precipitation_unit=inch` +
      `&timezone=auto&forecast_days=1&elevation=${baseElevM}`,
      { cache: 'no-store' },
    ),
  ]);

  if (!summitRes.ok) throw new Error(`Open-Meteo ${summitRes.status}`);
  const summit = await summitRes.json();
  const base   = baseRes.ok ? await baseRes.json() : null;

  const daily         = summit.daily ?? {};
  const hourlyTimes: string[]  = summit.hourly?.time ?? [];
  // Hourly snowfall is ALWAYS in mm regardless of precipitation_unit
  const hourlySnowMm: number[] = summit.hourly?.snowfall ?? [];

  // Find current hour index in the hourly array (which starts 3 days ago)
  const now    = new Date();
  const nowIdx = hourlyTimes.findIndex(t => new Date(t) >= now);
  const idx    = nowIdx > 0 ? nowIdx : hourlyTimes.length;

  // Sum past N hours of snowfall mm → inches
  function sumPastHours(hours: number): number {
    const mm = hourlySnowMm
      .slice(Math.max(0, idx - hours), idx)
      .reduce((s, v) => s + (v ?? 0), 0);
    return Math.round(mm * MM_TO_IN * 10) / 10;
  }

  // Sum next N hours of forecast snowfall mm → inches
  function sumNextHours(hours: number): number {
    const mm = hourlySnowMm
      .slice(idx, idx + hours)
      .reduce((s, v) => s + (v ?? 0), 0);
    return Math.round(mm * MM_TO_IN * 10) / 10;
  }

  // With past_days=3, daily array: [0]=3daysAgo [1]=2daysAgo [2]=yesterday [3]=today [4+]=forecast
  const dailySnow: number[] = daily.snowfall_sum ?? [];
  const todayIn      = dailySnow[3] ?? dailySnow[dailySnow.length - 4] ?? 0;
  const yesterdayIn  = dailySnow[2] ?? 0;
  const twoDaysAgoIn = dailySnow[1] ?? 0;
  const forecastTomorrow = dailySnow[4] ?? 0;

  // Use max of hourly sum vs daily totals — daily is more reliable for large storms
  const snow24h = Math.max(sumPastHours(24), todayIn);
  const snow48h = Math.max(sumPastHours(48), todayIn + yesterdayIn);
  const snow72h = Math.max(sumPastHours(72), todayIn + yesterdayIn + twoDaysAgoIn);
  const forecastSnow24h = Math.max(sumNextHours(24), forecastTomorrow);

  // 7-day forecast: daily[3] onwards
  const snow7d = dailySnow.slice(3, 10).reduce((s: number, v: number) => s + (v ?? 0), 0);

  // Base depth from base elevation fetch, snow depth in meters → inches
  const baseDepthM   = base?.current?.snow_depth ?? summit.current?.snow_depth ?? 0;
  const baseDepthIn  = Math.round(baseDepthM * 39.3701 * 10) / 10;

  return {
    snowfall24h:     snow24h,
    snowfall48h:     snow48h,
    snowfall72h:     snow72h,
    forecastSnow24h: forecastSnow24h,
    snowfall7d:      Math.round(snow7d * 10) / 10,
    baseDepthIn:     baseDepthIn,
    windMph:         summit.current?.windspeed_10m ?? 0,
    tempF:           summit.current?.temperature_2m ?? 28,
    tempMinF:        daily.temperature_2m_min?.[3] ?? 20,
    tempMaxF:        daily.temperature_2m_max?.[3] ?? 35,
  };
}

// ─── Mock fallback ────────────────────────────────────────────────────────────

function mockSnowData(mountainId: string): SnowData {
  const seed = mountainId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const r = (min: number, max: number, off = 0) => min + ((seed + off) % (max - min + 1));
  const s24 = r(0, 6, 1);
  return {
    snowfall24h:     s24,
    snowfall48h:     s24 + r(0, 4, 8),
    snowfall72h:     s24 + r(0, 8, 9),
    forecastSnow24h: r(0, 4, 10),
    snowfall7d:      r(2, 20, 2),
    baseDepthIn:     r(20, 80, 3),
    windMph:         r(3, 25, 4),
    tempF:           r(18, 38, 5),
    tempMinF:        r(10, 25, 6),
    tempMaxF:        r(26, 38, 7),
  };
}

// ─── Main cached fetch ────────────────────────────────────────────────────────

export async function getSnowDataCached(
  mountainId: string,
  lat: number,
  lon: number,
): Promise<SnowData> {
  const now = new Date();

  // 1. ElevationWeather cache (most accurate — blended sources with correct units)
  const fromElevation = await getSnowFromElevationWeather(mountainId);
  if (fromElevation) return fromElevation;

  // 2. SnowSnapshot cache
  const cached = await prisma.snowSnapshot.findFirst({
    where: { mountainId, expiresAt: { gt: now } },
    orderBy: { fetchedAt: 'desc' },
  });
  if (cached) return cached.payload as unknown as SnowData;

  // 3. Fresh Open-Meteo fetch
  const mountain = await prisma.mountain.findUnique({ where: { id: mountainId } });
  const baseElev   = mountain?.baseElevFt ?? 4000;
  const summitElev = mountain?.topElevFt  ?? 8000;

  let data: SnowData;
  try {
    data = await fetchOpenMeteoSnow(lat, lon, baseElev, summitElev);
  } catch (e) {
    console.warn('[SnowProvider] Open-Meteo failed, using mock:', e);
    data = mockSnowData(mountainId);
  }

  // Cache in SnowSnapshot for 3h
  await prisma.snowSnapshot.create({
    data: {
      mountainId,
      provider: 'open-meteo',
      payload:  data as object,
      expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
    },
  });

  return data;
}

// Backwards-compatible exports
export class MockSnowProvider {
  name = 'mock';
  async fetchSnowData(mountainId: string): Promise<SnowData> { return mockSnowData(mountainId); }
}
export class OpenWeatherSnowProvider {
  name = 'openweather';
  async fetchSnowData(_: string, lat: number, lon: number): Promise<SnowData> {
    return fetchOpenMeteoSnow(lat, lon, 4000, 8000);
  }
}
export function getSnowProvider() { return new OpenWeatherSnowProvider(); }
