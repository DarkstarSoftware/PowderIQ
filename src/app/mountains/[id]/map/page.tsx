'use client';
// src/app/mountains/[id]/map/page.tsx
//
// Public trail map page — visible to all guests, no login required.
// Shows the same OSM geometry + live lift/trail status + weather pins
// as the operator dashboard, but read-only with a consumer-focused UI.

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const TrailMap = dynamic(() => import('@/components/resort/TrailMap'), { ssr: false });

interface PageProps {
  params: { id: string }; // mountain slug or cuid
}

interface PublicMapData {
  resort: {
    id: string;
    name: string;
    plan: string;
    mountain: {
      name: string;
      state: string;
      latitude: number;
      longitude: number;
      baseElevFt: number;
      summitElevFt: number;
      midElevFt: number;
    };
  };
  summary: {
    lifts:  { total: number; open: number; on_hold: number; closed: number };
    trails: { total: number; open: number; groomed: number; closed: number };
    osmSource: string;
  };
  latestReport?: {
    snowfall24hIn: number;
    snowfall7dIn?: number;
    baseDepthIn: number;
    summitDepthIn: number;
    narrative?: string;
    publishedAt?: string;
  };
  weather?: {
    summit?: { tempF: number; windMph: number; snowfall24hIn: number; conditionDesc: string; windDir: string };
    mid?:    { tempF: number; windMph: number; snowfall24hIn: number; conditionDesc: string };
    base?:   { tempF: number; windMph: number; snowfall24hIn: number; conditionDesc: string };
  };
}

export default function PublicTrailMapPage({ params }: PageProps) {
  const [data, setData]     = useState<PublicMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    // Resolve mountain slug → resort id via the public mountains API
    (async () => {
      try {
        // Try slug first (most common inbound link format)
        const mountainRes = await fetch(`/api/mountains?slug=${params.id}`);
        let mountain = await mountainRes.json().then(d => d.data?.[0] ?? null);

        // Fallback: try as mountain id
        if (!mountain) {
          const byId = await fetch(`/api/mountains/${params.id}`);
          if (byId.ok) mountain = await byId.json().then(d => d.data);
        }

        if (!mountain) throw new Error('Mountain not found');

        // Fetch resort for this mountain
        const resortRes = await fetch(`/api/resort?mountainId=${mountain.id}`);
        if (!resortRes.ok) throw new Error('No active resort for this mountain');
        const resortJson = await resortRes.json();
        const resort = resortJson.data?.[0] ?? resortJson.data;
        if (!resort) throw new Error('No active resort for this mountain');

        // Fetch weather + latest snow report in parallel
        const [weatherRes, reportRes] = await Promise.allSettled([
          fetch(`/api/resort/${resort.id}/weather`).then(r => r.ok ? r.json() : null),
          fetch(`/api/resort/${resort.id}/snow-report`).then(r => r.ok ? r.json() : null),
        ]);

        const weatherData = weatherRes.status === 'fulfilled' ? weatherRes.value?.data : null;
        const reportData  = reportRes.status === 'fulfilled'  ? reportRes.value?.data?.[0] : null;

        setData({
          resort,
          summary: { lifts: {total:0,open:0,on_hold:0,closed:0}, trails: {total:0,open:0,groomed:0,closed:0}, osmSource: '' },
          latestReport: reportData ?? undefined,
          weather: weatherData?.zones ? {
            summit: weatherData.zones.summit,
            mid:    weatherData.zones.mid,
            base:   weatherData.zones.base,
          } : undefined,
        });
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Loading trail map…</p>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center px-4">
        <p className="text-4xl mb-4">🏔️</p>
        <p className="text-white font-semibold text-lg mb-2">Trail map unavailable</p>
        <p className="text-gray-500 text-sm mb-6">{error ?? 'This resort has not set up their trail map yet.'}</p>
        <Link href="/mountains" className="text-sky-400 hover:text-sky-300 text-sm underline">← Browse all mountains</Link>
      </div>
    </div>
  );

  const { resort, weather, latestReport } = data;
  const summitSnow = weather?.summit?.snowfall24hIn ?? latestReport?.snowfall24hIn;
  const windHold   = (weather?.summit?.windMph ?? 0) > 35;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">

      {/* Header */}
      <header className="bg-gray-900/90 backdrop-blur-xl border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="text-white font-bold text-base shrink-0">❄️ PowderIQ</Link>
            <span className="text-gray-700">·</span>
            <div className="min-w-0">
              <h1 className="text-white font-semibold text-sm truncate">{resort.mountain.name}</h1>
              <p className="text-gray-500 text-xs">{resort.mountain.state} · Live Trail Map</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {windHold && (
              <span className="hidden sm:inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs px-2.5 py-1 rounded-lg">
                ⚠ Wind Hold Risk
              </span>
            )}
            <Link href={`/mountains/${params.id}`}
              className="text-gray-500 hover:text-gray-300 text-xs border border-gray-700 hover:border-gray-600 px-2.5 py-1.5 rounded-lg transition-colors">
              Details
            </Link>
            <Link href="/dashboard"
              className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Weather strip */}
      {weather && (
        <div className="bg-gray-900/60 border-b border-gray-800">
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="flex items-center gap-4 overflow-x-auto text-sm">
              {(['summit','mid','base'] as const).map(z => {
                const w = weather[z];
                if (!w) return null;
                const wh = z === 'summit' && windHold;
                return (
                  <div key={z} className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-500 text-xs capitalize">{z === 'mid' ? 'Mid Mtn' : z}</span>
                      <span className="text-white font-bold tabular-nums">{w.tempF.toFixed(0)}°F</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <span className={wh ? 'text-amber-400 font-medium' : ''}>
                        {wh ? '⚠ ' : ''}{w.windMph.toFixed(0)} mph
                      </span>
                      {z === 'summit' && summitSnow != null && (
                        <span className="text-sky-400 font-medium">· {summitSnow.toFixed(1)}" new</span>
                      )}
                    </div>
                    {z !== 'base' && <span className="text-gray-800">·</span>}
                  </div>
                );
              })}
              {latestReport?.baseDepthIn && (
                <div className="shrink-0 text-xs text-gray-500 ml-auto">
                  Base: <span className="text-white font-medium">{latestReport.baseDepthIn}"</span> depth
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Map — fills remaining height */}
      <div className="flex-1 flex flex-col">
        <div className="max-w-6xl w-full mx-auto px-4 py-4 flex-1 flex flex-col gap-4">

          <TrailMap
            resortId={resort.id}
            token=""          // public endpoint — no token needed
            height="calc(100vh - 200px)"
            showWeather={true}
            readOnly={true}
          />

          {/* Latest snow report narrative */}
          {latestReport?.narrative && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">❄️</span>
                <div>
                  <p className="text-gray-300 text-sm leading-relaxed">{latestReport.narrative}</p>
                  {latestReport.publishedAt && (
                    <p className="text-gray-600 text-xs mt-1.5">
                      Published {new Date(latestReport.publishedAt).toLocaleString([], { dateStyle:'medium', timeStyle:'short' })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Footer credits */}
          <p className="text-gray-700 text-xs text-center pb-2">
            Trail geometry © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" className="hover:text-gray-500 underline">OpenStreetMap contributors</a>
            {' · '}Powered by <a href="/" className="hover:text-gray-500 underline">PowderIQ</a>
          </p>
        </div>
      </div>
    </div>
  );
}
