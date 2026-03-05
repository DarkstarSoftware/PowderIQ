// src/services/elevationWeatherService.ts
// Fetches weather at summit / mid / base elevation zones for resort operators.
// Uses OpenWeather if key is set, NOAA as free US fallback, mock for dev.

import { prisma } from '@/lib/prisma';

export interface ZoneWeather {
  zone: 'base' | 'mid' | 'summit';
  elevFt: number;
  tempF: number;
  feelsLikeF: number;
  windMph: number;
  windGustMph: number;
  windDir: string;
  visibilityMi: number;
  conditionDesc: string;
  conditionCode: number;
  humidity: number;
  snowfall1hIn: number;
  snowfall24hIn: number;
  snowDepthIn: number;
  forecastHigh: number;
  forecastLow: number;
  forecastSnowIn: number;
}

export interface ResortWeatherReport {
  resortId: string;
  fetchedAt: string;
  backend: string;
  zones: {
    base: ZoneWeather;
    mid: ZoneWeather;
    summit: ZoneWeather;
  };
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const LAPSE_RATE_F_PER_1000FT = 3.5; // standard atmospheric lapse rate
const MM_TO_IN = 1 / 25.4;
const MPS_TO_MPH = 2.237;
const M_TO_MI = 1 / 1609.34;

function applyLapseRate(tempF: number, fromFt: number, toFt: number): number {
  return tempF - ((toFt - fromFt) / 1000) * LAPSE_RATE_F_PER_1000FT;
}

function windDegToDir(deg: number): string {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];
}

// ─── Mock provider (deterministic, for dev / non-US resorts) ─────────────────

function mockZone(zone: 'base' | 'mid' | 'summit', elevFt: number, seed: number): ZoneWeather {
  const r = (min: number, max: number, off = 0) =>
    Math.round((min + ((seed + off) % (max - min + 1))) * 10) / 10;
  const tempBase = r(zone === 'summit' ? 14 : zone === 'mid' ? 22 : 28, zone === 'summit' ? 30 : zone === 'mid' ? 36 : 40);
  const conditions = ['light snow', 'overcast clouds', 'moderate snow', 'clear sky', 'few clouds', 'heavy snow'];
  const dirs = ['N', 'NW', 'W', 'SW', 'NE', 'SE'];
  return {
    zone, elevFt,
    tempF: tempBase,
    feelsLikeF: tempBase - r(3, 10, 1),
    windMph: r(zone === 'summit' ? 15 : 5, zone === 'summit' ? 45 : 20, 2),
    windGustMph: r(zone === 'summit' ? 25 : 10, zone === 'summit' ? 60 : 30, 3),
    windDir: dirs[seed % dirs.length],
    visibilityMi: r(1, 10, 4),
    conditionDesc: conditions[seed % conditions.length],
    conditionCode: 600 + (seed % 10),
    humidity: r(55, 90, 5),
    snowfall1hIn: r(0, zone === 'summit' ? 2 : 1, 6),
    snowfall24hIn: r(0, zone === 'summit' ? 18 : 8, 7),
    snowDepthIn: r(zone === 'base' ? 30 : 50, zone === 'summit' ? 120 : 90, 8),
    forecastHigh: tempBase + r(2, 8, 9),
    forecastLow: tempBase - r(5, 12, 10),
    forecastSnowIn: r(0, zone === 'summit' ? 6 : 3, 11),
  };
}

// ─── OpenWeather provider ─────────────────────────────────────────────────────

async function fetchOWM(lat: number, lon: number, apiKey: string) {
  const url = `https://api.openweathermap.org/data/3.0/onecall` +
    `?lat=${lat}&lon=${lon}&exclude=minutely,alerts&appid=${apiKey}&units=imperial`;
  const res = await fetch(url, { next: { revalidate: 1800 } });
  if (!res.ok) throw new Error(`OWM ${res.status}`);
  return res.json();
}

function owmToZone(
  data: any, zone: 'base' | 'mid' | 'summit',
  targetElevFt: number, sourceElevFt: number
): ZoneWeather {
  const daily7dSnow = (data.daily as any[])?.slice(0, 7)
    .reduce((s: number, d: any) => s + (d.snow || 0), 0) || 0;
  const baseTemp = data.current?.temp ?? 32;
  const adj = applyLapseRate(baseTemp, sourceElevFt, targetElevFt);
  const feelsAdj = applyLapseRate(data.current?.feels_like ?? baseTemp, sourceElevFt, targetElevFt);
  return {
    zone, elevFt: targetElevFt,
    tempF: Math.round(adj * 10) / 10,
    feelsLikeF: Math.round(feelsAdj * 10) / 10,
    windMph: Math.round((data.current?.wind_speed ?? 0) * 10) / 10,
    windGustMph: Math.round((data.current?.wind_gust ?? 0) * 10) / 10,
    windDir: windDegToDir(data.current?.wind_deg ?? 0),
    visibilityMi: Math.round(((data.current?.visibility ?? 10000) / 1609.34) * 10) / 10,
    conditionDesc: data.current?.weather?.[0]?.description ?? 'unknown',
    conditionCode: data.current?.weather?.[0]?.id ?? 800,
    humidity: data.current?.humidity ?? 0,
    snowfall1hIn: (data.current?.snow?.['1h'] ?? 0) * MM_TO_IN,
    snowfall24hIn: ((data.daily?.[0]?.snow ?? 0)) * MM_TO_IN,
    snowDepthIn: 60, // OWM doesn't provide — overridden by NOAA if available
    forecastHigh: applyLapseRate(data.daily?.[0]?.temp?.max ?? 35, sourceElevFt, targetElevFt),
    forecastLow: applyLapseRate(data.daily?.[0]?.temp?.min ?? 20, sourceElevFt, targetElevFt),
    forecastSnowIn: (daily7dSnow / 7) * MM_TO_IN,
  };
}

