import { prisma } from '@/lib/prisma';
import type { SnowData } from './scoreEngine';

export interface SnowProvider {
  name: string;
  fetchSnowData(mountainId: string, lat: number, lon: number): Promise<SnowData>;
}

// ─── Mock Provider (always available) ────────────────────────────────────────

export class MockSnowProvider implements SnowProvider {
  name = 'mock';

  async fetchSnowData(mountainId: string): Promise<SnowData> {
    // Deterministic pseudo-random values based on mountain id
    const seed = mountainId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const r = (min: number, max: number, offset = 0) =>
      min + ((seed + offset) % (max - min + 1));
    return {
      snowfall24h:  r(0, 18, 1),
      snowfall7d:   r(5, 36, 2),
      baseDepthIn:  r(30, 110, 3),
      windMph:      r(3, 35, 4),
      tempF:        r(18, 38, 5),
      tempMinF:     r(10, 25, 6),
      tempMaxF:     r(26, 42, 7),
    };
  }
}

// ─── OpenWeather Provider ────────────────────────────────────────────────────

export class OpenWeatherSnowProvider implements SnowProvider {
  name = 'openweather';

  async fetchSnowData(
    _mountainId: string,
    lat: number,
    lon: number
  ): Promise<SnowData> {
    const key = process.env.OPENWEATHER_API_KEY;
    if (!key) throw new Error('OPENWEATHER_API_KEY not configured');

    const url =
      `https://api.openweathermap.org/data/3.0/onecall` +
      `?lat=${lat}&lon=${lon}&exclude=minutely,hourly,alerts&appid=${key}&units=imperial`;

    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenWeather error ${res.status}: ${text}`);
    }
    const data = await res.json();

    const mmToIn = (mm: number) => mm / 25.4;
    const daily7dSnow = (data.daily as Array<{ snow?: number }>)
      ?.slice(0, 7)
      .reduce((sum, d) => sum + (d.snow || 0), 0) || 0;

    return {
      snowfall24h:  mmToIn(data.daily?.[0]?.snow || 0),
      snowfall7d:   mmToIn(daily7dSnow),
      baseDepthIn:  60, // OWM doesn't provide base depth; use a reasonable default
      windMph:      data.current?.wind_speed || 0,
      tempF:        data.current?.temp || 32,
      tempMinF:     data.daily?.[0]?.temp?.min || 25,
      tempMaxF:     data.daily?.[0]?.temp?.max || 35,
    };
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function getSnowProvider(): SnowProvider {
  return process.env.OPENWEATHER_API_KEY
    ? new OpenWeatherSnowProvider()
    : new MockSnowProvider();
}

// ─── Cached fetch ─────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

export async function getSnowDataCached(
  mountainId: string,
  lat: number,
  lon: number
): Promise<SnowData> {
  const now = new Date();

  const cached = await prisma.snowSnapshot.findFirst({
    where: { mountainId, expiresAt: { gt: now } },
    orderBy: { fetchedAt: 'desc' },
  });
  if (cached) return cached.payload as unknown as SnowData;

  const provider = getSnowProvider();
  const data = await provider.fetchSnowData(mountainId, lat, lon);

  await prisma.snowSnapshot.create({
    data: {
      mountainId,
      provider: provider.name,
      payload: data as object,
      expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
    },
  });

  return data;
}
