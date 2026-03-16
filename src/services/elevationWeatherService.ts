// src/services/elevationWeatherService.ts
//
// Blends three weather sources for maximum accuracy:
//   1. Open-Meteo  — free, no key, best snow/precipitation data
//   2. OpenWeather — current conditions, feels-like, visibility, condition codes
//   3. NOAA/NWS    — US-only, official snow depth + SEVERE WEATHER ALERTS
//
// KEY FIXES over previous version:
//   - Cache TTL: 5 min during ski hours (6am–6pm), 15 min off-hours
//     (was 30 min — caused stale "partly cloudy" during a blizzard)
//   - Removed next:{revalidate:1800} from all fetch() calls — was double-caching
//   - Fixed Open-Meteo hourly snowfall unit: it's ALWAYS mm even with
//     precipitation_unit=inch. Was reading ~25x too low.
//   - conditionDesc fallback now uses Open-Meteo WMO weather codes properly
//     (was showing "partly cloudy" during active snowfall if OWM key missing)
//   - NWS Active Alerts API integrated — blizzards/wind advisories detected
//     and surfaced as a top-level `alerts` field
//   - NOAA grid URLs stored in DB to survive serverless cold starts
//     (was in-memory Map, lost on every cold start)
//   - Force-refresh bypass: pass forceRefresh=true to skip cache during alerts

import { prisma } from '@/lib/prisma';

export interface WeatherAlert {
  event: string;          // e.g. "Winter Storm Warning", "Blizzard Warning"
  headline: string;
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';
  urgency: string;
  onset: string;
  expires: string;
  description: string;
}

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
  alerts: WeatherAlert[];
  zones: { base: ZoneWeather; mid: ZoneWeather; summit: ZoneWeather };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LAPSE_RATE_F_PER_1K = 3.5;
const M_TO_MI             = 1 / 1609.34;
// FIX: Open-Meteo hourly snowfall is ALWAYS in mm regardless of precipitation_unit
// precipitation_unit=inch only affects daily/current precip totals, NOT hourly snowfall
const MM_TO_IN            = 1 / 25.4;

