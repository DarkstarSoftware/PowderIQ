// src/services/noaaWeatherProvider.ts
// NOAA NWS API — free, no API key, US-only, 2.5km grid resolution.
// Used as a free weather backend replacing or supplementing OpenWeather.
//
// Flow: /points/{lat},{lon} → get gridpoint URL → /gridpoints/.../forecast/hourly
// Returns hourly temp, wind, snow, precip for 7 days.

import { prisma } from '@/lib/prisma';
import type { SnowData } from './scoreEngine';

const NOAA_BASE = 'https://api.weather.gov';
const NOAA_HEADERS = {
  'User-Agent': 'PowderIQ/1.0 (powderiq.com contact@powderiq.com)',
  Accept: 'application/geo+json',
};

// ─── NOAA Response Types ──────────────────────────────────────────────────────

interface NOAAPointsResponse {
  properties: {
    forecast: string;           // URL to 12h forecast
    forecastHourly: string;     // URL to hourly forecast
    forecastGridData: string;   // URL to raw grid data (has snowfall)
    gridId: string;
    gridX: number;
    gridY: number;
    relativeLocation: {
      properties: { city: string; state: string };
    };
  };
}

interface NOAAForecastPeriod {
  number: number;
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;           // e.g. "15 mph"
  windDirection: string;       // e.g. "NW"
  shortForecast: string;       // e.g. "Light Snow"
  detailedForecast: string;
  probabilityOfPrecipitation: { value: number | null };
  snowfallAmount?: { value: number | null; unitCode: string };
}

interface NOAAGridData {
  properties: {
    temperature: { values: Array<{ validTime: string; value: number }> };
    windSpeed: { values: Array<{ validTime: string; value: number }> };
    windGust: { values: Array<{ validTime: string; value: number }> };
    windDirection: { values: Array<{ validTime: string; value: number }> };
    snowfallAmount: { values: Array<{ validTime: string; value: number }> };
    snowDepth: { values: Array<{ validTime: string; value: number }> };
    relativeHumidity: { values: Array<{ validTime: string; value: number }> };
    visibility: { values: Array<{ validTime: string; value: number }> };
    probabilityOfPrecipitation: { values: Array<{ validTime: string; value: number }> };
    weather: { values: Array<{ validTime: string; value: Array<{ weather: string; intensity: string }> }> };
  };
}

// ─── Unit Conversion Helpers ──────────────────────────────────────────────────

const cToF = (c: number) => (c * 9) / 5 + 32;
const mpsToMph = (mps: number) => mps * 2.237;
const mToIn = (m: number) => m * 39.3701;
const mToMi = (m: number) => m / 1609.34;
const degToDir = (deg: number) => ['N','NE','E','SE','S','SW','W','NW'][Math.round(deg / 45) % 8];

// Parse ISO 8601 duration like PT1H, PT6H, P1D
function parseDurationHours(duration: string): number {
  const match = duration.match(/P(?:(\d+)D)?T?(?:(\d+)H)?/);
  if (!match) return 1;
  return (parseInt(match[1] || '0') * 24) + parseInt(match[2] || '1');
}

// Get the current value from a NOAA time-series (values with validTime/duration)
function getCurrentValue(values: Array<{ validTime: string; value: number }>): number {
  const now = Date.now();
  for (const v of values) {
    const [timeStr, durationStr] = v.validTime.split('/');
    const start = new Date(timeStr).getTime();
    const durationHrs = parseDurationHours(durationStr || 'PT1H');
    const end = start + durationHrs * 3600 * 1000;
    if (now >= start && now < end) return v.value ?? 0;
  }
  return values[0]?.value ?? 0;
}

// Sum values over next N hours from the time series
function sumNextHours(
  values: Array<{ validTime: string; value: number }>,
  hours: number
): number {
  const now = Date.now();
  const cutoff = now + hours * 3600 * 1000;
  let total = 0;
  for (const v of values) {
    const [timeStr] = v.validTime.split('/');
    const start = new Date(timeStr).getTime();
    if (start >= now && start < cutoff) total += v.value ?? 0;
  }
  return total;
}

// ─── Grid Point Cache (persisted to DB) ──────────────────────────────────────

const gridCache = new Map<string, { gridUrl: string; hourlyUrl: string; expires: number }>();

async function getGridForLatLon(lat: number, lon: number): Promise<{ forecastGridData: string; forecastHourly: string }> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const cached = gridCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return { forecastGridData: cached.gridUrl, forecastHourly: cached.hourlyUrl };
  }

  const res = await fetch(`${NOAA_BASE}/points/${lat},${lon}`, {
    headers: NOAA_HEADERS,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`NOAA /points returned ${res.status} for ${lat},${lon}`);
  const data: NOAAPointsResponse = await res.json();

  const result = {
    forecastGridData: data.properties.forecastGridData,
    forecastHourly: data.properties.forecastHourly,
  };

  // Cache for 24 hours — grid assignments don't change
  gridCache.set(key, { gridUrl: result.forecastGridData, hourlyUrl: result.forecastHourly, expires: Date.now() + 86400000 });
  return result;
}

// ─── Main NOAA Data Fetch ─────────────────────────────────────────────────────

export interface NOAAWeatherData {
  tempF: number;
  feelsLikeF: number;
  windMph: number;
  windGustMph: number;
  windDir: string;
  visibilityMi: number;
  humidity: number;
  conditionDesc: string;
  snowfall1hIn: number;
  snowfall6hIn: number;
  snowfall24hIn: number;
  snowfall7dIn: number;
  snowDepthIn: number;
  forecastHigh: number;
  forecastLow: number;
  precipProbability: number;
}

