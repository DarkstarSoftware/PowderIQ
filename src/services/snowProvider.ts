// src/services/snowProvider.ts
//
// Reads snow/weather data for scoring from the ElevationWeather cache,
// which is populated by the blended Open-Meteo + OpenWeather + NOAA service.
// Falls back to direct Open-Meteo fetch if no cached weather exists yet.

import { prisma } from '@/lib/prisma';
import type { SnowData } from './scoreEngine';

const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

// Pull snow data from the elevation weather cache
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

  const summit = zones.find(z => z.zone === 'summit');
  const base   = zones.find(z => z.zone === 'base');
  const best   = summit ?? base ?? zones[0];

  // snowfall7d: sum actual 48h + 72h snowfall fields as proxy for recent accumulation
  // forecastSnowIn is today's forecast — not 7d historical
  const snow7d = (best.snowfall48hIn ?? 0) + (best.snowfall72hIn ?? 0);

  return {
    snowfall24h: best.snowfall24hIn,
    snowfall7d:  Math.max(snow7d, best.snowfall24hIn), // at minimum, at least 24h
    baseDepthIn: base?.snowDepthIn ?? best.snowDepthIn,
    windMph:     summit?.windMph ?? best.windMph,
    tempF:       best.tempF,
    tempMinF:    best.forecastLow  ?? (best.tempF - 8),
    tempMaxF:    best.forecastHigh ?? (best.tempF + 5),
  };
}

// Direct Open-Meteo fetch — fetches both summit (for conditions) and base (for depth)
async function fetchOpenMeteoSnow(
  lat: number,
  lon: number,
  baseElevFt: number,
  summitElevFt: number
): Promise<SnowData> {
  const summitElevM = Math.round(summitElevFt * 0.3048);
  const baseElevM   = Math.round(baseElevFt   * 0.3048);

  const [summitRes, baseRes] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,windspeed_10m,snowfall,snow_depth` +
      `&hourly=snowfall` +
      `&daily=temperature_2m_max,temperature_2m_min,snowfall_sum` +
      `&temperature_unit=fahrenheit&windspeed_unit=mph&precipitation_unit=inch` +
      `&timezone=auto&forecast_days=7&past_days=7&elevation=${summitElevM}`,
      { next: { revalidate: 3600 } }
    ),
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=snow_depth` +
      `&temperature_unit=fahrenheit&windspeed_unit=mph&precipitation_unit=inch` +
      `&timezone=auto&forecast_days=1&elevation=${baseElevM}`,
      { next: { revalidate: 3600 } }
    ),
  ]);

  if (!summitRes.ok) throw new Error(`Open-Meteo ${summitRes.status}`);
  const summit = await summitRes.json();
  const base   = baseRes.ok ? await baseRes.json() : null;

  const daily  = summit.daily ?? {};
  const hourly = summit.hourly ?? {};

  // Past 7 days actual snowfall (past_days=7 gives us historical data)
  const allDailySnow: number[] = daily?.snowfall_sum ?? [];
  // past_days=7 + forecast_days=7 = 14 days total; past 7 = first 7 entries
  const past7d = allDailySnow.slice(0, 7).reduce((s: number, v: number) => s + (v ?? 0), 0);

  // Past 24h snowfall from hourly data
  const allHourlySnow: number[] = hourly?.snowfall ?? [];
  const allHourlyTimes: string[] = hourly?.time ?? [];
  const now = new Date();
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  let snow24h = 0;
  for (let i = 0; i < allHourlyTimes.length; i++) {
    const t = new Date(allHourlyTimes[i]);
    if (t >= cutoff24h && t <= now) snow24h += allHourlySnow[i] ?? 0;
  }

  const baseDepthM   = base?.current?.snow_depth ?? summit.current?.snow_depth ?? 0;

  return {
    snowfall24h: Math.round(snow24h * 10) / 10,
    snowfall7d:  Math.round(past7d  * 10) / 10,
    baseDepthIn: Math.round(baseDepthM * 39.3701 * 10) / 10,
    windMph:     summit.current?.windspeed_10m ?? 0,
    tempF:       summit.current?.temperature_2m ?? 28,
    tempMinF:    daily?.temperature_2m_min?.[7] ?? 20, // index 7 = today (after past_days)
    tempMaxF:    daily?.temperature_2m_max?.[7] ?? 35,
  };
}

export async function getSnowDataCached(
  mountainId: string,
  lat: number,
  lon: number
): Promise<SnowData> {
  const now = new Date();

  // 1. Try elevation weather cache first
  const fromElevation = await getSnowFromElevationWeather(mountainId);
  if (fromElevation) return fromElevation;

  // 2. Try snow snapshot cache
  const cached = await prisma.snowSnapshot.findFirst({
    where: { mountainId, expiresAt: { gt: now } },
    orderBy: { fetchedAt: 'desc' },
  });
  if (cached) return cached.payload as unknown as SnowData;

  // 3. Fetch fresh from Open-Meteo
  const mountain = await prisma.mountain.findUnique({ where: { id: mountainId } });
  const baseElev   = mountain?.baseElevFt ?? 1000;
  const summitElev = mountain?.topElevFt  ?? 3000;

  let data: SnowData;
  try {
    data = await fetchOpenMeteoSnow(lat, lon, baseElev, summitElev);
  } catch (e) {
    console.warn('[SnowProvider] Open-Meteo failed:', e);
    // Return zeroed data rather than fake mock — a score of 0 is more honest than fake data
    data = {
      snowfall24h: 0,
      snowfall7d:  0,
      baseDepthIn: 0,
      windMph:     10,
      tempF:       28,
      tempMinF:    20,
      tempMaxF:    35,
    };
  }

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

// Backwards compatibility exports
export class MockSnowProvider {
  name = 'mock';
  async fetchSnowData(mountainId: string): Promise<SnowData> {
    return getSnowDataCached(mountainId, 0, 0);
  }
}
export class OpenWeatherSnowProvider {
  name = 'openweather';
  async fetchSnowData(_: string, lat: number, lon: number): Promise<SnowData> {
    return fetchOpenMeteoSnow(lat, lon, 1000, 3000);
  }
}
export function getSnowProvider() { return new OpenWeatherSnowProvider(); }
