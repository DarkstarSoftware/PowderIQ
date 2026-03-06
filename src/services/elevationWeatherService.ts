// src/services/elevationWeatherService.ts
//
// Blends three weather sources for maximum accuracy:
//   1. Open-Meteo  — free, no key, best snow/precipitation data
//   2. OpenWeather — current conditions, feels-like, visibility, condition codes
//   3. NOAA        — US-only, best snowpack depth and official forecasts
//
// Strategy per field:
//   tempF/feelsLike   → OpenWeather (more accurate current), lapse-rate adjusted per zone
//   windMph/gust      → average of OWM + Open-Meteo (both reliable)
//   snowfall24h       → Open-Meteo (superior snow model)
//   snowfall1h        → Open-Meteo hourly
//   snowDepthIn       → NOAA (US) → Open-Meteo → fallback
//   forecastHigh/Low  → Open-Meteo (better mountain forecasts)
//   forecastSnowIn    → Open-Meteo 7-day
//   conditionDesc     → OpenWeather (human-readable)
//   humidity/visibility → OpenWeather

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
  zones: { base: ZoneWeather; mid: ZoneWeather; summit: ZoneWeather };
}

const CACHE_TTL_MS        = 30 * 60 * 1000;
const LAPSE_RATE_F_PER_1K = 3.5;
const MPS_TO_MPH          = 2.237;
const KMH_TO_MPH          = 0.621371;
const M_TO_MI             = 1 / 1609.34;
const MM_TO_IN            = 1 / 25.4;