// ─── NOAA provider ────────────────────────────────────────────────────────────

const NOAA_GRID_CACHE = new Map<string, { gridDataUrl: string; expires: number }>();

async function getNOAAGridUrl(lat: number, lon: number): Promise<string> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const cached = NOAA_GRID_CACHE.get(key);
  if (cached && cached.expires > Date.now()) return cached.gridDataUrl;

  const res = await fetch(`https://api.weather.gov/points/${lat},${lon}`, {
    headers: { 'User-Agent': 'PowderIQ/1.0 (contact@powderiq.com)', Accept: 'application/geo+json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`NOAA /points ${res.status}`);
  const data = await res.json();
  const url = data.properties?.forecastGridData;
  if (!url) throw new Error('NOAA grid URL not found');

  NOAA_GRID_CACHE.set(key, { gridDataUrl: url, expires: Date.now() + 86400000 });
  return url;
}

function noaaCurrentValue(values: Array<{ validTime: string; value: number }>): number {
  const now = Date.now();
  for (const v of values) {
    const [ts, dur] = v.validTime.split('/');
    const start = new Date(ts).getTime();
    const match = dur?.match(/P(?:(\d+)D)?T?(?:(\d+)H)?/);
    const hrs = match ? (parseInt(match[1] || '0') * 24 + parseInt(match[2] || '1')) : 1;
    if (now >= start && now < start + hrs * 3600000) return v.value ?? 0;
  }
  return values[0]?.value ?? 0;
}

function noaaSumNextHours(values: Array<{ validTime: string; value: number }>, hours: number): number {
  const now = Date.now();
  const cutoff = now + hours * 3600000;
  return values.reduce((sum, v) => {
    const start = new Date(v.validTime.split('/')[0]).getTime();
    return (start >= now && start < cutoff) ? sum + (v.value ?? 0) : sum;
  }, 0);
}

async function fetchNOAAZone(
  lat: number, lon: number, zone: 'base' | 'mid' | 'summit',
  targetElevFt: number, baseElevFt: number
): Promise<ZoneWeather> {
  const gridUrl = await getNOAAGridUrl(lat, lon);
  const res = await fetch(gridUrl, {
    headers: { 'User-Agent': 'PowderIQ/1.0 (contact@powderiq.com)', Accept: 'application/geo+json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`NOAA grid data ${res.status}`);
  const grid = await res.json();
  const p = grid.properties;

  const cToF = (c: number) => (c * 9) / 5 + 32;
  const tempC = noaaCurrentValue(p.temperature?.values ?? []);
  const tempF = applyLapseRate(cToF(tempC), baseElevFt, targetElevFt);
  const windMps = noaaCurrentValue(p.windSpeed?.values ?? []);
  const gustMps = noaaCurrentValue(p.windGust?.values ?? []);
  const windDeg = noaaCurrentValue(p.windDirection?.values ?? []);
  const snowDepthM = noaaCurrentValue(p.snowDepth?.values ?? []);
  const visM = noaaCurrentValue(p.visibility?.values ?? []);
  const humidity = noaaCurrentValue(p.relativeHumidity?.values ?? []);
  const snow24hM = noaaSumNextHours(p.snowfallAmount?.values ?? [], 24);
  const snow7dM = noaaSumNextHours(p.snowfallAmount?.values ?? [], 168);

  const now = Date.now();
  const next24Temps = (p.temperature?.values ?? [])
    .filter((v: any) => {
      const t = new Date(v.validTime.split('/')[0]).getTime();
      return t >= now && t < now + 86400000;
    })
    .map((v: any) => applyLapseRate(cToF(v.value), baseElevFt, targetElevFt));

  const weatherVal = p.weather?.values?.[0]?.value?.[0];
  const conditionDesc = weatherVal
    ? `${weatherVal.intensity || ''} ${weatherVal.weather || ''}`.trim().replace(/_/g, ' ')
    : 'unknown';

  return {
    zone, elevFt: targetElevFt,
    tempF: Math.round(tempF * 10) / 10,
    feelsLikeF: Math.round((tempF - (windMps * MPS_TO_MPH > 3 ? windMps * MPS_TO_MPH * 0.5 : 0)) * 10) / 10,
    windMph: Math.round(windMps * MPS_TO_MPH * 10) / 10,
    windGustMph: Math.round(gustMps * MPS_TO_MPH * 10) / 10,
    windDir: windDegToDir(windDeg),
    visibilityMi: visM > 0 ? Math.round(visM * M_TO_MI * 10) / 10 : 10,
    conditionDesc,
    conditionCode: 0,
    humidity: Math.round(humidity),
    snowfall1hIn: 0,
    snowfall24hIn: Math.round(snow24hM / 25.4 * 10) / 10,
    snowDepthIn: Math.round(snowDepthM / 0.0254 * 10) / 10,
    forecastHigh: next24Temps.length ? Math.max(...next24Temps) : tempF + 5,
    forecastLow: next24Temps.length ? Math.min(...next24Temps) : tempF - 8,
    forecastSnowIn: Math.round(snow7dM / 25.4 / 7 * 10) / 10,
  };
}

// ─── Main exported function ───────────────────────────────────────────────────

export async function getResortElevationWeather(resortId: string): Promise<ResortWeatherReport> {
  const now = new Date();

  // Check cache
  const cached = await prisma.elevationWeather.findMany({
    where: { resortId, expiresAt: { gt: now } },
  });

  if (cached.length === 3) {
    const toZone = (r: any): ZoneWeather => ({
      zone: r.zone, elevFt: r.elevFt,
      tempF: r.tempF, feelsLikeF: r.feelsLikeF ?? r.tempF,
      windMph: r.windMph, windGustMph: r.windGustMph ?? 0,
      windDir: r.windDir ?? 'N', visibilityMi: r.visibilityMi ?? 10,
      conditionDesc: r.conditionDesc ?? '', conditionCode: r.conditionCode ?? 0,
      humidity: r.humidity ?? 0, snowfall1hIn: r.snowfall1hIn,
      snowfall24hIn: r.snowfall24hIn, snowDepthIn: r.snowDepthIn,
      forecastHigh: r.forecastHigh ?? 35, forecastLow: r.forecastLow ?? 20,
      forecastSnowIn: r.forecastSnowIn ?? 0,
    });
    const byZone = Object.fromEntries(cached.map(c => [c.zone, toZone(c)])) as any;
    return { resortId, fetchedAt: now.toISOString(), backend: 'cache', zones: byZone };
  }

  const resort = await prisma.resort.findUniqueOrThrow({
    where: { id: resortId },
    include: { mountain: true },
  });

  const { mountain } = resort;
  const baseElev = resort.baseElevFt || mountain.baseElevFt;
  const summitElev = resort.summitElevFt || mountain.topElevFt;
  const midElev = resort.midElevFt || Math.round((baseElev + summitElev) / 2);
  const seed = resortId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const apiKey = process.env.OPENWEATHER_API_KEY;

  let zones: { base: ZoneWeather; mid: ZoneWeather; summit: ZoneWeather };
  let backend = 'mock';

  // Try OpenWeather
  if (apiKey) {
    try {
      const data = await fetchOWM(mountain.latitude, mountain.longitude, apiKey);
      zones = {
        base:   owmToZone(data, 'base',   baseElev,   baseElev),
        mid:    owmToZone(data, 'mid',    midElev,    baseElev),
        summit: owmToZone(data, 'summit', summitElev, baseElev),
      };
      backend = 'openweather';
    } catch (e) {
      console.warn('[ElevationWeather] OWM failed, trying NOAA:', e);
      apiKey && (backend = 'noaa');
    }
  }

  // Try NOAA for US mountains
  if (!apiKey || backend === 'noaa') {
    if (mountain.country === 'US') {
      try {
        const [base, mid, summit] = await Promise.all([
          fetchNOAAZone(mountain.latitude, mountain.longitude, 'base',   baseElev,   baseElev),
          fetchNOAAZone(mountain.latitude, mountain.longitude, 'mid',    midElev,    baseElev),
          fetchNOAAZone(mountain.latitude, mountain.longitude, 'summit', summitElev, baseElev),
        ]);
        zones = { base, mid, summit };
        backend = 'noaa';
      } catch (e) {
        console.warn('[ElevationWeather] NOAA failed, using mock:', e);
        zones = {
          base:   mockZone('base',   baseElev,   seed),
          mid:    mockZone('mid',    midElev,    seed + 1),
          summit: mockZone('summit', summitElev, seed + 2),
        };
        backend = 'mock';
      }
    } else {
      zones = {
        base:   mockZone('base',   baseElev,   seed),
        mid:    mockZone('mid',    midElev,    seed + 1),
        summit: mockZone('summit', summitElev, seed + 2),
      };
      backend = 'mock';
    }
  }

  // Cache all 3 zones
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);
  await Promise.all(
    (['base', 'mid', 'summit'] as const).map(z => {
      const w = zones![z];
      return prisma.elevationWeather.upsert({
        where: { resortId_zone: { resortId, zone: z } },
        update: { ...w, expiresAt, fetchedAt: now },
        create: { resortId, ...w, expiresAt },
      });
    })
  );

  return { resortId, fetchedAt: now.toISOString(), backend, zones: zones! };
}