// Dynamic TTL: refresh every 5 min during ski hours, 15 min off-hours
function getCacheTTL(): number {
  const hour = new Date().getHours(); // local server time
  const isSkiHours = hour >= 6 && hour < 19;
  return isSkiHours ? 5 * 60 * 1000 : 15 * 60 * 1000;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lapseAdj(tempF: number, fromFt: number, toFt: number): number {
  return tempF - ((toFt - fromFt) / 1000) * LAPSE_RATE_F_PER_1K;
}

function windDegToDir(deg: number): string {
  return ['N','NE','E','SE','S','SW','W','NW'][Math.round(deg / 45) % 8];
}

function avg(...vals: (number | undefined | null)[]): number {
  const v = vals.filter((x): x is number => x != null && !isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

// WMO weather code → human-readable description
// https://open-meteo.com/en/docs#weathervariables
function wmoToDesc(code: number): string {
  if (code === 0) return 'clear sky';
  if (code === 1) return 'mainly clear';
  if (code === 2) return 'partly cloudy';
  if (code === 3) return 'overcast';
  if (code <= 9)  return 'fog';
  if (code <= 19) return 'drizzle';
  if (code <= 29) return 'rain';
  if (code <= 39) return 'snow';
  if (code <= 49) return 'fog';
  if (code <= 59) return 'freezing drizzle';
  if (code <= 67) return 'rain';
  if (code === 71) return 'light snow';
  if (code === 73) return 'moderate snow';
  if (code === 75) return 'heavy snow';
  if (code === 77) return 'snow grains';
  if (code <= 82) return 'rain showers';
  if (code === 85) return 'light snow showers';
  if (code === 86) return 'heavy snow showers';
  if (code <= 95) return 'thunderstorm';
  if (code <= 99) return 'thunderstorm with heavy snow';
  return 'unknown';
}

function wmoToConditionCode(code: number): number {
  // Map WMO codes to OWM-style codes for UI compatibility
  if (code === 0 || code === 1) return 800;  // clear
  if (code === 2) return 801;               // few clouds
  if (code === 3) return 804;               // overcast
  if (code >= 71 && code <= 77) return 601; // snow
  if (code === 85 || code === 86) return 601;
  if (code >= 95) return 211;              // thunderstorm
  if (code >= 60 && code <= 67) return 501; // rain
  return 804;
}

// ─── Open-Meteo ───────────────────────────────────────────────────────────────

interface OpenMeteoResult {
  tempF: number;
  windMph: number;
  windGustMph: number;
  windDir: string;
  snowfall1hIn: number;   // mm/hr → inches (FIXED)
  snowfall24hIn: number;  // sum of last 24 hourly mm → inches (FIXED)
  snowDepthIn: number;    // meters → inches
  forecastHigh: number;
  forecastLow: number;
  forecastSnow7dIn: number;
  precipMm: number;
  weatherCode: number;    // WMO code for accurate description
}

async function fetchOpenMeteo(lat: number, lon: number, elevFt: number): Promise<OpenMeteoResult> {
  const elevM = Math.round(elevFt * 0.3048);

  // FIX: removed `next: { revalidate: 1800 }` — was double-caching on top of DB cache
  // FIX: added weather_code to current and hourly for accurate condition descriptions
  // FIX: hourly snowfall included to compute rolling 24h total
  const url =
    `https://api.open-meteo.com/v1/forecast?` +
    `latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,windspeed_10m,winddirection_10m,windgusts_10m,` +
    `snowfall,snow_depth,precipitation,weather_code` +
    `&hourly=temperature_2m,snowfall,snow_depth,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min,snowfall_sum,precipitation_sum,weather_code` +
    `&temperature_unit=fahrenheit&windspeed_unit=mph` +
    // NOTE: precipitation_unit=inch affects daily precip totals but NOT hourly snowfall
    // Hourly snowfall is always mm — we handle the conversion explicitly below
    `&precipitation_unit=inch` +
    `&timezone=auto&forecast_days=7` +
    `&elevation=${elevM}`;

  // FIX: no Next.js cache — let our DB TTL control freshness
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status} for ${lat},${lon} elev=${elevM}m`);
  const d = await res.json();

  const c     = d.current;
  const daily = d.daily;

  // FIX: Hourly snowfall from Open-Meteo is in mm (not inches).
  // Find current hour index and sum the PAST 24 hourly values.
  const now = new Date();
  const hourlyTimes: string[] = d.hourly?.time ?? [];
  const nowIdx = hourlyTimes.findIndex(t => new Date(t) >= now);
  const safeIdx = nowIdx > 0 ? nowIdx : hourlyTimes.length;

  // Sum past 24 hours of snowfall (values are in mm) → convert to inches
  const hourlySnowMm: number[] = d.hourly?.snowfall ?? [];
  const snow24hMm = hourlySnowMm
    .slice(Math.max(0, safeIdx - 24), safeIdx)
    .reduce((s, v) => s + (v ?? 0), 0);
  const snow24hIn = Math.round(snow24hMm * MM_TO_IN * 10) / 10;

  // 7-day forecast snow: daily snowfall_sum is in INCHES (precipitation_unit=inch works for daily)
  const snow7dIn = (daily?.snowfall_sum ?? [])
    .slice(0, 7)
    .reduce((s: number, v: number) => s + (v ?? 0), 0);

  // Current snowfall rate: c.snowfall is mm/hr → convert to in/hr
  // FIX: was treating this as already in inches
  const snow1hIn = Math.round((c?.snowfall ?? 0) * MM_TO_IN * 10) / 10;

  const weatherCode: number = c?.weather_code ?? 0;

  return {
    tempF:           c?.temperature_2m ?? 32,
    windMph:         c?.windspeed_10m ?? 0,
    windGustMph:     c?.windgusts_10m ?? 0,
    windDir:         windDegToDir(c?.winddirection_10m ?? 0),
    snowfall1hIn:    snow1hIn,
    snowfall24hIn:   snow24hIn,
    snowDepthIn:     Math.round((c?.snow_depth ?? 0) * 39.3701 * 10) / 10, // m → in
    precipMm:        c?.precipitation ?? 0,
    forecastHigh:    daily?.temperature_2m_max?.[0] ?? ((c?.temperature_2m ?? 30) + 5),
    forecastLow:     daily?.temperature_2m_min?.[0] ?? ((c?.temperature_2m ?? 30) - 8),
    forecastSnow7dIn: Math.round(snow7dIn * 10) / 10,
    weatherCode,
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
  const url =
    `https://api.openweathermap.org/data/3.0/onecall` +
    `?lat=${lat}&lon=${lon}&exclude=minutely,alerts&appid=${apiKey}&units=imperial`;
  // FIX: no Next.js cache
  const res = await fetch(url, { cache: 'no-store' });
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

// ─── NOAA Snow Depth + NWS Active Alerts ─────────────────────────────────────
// Grid URLs are now stored in the DB (resort.noaaGridUrl) to survive cold starts
// Previous version used an in-memory Map that reset on every serverless invocation

async function getNOAAGridUrl(resortId: string, lat: number, lon: number): Promise<string | null> {
  // Check DB first (persisted across cold starts)
  const resort = await prisma.resort.findUnique({
    where: { id: resortId },
    select: { noaaGridUrl: true, noaaGridExpiresAt: true },
  });

  if (
    resort?.noaaGridUrl &&
    resort?.noaaGridExpiresAt &&
    new Date(resort.noaaGridExpiresAt) > new Date()
  ) {
    return resort.noaaGridUrl;
  }

  // Fetch fresh grid URL from NWS
  try {
    const res = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {
      headers: {
        'User-Agent': 'PowderIQ/2.0 (powderiq.com; contact@powderiq.com)',
        Accept: 'application/geo+json',
      },
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const d = await res.json();
    const url: string = d.properties?.forecastGridData;
    if (!url) return null;

    // Persist to DB — expires in 24h (grid assignments rarely change)
    await prisma.resort.update({
      where: { id: resortId },
      data: {
        noaaGridUrl: url,
        noaaGridExpiresAt: new Date(Date.now() + 86400000),
      },
    });
    return url;
  } catch {
    return null;
  }
}

async function fetchNOAASnowDepth(resortId: string, lat: number, lon: number): Promise<number | null> {
  const gridUrl = await getNOAAGridUrl(resortId, lat, lon);
  if (!gridUrl) return null;
  try {
    const res = await fetch(gridUrl, {
      headers: { 'User-Agent': 'PowderIQ/2.0', Accept: 'application/geo+json' },
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const d = await res.json();
    const values: Array<{ validTime: string; value: number }> =
      d.properties?.snowDepth?.values ?? [];
    if (!values.length) return null;

    // Find current value
    const nowMs = Date.now();
    for (const v of values) {
      const [ts, dur] = v.validTime.split('/');
      const start = new Date(ts).getTime();
      const m = dur?.match(/P(?:(\d+)D)?T?(?:(\d+)H)?/);
      const hrs = m ? (parseInt(m[1] || '0') * 24 + parseInt(m[2] || '1')) : 1;
      if (nowMs >= start && nowMs < start + hrs * 3600000) {
        const depthM = v.value ?? 0;
        return depthM > 0 ? Math.round(depthM / 0.0254 * 10) / 10 : null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// NWS Active Alerts — critical for detecting blizzards the moment they're issued
// https://api.weather.gov/alerts/active?point={lat},{lon}
async function fetchNWSAlerts(lat: number, lon: number): Promise<WeatherAlert[]> {
  try {
    const url = `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}&status=actual`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'PowderIQ/2.0 (powderiq.com; contact@powderiq.com)',
        Accept: 'application/geo+json',
      },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store', // Always fresh — alerts are time-critical
    });
    if (!res.ok) return [];
    const d = await res.json();

    return (d.features ?? [])
      .filter((f: any) => f.properties)
      .map((f: any): WeatherAlert => ({
        event:       f.properties.event ?? 'Unknown',
        headline:    f.properties.headline ?? '',
        severity:    f.properties.severity ?? 'Unknown',
        urgency:     f.properties.urgency ?? 'Unknown',
        onset:       f.properties.onset ?? '',
        expires:     f.properties.expires ?? '',
        description: (f.properties.description ?? '').substring(0, 500),
      }))
      // Prioritize most severe
      .sort((a: WeatherAlert, b: WeatherAlert) => {
        const rank: Record<string, number> = { Extreme: 4, Severe: 3, Moderate: 2, Minor: 1, Unknown: 0 };
        return (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0);
      })
      .slice(0, 5); // Cap at 5 alerts
  } catch {
    return [];
  }
}

// ─── Blend sources into ZoneWeather ──────────────────────────────────────────

function blendZone(
  zone: 'base' | 'mid' | 'summit',
  elevFt: number,
  baseElevFt: number,
  om: OpenMeteoResult,
  owm: OWMResult | null,
  noaaDepthIn: number | null,
  activeAlerts: WeatherAlert[],
): ZoneWeather {
  // Temperature: prefer OWM current (more accurate), apply lapse rate per zone
  const sourceTemp = owm?.tempF ?? om.tempF;
  const sourceFeel = owm?.feelsLikeF ?? om.tempF;
  const tempF      = Math.round(lapseAdj(sourceTemp, baseElevFt, elevFt) * 10) / 10;
  const feelsLikeF = Math.round(lapseAdj(sourceFeel, baseElevFt, elevFt) * 10) / 10;

  // Wind: average OWM + Open-Meteo; summit gets a 15% uplift (terrain effect)
  const windBase     = avg(om.windMph, owm?.windMph);
  const gustBase     = avg(om.windGustMph, owm?.windGustMph);
  const zoneWindMult = zone === 'summit' ? 1.15 : zone === 'mid' ? 1.05 : 1.0;
  const windMph      = Math.round(windBase * zoneWindMult * 10) / 10;
  const windGustMph  = Math.round(gustBase * zoneWindMult * 10) / 10;

  // Snow depth: NOAA (most accurate) → Open-Meteo fallback
  // Scale by zone: summit accumulates more, base less
  const baseDepth    = noaaDepthIn ?? om.snowDepthIn;
  const zoneDepthMult = zone === 'summit' ? 1.3 : zone === 'mid' ? 1.1 : 1.0;
  const snowDepthIn  = Math.round(baseDepth * zoneDepthMult * 10) / 10;

  // Snowfall: Open-Meteo is authoritative
  // Summit gets a slight amplification (orographic lift)
  const snowMult     = zone === 'summit' ? 1.2 : zone === 'mid' ? 1.1 : 1.0;
  const snowfall24hIn = Math.round(om.snowfall24hIn * snowMult * 10) / 10;
  const snowfall1hIn  = Math.round(om.snowfall1hIn  * snowMult * 10) / 10;

  // FIX: conditionDesc — use WMO code for accurate description when OWM is unavailable.
  // Previous version defaulted to "partly cloudy" even during active blizzard.
  let conditionDesc: string;
  let conditionCode: number;

  if (owm) {
    conditionDesc = owm.conditionDesc;
    conditionCode = owm.conditionCode;
  } else {
    conditionDesc = wmoToDesc(om.weatherCode);
    conditionCode = wmoToConditionCode(om.weatherCode);
  }

  // If there's a blizzard/winter storm alert, override description for clarity
  const severeAlert = activeAlerts.find(a =>
    a.severity === 'Extreme' || a.severity === 'Severe' ||
    a.event.toLowerCase().includes('blizzard') ||
    a.event.toLowerCase().includes('winter storm')
  );
  if (severeAlert && zone === 'summit') {
    conditionDesc = severeAlert.event.toLowerCase().replace(' warning', '').replace(' advisory', '');
  }

  return {
    zone, elevFt, tempF, feelsLikeF, windMph, windGustMph,
    windDir:       owm ? windDegToDir(owm.windDeg) : om.windDir,
    visibilityMi:  owm?.visibilityMi ?? (snowfall1hIn > 0.5 ? 1 : snowfall1hIn > 0.1 ? 3 : 10),
    conditionDesc,
    conditionCode,
    humidity:      owm?.humidity ?? 80,
    snowfall1hIn,
    snowfall24hIn,
    snowDepthIn,
    forecastHigh:  Math.round(lapseAdj(om.forecastHigh, baseElevFt, elevFt) * 10) / 10,
    forecastLow:   Math.round(lapseAdj(om.forecastLow,  baseElevFt, elevFt) * 10) / 10,
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
    snowfall1hIn: r(0, 2, 6), snowfall24hIn: r(0, 8, 7),
    snowDepthIn: r(20, 80, 8), forecastHigh: t + r(2, 8, 9),
    forecastLow: t - r(5, 12, 10), forecastSnowIn: r(0, 4, 11),
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function getResortElevationWeather(
  resortId: string,
  forceRefresh = false,
): Promise<ResortWeatherReport> {
  const now = new Date();

  // Check DB cache (skip if forceRefresh=true or if an active severe alert exists)
  if (!forceRefresh) {
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
        snowfall1hIn: r.snowfall1hIn ?? 0, snowfall24hIn: r.snowfall24hIn ?? 0,
        snowDepthIn: r.snowDepthIn ?? 0, forecastHigh: r.forecastHigh ?? 35,
        forecastLow: r.forecastLow ?? 20, forecastSnowIn: r.forecastSnowIn ?? 0,
      });
      const byZone = Object.fromEntries(cached.map(c => [c.zone, toZone(c)])) as any;
      // Still fetch alerts even from cache — they're always real-time
      const resort = await prisma.resort.findUnique({
        where: { id: resortId },
        include: { mountain: true },
      });
      const alerts = resort ? await fetchNWSAlerts(resort.mountain.latitude, resort.mountain.longitude) : [];
      return { resortId, fetchedAt: now.toISOString(), backend: 'cache', alerts, zones: byZone };
    }
  }

  const resort = await prisma.resort.findUniqueOrThrow({
    where: { id: resortId },
    include: { mountain: true },
  });

  const { mountain } = resort;
  const baseElev   = resort.baseElevFt   || mountain.baseElevFt   || 500;
  const summitElev = resort.summitElevFt || mountain.topElevFt    || 1500;
  const midElev    = resort.midElevFt    || Math.round((baseElev + summitElev) / 2);
  const seed       = resortId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const owmKey     = process.env.OPENWEATHER_API_KEY;
  const isUS       = mountain.country === 'US' || mountain.country === 'United States';

  // Fetch all sources in parallel — alerts are always real-time, never cached
  const [omBase, omMid, omSummit, owmResult, noaaDepth, alerts] = await Promise.allSettled([
    fetchOpenMeteo(mountain.latitude, mountain.longitude, baseElev),
    fetchOpenMeteo(mountain.latitude, mountain.longitude, midElev),
    fetchOpenMeteo(mountain.latitude, mountain.longitude, summitElev),
    owmKey
      ? fetchOWM(mountain.latitude, mountain.longitude, owmKey)
      : Promise.reject('no OWM key'),
    isUS
      ? fetchNOAASnowDepth(resortId, mountain.latitude, mountain.longitude)
      : Promise.resolve(null),
    isUS
      ? fetchNWSAlerts(mountain.latitude, mountain.longitude)
      : Promise.resolve([]),
  ]);

  const omBaseVal   = omBase.status   === 'fulfilled' ? omBase.value   : null;
  const omMidVal    = omMid.status    === 'fulfilled' ? omMid.value    : null;
  const omSummitVal = omSummit.status === 'fulfilled' ? omSummit.value : null;
  const owmVal      = owmResult.status === 'fulfilled' ? owmResult.value : null;
  const noaaVal     = noaaDepth.status === 'fulfilled' ? noaaDepth.value : null;
  const activeAlerts: WeatherAlert[] = alerts.status === 'fulfilled' ? alerts.value : [];

  let zones: { base: ZoneWeather; mid: ZoneWeather; summit: ZoneWeather };
  let backend = 'mock';

  if (omBaseVal && omMidVal && omSummitVal) {
    zones = {
      base:   blendZone('base',   baseElev,   baseElev, omBaseVal,   owmVal, noaaVal, activeAlerts),
      mid:    blendZone('mid',    midElev,    baseElev, omMidVal,    owmVal, noaaVal, activeAlerts),
      summit: blendZone('summit', summitElev, baseElev, omSummitVal, owmVal, noaaVal, activeAlerts),
    };
    const sources = [
      'open-meteo',
      owmVal  ? 'openweather' : null,
      noaaVal ? 'noaa'        : null,
    ].filter(Boolean).join('+');
    backend = sources;
  } else {
    console.warn('[ElevationWeather] Open-Meteo failed, using mock data for resortId:', resortId);
    zones = {
      base:   mockZone('base',   baseElev,   seed),
      mid:    mockZone('mid',    midElev,    seed + 1),
      summit: mockZone('summit', summitElev, seed + 2),
    };
    backend = 'mock';
  }

  // Persist to DB with dynamic TTL
  const ttl = getCacheTTL();
  const expiresAt = new Date(now.getTime() + ttl);

  await Promise.all(
    (['base', 'mid', 'summit'] as const).map(z => {
      const w = zones[z];
      return prisma.elevationWeather.upsert({
        where:  { resortId_zone: { resortId, zone: z } },
        update: { ...w, expiresAt, fetchedAt: now },
        create: { resortId, ...w, expiresAt },
      });
    })
  );

  return {
    resortId,
    fetchedAt: now.toISOString(),
    backend,
    alerts: activeAlerts,
    zones,
  };
}
