// src/services/snowProvider.ts
//
// Reads snow/weather data for scoring from the ElevationWeather cache,
// which is populated by the blended Open-Meteo + OpenWeather + NOAA service.
// Falls back to direct Open-Meteo fetch if no cached weather exists yet.

import { prisma } from '@/lib/prisma';
import type { SnowData } from './scoreEngine';

const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

// Pull snow data from the elevation weather cache (summit zone is most relevant for scoring)
async function getSnowFromElevationWeather(mountainId: string): Promise<SnowData | null> {
  // Find the resort for this mountain
  const resort = await prisma.resort.findFirst({
    where: { mountainId },
    select: { id: true },
  });
  if (!resort) return null;

  const now = new Date();
  const zones = await prisma.elevationWeather.findMany({
    where: { resortId: resort.id, expiresAt: { gt: now } },
  });
  if (!zones.length) return null;

  const summit = zones.find(z => z.zone === 'summit');
  const base   = zones.find(z => z.zone === 'base');
  const best   = summit ?? base ?? zones[0];

  return {
    snowfall24h: best.snowfall24hIn,
    snowfall7d:  (best.forecastSnowIn ?? 0) * 7, // forecastSnowIn is daily avg
    baseDepthIn: base?.snowDepthIn ?? best.snowDepthIn,
    windMph:     summit?.windMph ?? best.windMph,
    tempF:       best.tempF,
    tempMinF:    best.forecastLow  ?? (best.tempF - 8),
    tempMaxF:    best.forecastHigh ?? (best.tempF + 5),
  };
}

// Direct Open-Meteo fetch as fallback (no API key needed)
async function fetchOpenMeteoSnow(lat: number, lon: number, baseElevFt: number, summitElevFt: number): Promise<SnowData> {
  const summitElevM = Math.round(summitElevFt * 0.3048);
  const baseElevM   = Math.round(baseElevFt * 0.3048);

  const [summitRes, baseRes] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,windspeed_10m,snowfall,snow_depth` +
      `&daily=temperature_2m_max,temperature_2m_min,snowfall_sum` +
      `&temperature_unit=fahrenheit&windspeed_unit=mph&precipitation_unit=inch` +
      `&timezone=auto&forecast_days=7&elevation=${summitElevM}`,
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

  const daily = summit.daily;
  const snow7d = (daily?.snowfall_sum ?? []).slice(0, 7).reduce((s: number, v: number) => s + (v ?? 0), 0);

  // 24h snowfall: sum last 24 hourly values
  const nowIdx = summit.hourly?.time?.findIndex((t: string) => new Date(t) >= new Date()) ?? 24;
  const snow24h = (summit.hourly?.snowfall ?? [])
    .slice(Math.max(0, nowIdx - 24), nowIdx)
    .reduce((s: number, v: number) => s + (v ?? 0), 0);

  const baseDepthM   = base?.current?.snow_depth ?? summit.current?.snow_depth ?? 0;
  const summitDepthM = summit.current?.snow_depth ?? 0;

  return {
    snowfall24h: Math.round(snow24h * 10) / 10,
    snowfall7d:  Math.round(snow7d * 10) / 10,
    baseDepthIn: Math.round(baseDepthM * 39.3701 * 10) / 10,
    windMph:     summit.current?.windspeed_10m ?? 0,
    tempF:       summit.current?.temperature_2m ?? 28,
    tempMinF:    daily?.temperature_2m_min?.[0] ?? 20,
    tempMaxF:    daily?.temperature_2m_max?.[0] ?? 35,
  };
}

// Mock fallback (deterministic, last resort)
function mockSnowData(mountainId: string): SnowData {
  const seed = mountainId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const r = (min: number, max: number, off = 0) => min + ((seed + off) % (max - min + 1));
  return {
    snowfall24h: r(0, 6, 1),   // realistic: 0-6" not 0-18"
    snowfall7d:  r(2, 20, 2),  // realistic: 2-20" not 5-36"
    baseDepthIn: r(20, 80, 3), // realistic base depth
    windMph:     r(3, 25, 4),
    tempF:       r(18, 38, 5),
    tempMinF:    r(10, 25, 6),
    tempMaxF:    r(26, 38, 7),
  };
}

export async function getSnowDataCached(
  mountainId: string,
  lat: number,
  lon: number
): Promise<SnowData> {
  const now = new Date();

  // 1. Try elevation weather cache first (most accurate — blended sources)
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
  const baseElev   = mountain?.baseElevFt ?? 4000;
  const summitElev = mountain?.topElevFt  ?? 8000;

  let data: SnowData;
  try {
    data = await fetchOpenMeteoSnow(lat, lon, baseElev, summitElev);
  } catch (e) {
    console.warn('[SnowProvider] Open-Meteo failed, using mock:', e);
    data = mockSnowData(mountainId);
  }

  await prisma.snowSnapshot.create({
    data: {
      mountainId,
      provider: 'open-meteo',
      payload: data as object,
      expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
    },
  });

  return data;
}

// Keep these exports for backwards compatibility
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