function lapseAdj(tempF: number, fromFt: number, toFt: number): number {
  return tempF - ((toFt - fromFt) / 1000) * LAPSE_RATE_F_PER_1K;
}
function windDegToDir(deg: number): string {
  return ['N','NE','E','SE','S','SW','W','NW'][Math.round(deg / 45) % 8];
}
function avg(...vals: number[]): number {
  const v = vals.filter(x => x != null && !isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

// ─── Open-Meteo ───────────────────────────────────────────────────────────────
// Free, no key. Best for snow accumulation and mountain forecasts.

interface OpenMeteoResult {
  tempF: number;
  windMph: number;
  windGustMph: number;
  windDir: string;
  snowfall1hIn: number;
  snowfall24hIn: number;
  snowDepthIn: number;
  forecastHigh: number;
  forecastLow: number;
  forecastSnow7dIn: number;
  precipMm: number;
}

async function fetchOpenMeteo(lat: number, lon: number, elevFt: number): Promise<OpenMeteoResult> {
  const elevM = Math.round(elevFt * 0.3048);
  const url = `https://api.open-meteo.com/v1/forecast?` +
    `latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,windspeed_10m,winddirection_10m,windgusts_10m,snowfall,snow_depth,precipitation` +
    `&hourly=temperature_2m,snowfall,snow_depth` +
    `&daily=temperature_2m_max,temperature_2m_min,snowfall_sum,precipitation_sum` +
    `&temperature_unit=fahrenheit&windspeed_unit=mph&precipitation_unit=inch` +
    `&timezone=auto&forecast_days=7` +
    `&elevation=${elevM}`;

  const res = await fetch(url, { next: { revalidate: 1800 } });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const d = await res.json();

  const c = d.current;
  const daily = d.daily;

  // 24h snow: sum today + tonight hourly
  const nowIdx = d.hourly?.time?.findIndex((t: string) => new Date(t) >= new Date()) ?? 0;
  const snow24h = (d.hourly?.snowfall ?? [])
    .slice(Math.max(0, nowIdx - 24), nowIdx)
    .reduce((s: number, v: number) => s + (v ?? 0), 0);

  const snow7d = (daily?.snowfall_sum ?? [])
    .slice(0, 7)
    .reduce((s: number, v: number) => s + (v ?? 0), 0);

  const forecastTemps = (daily?.temperature_2m_max ?? []).concat(daily?.temperature_2m_min ?? []);
  const forecastHigh = daily?.temperature_2m_max?.[0] ?? (c?.temperature_2m + 5);
  const forecastLow  = daily?.temperature_2m_min?.[0] ?? (c?.temperature_2m - 8);

  return {
    tempF:          c?.temperature_2m ?? 32,
    windMph:        c?.windspeed_10m ?? 0,
    windGustMph:    c?.windgusts_10m ?? 0,
    windDir:        windDegToDir(c?.winddirection_10m ?? 0),
    snowfall1hIn:   c?.snowfall ?? 0,
    snowfall24hIn:  Math.round(snow24h * 10) / 10,
    snowDepthIn:    Math.round((c?.snow_depth ?? 0) * 39.3701 * 10) / 10, // m → in
    precipMm:       c?.precipitation ?? 0,
    forecastHigh,
    forecastLow,
    forecastSnow7dIn: Math.round(snow7d * 10) / 10,
  };
}

// ─── OpenWeather ──────────────────────────────────────────────────────────────

interface OWMResult {
  tempF: number;
  feelsLikeF: number;
  windMph: number;
  windGustMph: number;
  windDeg: number;
  visibilityMi: number;
  conditionDesc: string;
  conditionCode: number;
  humidity: number;
  snow1hMm: number;
  snow24hMm: number;
  forecastHighF: number;
  forecastLowF: number;
}

async function fetchOWM(lat: number, lon: number, apiKey: string): Promise<OWMResult> {
  const url = `https://api.openweathermap.org/data/3.0/onecall` +
    `?lat=${lat}&lon=${lon}&exclude=minutely,alerts&appid=${apiKey}&units=imperial`;
  const res = await fetch(url, { next: { revalidate: 1800 } });
  if (!res.ok) throw new Error(`OWM ${res.status}`);
  const d = await res.json();
  return {
    tempF:         d.current?.temp ?? 32,
    feelsLikeF:    d.current?.feels_like ?? 32,
    windMph:       d.current?.wind_speed ?? 0,
    windGustMph:   d.current?.wind_gust ?? 0,
    windDeg:       d.current?.wind_deg ?? 0,
    visibilityMi:  Math.round(((d.current?.visibility ?? 10000) * M_TO_MI) * 10) / 10,
    conditionDesc: d.current?.weather?.[0]?.description ?? 'unknown',
    conditionCode: d.current?.weather?.[0]?.id ?? 800,
    humidity:      d.current?.humidity ?? 0,
    snow1hMm:      d.current?.snow?.['1h'] ?? 0,
    snow24hMm:     d.daily?.[0]?.snow ?? 0,
    forecastHighF: d.daily?.[0]?.temp?.max ?? 35,
    forecastLowF:  d.daily?.[0]?.temp?.min ?? 20,
  };
}

// ─── NOAA ─────────────────────────────────────────────────────────────────────

const NOAA_GRID_CACHE = new Map<string, { url: string; expires: number }>();

async function getNOAAGrid(lat: number, lon: number): Promise<string> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const c = NOAA_GRID_CACHE.get(key);
  if (c && c.expires > Date.now()) return c.url;
  const res = await fetch(`https://api.weather.gov/points/${lat},${lon}`, {
    headers: { 'User-Agent': 'PowderIQ/1.0', Accept: 'application/geo+json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`NOAA /points ${res.status}`);
  const d = await res.json();
  const url = d.properties?.forecastGridData;
  if (!url) throw new Error('NOAA grid URL missing');
  NOAA_GRID_CACHE.set(key, { url, expires: Date.now() + 86400000 });
  return url;
}

function noaaCurrent(values: Array<{ validTime: string; value: number }>): number {
  const now = Date.now();
  for (const v of values) {
    const [ts, dur] = v.validTime.split('/');
    const start = new Date(ts).getTime();
    const m = dur?.match(/P(?:(\d+)D)?T?(?:(\d+)H)?/);
    const hrs = m ? (parseInt(m[1] || '0') * 24 + parseInt(m[2] || '1')) : 1;
    if (now >= start && now < start + hrs * 3600000) return v.value ?? 0;
  }
  return values[0]?.value ?? 0;
}

function noaaSum(values: Array<{ validTime: string; value: number }>, hours: number): number {
  const now = Date.now(), cutoff = now + hours * 3600000;
  return values.reduce((s, v) => {
    const t = new Date(v.validTime.split('/')[0]).getTime();
    return t >= now && t < cutoff ? s + (v.value ?? 0) : s;
  }, 0);
}

async function fetchNOAASnowDepth(lat: number, lon: number): Promise<number | null> {
  try {
    const gridUrl = await getNOAAGrid(lat, lon);
    const res = await fetch(gridUrl, {
      headers: { 'User-Agent': 'PowderIQ/1.0', Accept: 'application/geo+json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const d = await res.json();
    const depthM = noaaCurrent(d.properties?.snowDepth?.values ?? []);
    return depthM > 0 ? Math.round(depthM / 0.0254 * 10) / 10 : null;
  } catch {
    return null;
  }
}

// ─── Blend sources into a ZoneWeather ────────────────────────────────────────

function blendZone(
  zone: 'base' | 'mid' | 'summit',
  elevFt: number,
  baseElevFt: number,
  om: OpenMeteoResult,
  owm: OWMResult | null,
  noaaDepthIn: number | null,
): ZoneWeather {
  // Temperature: prefer OWM (more accurate current), apply lapse rate
  const sourceTemp  = owm?.tempF ?? om.tempF;
  const sourceFeel  = owm?.feelsLikeF ?? om.tempF;
  const tempF       = Math.round(lapseAdj(sourceTemp, baseElevFt, elevFt) * 10) / 10;
  const feelsLikeF  = Math.round(lapseAdj(sourceFeel, baseElevFt, elevFt) * 10) / 10;

  // Wind: average OWM + Open-Meteo for better accuracy
  const windMph     = Math.round(avg(om.windMph, owm?.windMph ?? om.windMph) * 10) / 10;
  const windGustMph = Math.round(avg(om.windGustMph, owm?.windGustMph ?? om.windGustMph) * 10) / 10;

  // Snow: Open-Meteo is best, NOAA overrides snow depth for US
  const snowDepthIn   = noaaDepthIn ?? om.snowDepthIn;
  const snowfall24hIn = om.snowfall24hIn; // Open-Meteo superior for snow
  const snowfall1hIn  = om.snowfall1hIn;

  // Forecast: Open-Meteo with lapse rate
  const forecastHigh = Math.round(lapseAdj(om.forecastHigh, baseElevFt, elevFt) * 10) / 10;
  const forecastLow  = Math.round(lapseAdj(om.forecastLow,  baseElevFt, elevFt) * 10) / 10;

  return {
    zone, elevFt, tempF, feelsLikeF, windMph, windGustMph,
    windDir:       owm ? windDegToDir(owm.windDeg) : om.windDir,
    visibilityMi:  owm?.visibilityMi ?? 10,
    conditionDesc: owm?.conditionDesc ?? (om.snowfall1hIn > 0 ? 'light snow' : 'partly cloudy'),
    conditionCode: owm?.conditionCode ?? 0,
    humidity:      owm?.humidity ?? 70,
    snowfall1hIn,
    snowfall24hIn,
    snowDepthIn,
    forecastHigh,
    forecastLow,
    forecastSnowIn: Math.round((om.forecastSnow7dIn / 7) * 10) / 10,
  };
}

// ─── Mock fallback ────────────────────────────────────────────────────────────

function mockZone(zone: 'base' | 'mid' | 'summit', elevFt: number, seed: number): ZoneWeather {
  const r = (min: number, max: number, off = 0) =>
    Math.round((min + ((seed + off) % (max - min + 1))) * 10) / 10;
  const t = r(zone === 'summit' ? 14 : zone === 'mid' ? 22 : 28, zone === 'summit' ? 30 : 40);
  return {
    zone, elevFt, tempF: t, feelsLikeF: t - r(3, 10, 1),
    windMph: r(zone === 'summit' ? 15 : 5, 45, 2),
    windGustMph: r(25, 60, 3),
    windDir: ['N','NW','W','SW','NE','SE'][seed % 6],
    visibilityMi: r(1, 10, 4),
    conditionDesc: ['light snow','overcast clouds','moderate snow','clear sky'][seed % 4],
    conditionCode: 600 + (seed % 10), humidity: r(55, 90, 5),
    snowfall1hIn: r(0, 2, 6), snowfall24hIn: r(0, 18, 7),
    snowDepthIn: r(30, 120, 8), forecastHigh: t + r(2, 8, 9),
    forecastLow: t - r(5, 12, 10), forecastSnowIn: r(0, 6, 11),
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function getResortElevationWeather(resortId: string): Promise<ResortWeatherReport> {
  const now = new Date();

  // Check DB cache
  const cached = await prisma.elevationWeather.findMany({
    where: { resortId, expiresAt: { gt: now } },
  });
  if (cached.length === 3) {
    const toZone = (r: any): ZoneWeather => ({
      zone: r.zone, elevFt: r.elevFt, tempF: r.tempF,
      feelsLikeF: r.feelsLikeF ?? r.tempF, windMph: r.windMph,
      windGustMph: r.windGustMph ?? 0, windDir: r.windDir ?? 'N',
      visibilityMi: r.visibilityMi ?? 10, conditionDesc: r.conditionDesc ?? '',
      conditionCode: r.conditionCode ?? 0, humidity: r.humidity ?? 0,
      snowfall1hIn: r.snowfall1hIn, snowfall24hIn: r.snowfall24hIn,
      snowDepthIn: r.snowDepthIn, forecastHigh: r.forecastHigh ?? 35,
      forecastLow: r.forecastLow ?? 20, forecastSnowIn: r.forecastSnowIn ?? 0,
    });
    const byZone = Object.fromEntries(cached.map(c => [c.zone, toZone(c)])) as any;
    return { resortId, fetchedAt: now.toISOString(), backend: 'cache', zones: byZone };
  }

  const resort = await prisma.resort.findUniqueOrThrow({
    where: { id: resortId },
    include: { mountain: true },
  });

  const { mountain } = resort;
  const baseElev   = resort.baseElevFt   || mountain.baseElevFt;
  const summitElev = resort.summitElevFt || mountain.topElevFt;
  const midElev    = resort.midElevFt    || Math.round((baseElev + summitElev) / 2);
  const seed       = resortId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const owmKey     = process.env.OPENWEATHER_API_KEY;
  const isUS       = mountain.country === 'US';

  let zones: { base: ZoneWeather; mid: ZoneWeather; summit: ZoneWeather };
  let backend = 'mock';

  try {
    // Fetch Open-Meteo for each elevation zone in parallel (uses elevation param)
    const [omBase, omMid, omSummit, owm, noaaDepth] = await Promise.allSettled([
      fetchOpenMeteo(mountain.latitude, mountain.longitude, baseElev),
      fetchOpenMeteo(mountain.latitude, mountain.longitude, midElev),
      fetchOpenMeteo(mountain.latitude, mountain.longitude, summitElev),
      owmKey ? fetchOWM(mountain.latitude, mountain.longitude, owmKey) : Promise.reject('no key'),
      isUS ? fetchNOAASnowDepth(mountain.latitude, mountain.longitude) : Promise.resolve(null),
    ]);

    const omBaseVal   = omBase.status   === 'fulfilled' ? omBase.value   : null;
    const omMidVal    = omMid.status    === 'fulfilled' ? omMid.value    : null;
    const omSummitVal = omSummit.status === 'fulfilled' ? omSummit.value : null;
    const owmVal      = owm.status      === 'fulfilled' ? owm.value      : null;
    const noaaVal     = noaaDepth.status === 'fulfilled' ? noaaDepth.value : null;

    if (!omBaseVal || !omMidVal || !omSummitVal) throw new Error('Open-Meteo failed');

    zones = {
      base:   blendZone('base',   baseElev,   baseElev, omBaseVal,   owmVal, noaaVal),
      mid:    blendZone('mid',    midElev,    baseElev, omMidVal,    owmVal, noaaVal ? Math.round(noaaVal * 1.1) : null),
      summit: blendZone('summit', summitElev, baseElev, omSummitVal, owmVal, noaaVal ? Math.round(noaaVal * 1.25) : null),
    };

    const sources = ['open-meteo', owmVal ? 'openweather' : null, noaaVal ? 'noaa' : null]
      .filter(Boolean).join('+');
    backend = sources;

  } catch (e) {
    console.warn('[ElevationWeather] All providers failed, using mock:', e);
    zones = {
      base:   mockZone('base',   baseElev,   seed),
      mid:    mockZone('mid',    midElev,    seed + 1),
      summit: mockZone('summit', summitElev, seed + 2),
    };
    backend = 'mock';
  }

  // Persist to DB cache
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);
  await Promise.all(
    (['base', 'mid', 'summit'] as const).map(z => {
      const w = zones[z];
      return prisma.elevationWeather.upsert({
        where: { resortId_zone: { resortId, zone: z } },
        update: { ...w, expiresAt, fetchedAt: now },
        create: { resortId, ...w, expiresAt },
      });
    })
  );

  return { resortId, fetchedAt: now.toISOString(), backend, zones };
}
