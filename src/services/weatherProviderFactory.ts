// src/services/weatherProviderFactory.ts
//
// Unified weather provider factory — chooses the right data source
// based on resort plan and available API keys.
//
// Provider selection logic:
//   Enterprise plan + SkiData key    → SkiDataProvider    (most accurate, lift-integrated)
//   Enterprise/Pro + OnTheSnow key   → OnTheSnowProvider  (rich snow depth + conditions)
//   OPENWEATHER_API_KEY set          → OpenWeatherProvider (existing, global coverage)
//   US mountains only                → NOAAProvider        (free, no key, high accuracy)
//   Fallback                         → MockProvider        (dev/demo)

import { fetchNOAASnowData } from './noaaWeatherProvider';
import { getSnowProvider } from './snowProvider'; // your existing providers
import type { SnowData } from './scoreEngine';

export type WeatherBackend = 'skidata' | 'onthesnow' | 'openweather' | 'noaa' | 'mock';

export interface WeatherProviderOptions {
  plan: string;       // resort plan: starter | pro | enterprise
  country: string;    // 'US' for NOAA eligibility
  lat: number;
  lon: number;
}

// ─── Enterprise Provider Stubs ────────────────────────────────────────────────
// These are placeholder interfaces for when you land OnTheSnow / SkiData deals.
// Implement by filling in the fetch logic with their actual API endpoints.

async function fetchSkiDataSnow(lat: number, lon: number): Promise<SnowData> {
  // TODO: Implement when SkiData API contract is signed
  // SkiData API: https://www.skidata.com/en/solutions/digital/data-intelligence/
  // Provides: real-time lift throughput, snowpack, grooming status
  // Auth: OAuth2 with resort-specific client credentials
  throw new Error('SkiData integration not yet configured. Contact support@powderiq.com');
}

async function fetchOnTheSnowData(lat: number, lon: number): Promise<SnowData> {
  // TODO: Implement when OnTheSnow/SKI Magazine API partnership is active
  // OnTheSnow API: contact partnerships@onthesnow.com
  // Provides: base/summit depth, 24h/48h snowfall, surface conditions, forecast
  // Auth: API key in X-OTS-Key header
  const key = process.env.ONTHESNOW_API_KEY;
  if (!key) throw new Error('ONTHESNOW_API_KEY not configured');

  // Placeholder — replace with actual endpoint when available
  const res = await fetch(`https://api.onthesnow.com/v2/resort/conditions?lat=${lat}&lon=${lon}`, {
    headers: { 'X-OTS-Key': key, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`OnTheSnow API ${res.status}`);
  const data = await res.json();

  return {
    snowfall24h: data.snowfall?.last24Hours?.inches ?? 0,
    snowfall7d: data.snowfall?.last7Days?.inches ?? 0,
    baseDepthIn: data.snowDepth?.base?.inches ?? 0,
    windMph: data.wind?.speed ?? 0,
    tempF: data.temperature?.current ?? 32,
    tempMinF: data.temperature?.low ?? 25,
    tempMaxF: data.temperature?.high ?? 35,
  };
}

// ─── Main Factory ─────────────────────────────────────────────────────────────

export async function fetchSnowDataForResort(
  mountainId: string,
  opts: WeatherProviderOptions
): Promise<{ data: SnowData; backend: WeatherBackend }> {
  const { plan, country, lat, lon } = opts;

  // Enterprise: try SkiData first
  if (plan === 'enterprise' && process.env.SKIDATA_CLIENT_ID) {
    try {
      const data = await fetchSkiDataSnow(lat, lon);
      return { data, backend: 'skidata' };
    } catch (e) {
      console.warn('[WeatherFactory] SkiData failed, falling back:', e);
    }
  }

  // Enterprise + Pro: try OnTheSnow
  if ((plan === 'enterprise' || plan === 'pro') && process.env.ONTHESNOW_API_KEY) {
    try {
      const data = await fetchOnTheSnowData(lat, lon);
      return { data, backend: 'onthesnow' };
    } catch (e) {
      console.warn('[WeatherFactory] OnTheSnow failed, falling back:', e);
    }
  }

  // OpenWeather (all plans if key is set)
  if (process.env.OPENWEATHER_API_KEY) {
    try {
      const provider = getSnowProvider(); // your existing OpenWeatherSnowProvider
      const data = await provider.fetchSnowData(mountainId, lat, lon);
      return { data, backend: 'openweather' };
    } catch (e) {
      console.warn('[WeatherFactory] OpenWeather failed, falling back:', e);
    }
  }

  // NOAA — free fallback for US mountains
  if (country === 'US') {
    try {
      const data = await fetchNOAASnowData(lat, lon);
      return { data, backend: 'noaa' };
    } catch (e) {
      console.warn('[WeatherFactory] NOAA failed, falling back to mock:', e);
    }
  }

  // Final fallback: mock
  const provider = getSnowProvider();
  const data = await provider.fetchSnowData(mountainId, lat, lon);
  return { data, backend: 'mock' };
}

/**
 * Returns a human-readable label for the weather backend.
 * Used in the operator dashboard to show data source attribution.
 */
export function getBackendLabel(backend: WeatherBackend): string {
  return {
    skidata: 'SkiData (Enterprise)',
    onthesnow: 'OnTheSnow',
    openweather: 'OpenWeather',
    noaa: 'NOAA / NWS',
    mock: 'Demo Data',
  }[backend];
}