export async function fetchNOAAWeather(lat: number, lon: number): Promise<NOAAWeatherData> {
  const { forecastGridData } = await getGridForLatLon(lat, lon);

  const res = await fetch(forecastGridData, {
    headers: NOAA_HEADERS,
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`NOAA grid data returned ${res.status}`);
  const grid: NOAAGridData = await res.json();
  const p = grid.properties;

  const tempC = getCurrentValue(p.temperature.values);
  const windMps = getCurrentValue(p.windSpeed.values);
  const gustMps = getCurrentValue(p.windGust?.values || []);
  const windDeg = getCurrentValue(p.windDirection.values);
  const snowDepthM = getCurrentValue(p.snowDepth.values);
  const visM = getCurrentValue(p.visibility?.values || []);
  const humidity = getCurrentValue(p.relativeHumidity?.values || []);
  const precipProb = getCurrentValue(p.probabilityOfPrecipitation?.values || []);

  // Snowfall: NOAA returns in meters, summed over time windows
  const snow1hM = sumNextHours(p.snowfallAmount.values, 1);
  const snow6hM = sumNextHours(p.snowfallAmount.values, 6);
  const snow24hM = sumNextHours(p.snowfallAmount.values, 24);
  const snow7dM = sumNextHours(p.snowfallAmount.values, 168);

  // Forecast high/low from next 24h temperature series
  const now = Date.now();
  const next24 = p.temperature.values.filter(v => {
    const t = new Date(v.validTime.split('/')[0]).getTime();
    return t >= now && t < now + 86400000;
  }).map(v => v.value);

  const forecastHighC = next24.length ? Math.max(...next24) : tempC + 3;
  const forecastLowC = next24.length ? Math.min(...next24) : tempC - 5;

  // Get current weather description
  const currentWeather = p.weather?.values?.[0]?.value?.[0];
  const conditionDesc = currentWeather
    ? `${currentWeather.intensity || ''} ${currentWeather.weather || ''}`.trim().replace(/_/g, ' ')
    : 'unknown';

  return {
    tempF: cToF(tempC),
    feelsLikeF: cToF(tempC) - (mpsToMph(windMps) > 3 ? (mpsToMph(windMps) * 0.7) : 0), // rough windchill
    windMph: mpsToMph(windMps),
    windGustMph: mpsToMph(gustMps),
    windDir: degToDir(windDeg),
    visibilityMi: visM > 0 ? mToMi(visM) : 10,
    humidity,
    conditionDesc,
    snowfall1hIn: mToIn(snow1hM),
    snowfall6hIn: mToIn(snow6hM),
    snowfall24hIn: mToIn(snow24hM),
    snowfall7dIn: mToIn(snow7dM),
    snowDepthIn: mToIn(snowDepthM),
    forecastHigh: cToF(forecastHighC),
    forecastLow: cToF(forecastLowC),
    precipProbability: precipProb,
  };
}

// ─── NOAA as SnowData Provider (integrates with existing scoreEngine) ─────────

export async function fetchNOAASnowData(lat: number, lon: number): Promise<SnowData> {
  const w = await fetchNOAAWeather(lat, lon);
  return {
    snowfall24h: w.snowfall24hIn,
    snowfall7d: w.snowfall7dIn,
    baseDepthIn: w.snowDepthIn,
    windMph: w.windMph,
    tempF: w.tempF,
    tempMinF: w.forecastLow,
    tempMaxF: w.forecastHigh,
  };
}

// ─── Cached fetch for elevation zones ────────────────────────────────────────

const NOAA_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

export async function getNOAAWeatherCached(
  resortId: string,
  zone: 'base' | 'mid' | 'summit',
  lat: number,
  lon: number
): Promise<NOAAWeatherData | null> {
  // Check ElevationWeather cache first
  const cached = await prisma.elevationWeather.findUnique({
    where: { resortId_zone: { resortId, zone } },
  });
  if (cached && cached.expiresAt > new Date()) {
    // Return from cache (already stored in ElevationWeather table)
    return null; // signal to caller that cache is fresh
  }

  const data = await fetchNOAAWeather(lat, lon);
  const expiresAt = new Date(Date.now() + NOAA_CACHE_TTL_MS);

  await prisma.elevationWeather.upsert({
    where: { resortId_zone: { resortId, zone } },
    update: {
      tempF: data.tempF, feelsLikeF: data.feelsLikeF, windMph: data.windMph,
      windGustMph: data.windGustMph, windDir: data.windDir, visibilityMi: data.visibilityMi,
      humidity: data.humidity, conditionDesc: data.conditionDesc,
      snowfall1hIn: data.snowfall1hIn, snowfall24hIn: data.snowfall24hIn,
      snowDepthIn: data.snowDepthIn, forecastHigh: data.forecastHigh,
      forecastLow: data.forecastLow, forecastSnowIn: data.snowfall24hIn,
      fetchedAt: new Date(), expiresAt,
    },
    create: {
      resortId, zone,
      elevFt: 0, // caller should pass actual elevFt
      tempF: data.tempF, feelsLikeF: data.feelsLikeF, windMph: data.windMph,
      windGustMph: data.windGustMph, windDir: data.windDir, visibilityMi: data.visibilityMi,
      humidity: data.humidity, conditionDesc: data.conditionDesc,
      snowfall1hIn: data.snowfall1hIn, snowfall24hIn: data.snowfall24hIn,
      snowDepthIn: data.snowDepthIn, forecastHigh: data.forecastHigh,
      forecastLow: data.forecastLow, forecastSnowIn: data.snowfall24hIn,
      expiresAt,
    },
  });

  return data;
}