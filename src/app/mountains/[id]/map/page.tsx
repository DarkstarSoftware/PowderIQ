'use client';
// src/app/mountains/[id]/map/page.tsx

import { useEffect, useState, use } from 'react';
import Link from 'next/link';

interface MapData {
  resort: {
    id: string;
    name: string;
    slug: string;
    baseElevFt: number;
    midElevFt: number;
    summitElevFt: number;
    mountain?: { latitude: number; longitude: number; skimapAreaId?: number };
  };
  lifts: any[];
  trails: any[];
  weatherZones: any[];
  overlays: { type: string; imageUrl: string; skimapAreaId?: number } | null;
  map: any | null;
}

interface WeatherZone {
  zone: 'base' | 'mid' | 'summit';
  tempF: number;
  windMph: number;
  windGustMph?: number;
  snowfall24hIn: number;
  conditionDesc?: string;
  windDir?: string;
}

export default function PublicTrailMapPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const slug = params.id;

  const [mapData, setMapData]     = useState<MapData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'lifts' | 'trails'>('lifts');
  const [resortName, setResortName] = useState('');

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const mtnRes = await fetch(`/api/mountains?slug=${slug}`);
        const mtnJson = await mtnRes.json();
        const mountain = mtnJson.data?.[0] ?? null;
        if (!mountain) throw new Error('Mountain not found');
        setResortName(mountain.name);

        const resortRes = await fetch(`/api/resort?mountainId=${mountain.id}`);
        if (!resortRes.ok) throw new Error('No resort for this mountain');
        const resortJson = await resortRes.json();
        const resort = Array.isArray(resortJson.data) ? resortJson.data[0] : resortJson.data;
        if (!resort) throw new Error('No resort found');

        const mapRes = await fetch(`/api/resort/${resort.id}/map`);
        if (!mapRes.ok) throw new Error('Map data unavailable');
        const mapJson = await mapRes.json();
        setMapData(mapJson.data);
        if (mapJson.data?.resort?.name) setResortName(mapJson.data.resort.name);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sky-400/60 text-sm tracking-widest uppercase">Loading trail map</p>
      </div>
    </div>
  );

  if (error || !mapData) return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
      <div className="text-center px-4">
        <p className="text-5xl mb-4">🏔️</p>
        <p className="text-white font-semibold text-lg mb-2">Trail map unavailable</p>
        <p className="text-slate-500 text-sm mb-6">{error ?? 'This resort has not set up their trail map yet.'}</p>
        <Link href="/mountains" className="text-sky-400 hover:text-sky-300 text-sm underline">← Browse all mountains</Link>
      </div>
    </div>
  );

  const { overlays, weatherZones, lifts, trails } = mapData;
  const imageUrl = overlays?.imageUrl ?? null;

  const weather = {
    summit: weatherZones.find((z: WeatherZone) => z.zone === 'summit'),
    mid:    weatherZones.find((z: WeatherZone) => z.zone === 'mid'),
    base:   weatherZones.find((z: WeatherZone) => z.zone === 'base'),
  };

  const openLifts     = lifts.filter((l: any) => l.status === 'open').length;
  const openTrails    = trails.filter((t: any) => t.status === 'open' || t.status === 'groomed').length;
  const groomedTrails = trails.filter((t: any) => t.status === 'groomed').length;
  const windHold      = (weather.summit?.windMph ?? 0) > 35;
  const newSnow       = weather.summit?.snowfall24hIn ?? 0;

  const liftStatusColor: Record<string, string> = {
    open: 'bg-emerald-500', on_hold: 'bg-amber-400',
    closed: 'bg-red-500/70', scheduled: 'bg-blue-500',
  };
  const trailStatusColor: Record<string, string> = {
    open: 'bg-sky-400', groomed: 'bg-teal-400',
    closed: 'bg-red-500/70', patrol_only: 'bg-purple-500',
  };
  const difficultyColor: Record<string, string> = {
    green: 'text-emerald-400', blue: 'text-sky-400',
    black: 'text-slate-200', double_black: 'text-slate-100',
    terrain_park: 'text-orange-400', backcountry: 'text-yellow-400',
  };
  const difficultyIcon: Record<string, string> = {
    green: '●', blue: '◆', black: '◆', double_black: '◆◆',
    terrain_park: '▲', backcountry: '⬡',
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex flex-col">
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <header className="bg-[#0d1425]/95 backdrop-blur-xl border-b border-white/5 sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="text-white font-bold text-base shrink-0">❄️ PowderIQ</Link>
            <span className="text-white/10">·</span>
            <div className="min-w-0">
              <h1 className="text-white font-semibold text-sm truncate">{resortName}</h1>
              <p className="text-slate-500 text-xs">Live Trail Map</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {windHold && (
              <span className="hidden sm:flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs px-2.5 py-1 rounded-full">
                ⚠ Wind Hold
              </span>
            )}
            {newSnow > 0 && (
              <span className="hidden sm:flex items-center gap-1.5 bg-sky-500/10 border border-sky-500/25 text-sky-400 text-xs px-2.5 py-1 rounded-full">
                ❄ {newSnow.toFixed(1)}" new
              </span>
            )}
            <Link href="/dashboard" className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Weather strip */}
      {weatherZones.length > 0 && (
        <div className="bg-[#0d1425]/80 border-b border-white/5">
          <div className="max-w-screen-2xl mx-auto px-4 py-2.5 flex items-center gap-6 overflow-x-auto">
            {(['summit', 'mid', 'base'] as const).map(zone => {
              const w = weather[zone];
              if (!w) return null;
              const isWind = zone === 'summit' && windHold;
              return (
                <div key={zone} className="flex items-center gap-2.5 shrink-0">
                  <span className="text-slate-500 text-xs uppercase tracking-widest w-12">{zone === 'mid' ? 'Mid' : zone}</span>
                  <span className="text-white font-semibold tabular-nums text-sm">{w.tempF.toFixed(0)}°F</span>
                  <span className={`text-xs tabular-nums ${isWind ? 'text-amber-400 font-semibold' : 'text-slate-400'}`}>
                    {isWind ? '⚠ ' : ''}{w.windMph.toFixed(0)} mph
                  </span>
                  {w.snowfall24hIn > 0 && (
                    <span className="text-sky-400 text-xs font-semibold">{w.snowfall24hIn.toFixed(1)}" ❄</span>
                  )}
                  {zone !== 'base' && <span className="text-white/5 ml-1">|</span>}
                </div>
              );
            })}
            <div className="ml-auto shrink-0 flex items-center gap-4 text-xs">
              <span className="text-slate-500">
                <span className="text-emerald-400 font-semibold">{openLifts}</span>
                <span className="text-slate-600">/{lifts.length}</span> lifts
              </span>
              <span className="text-slate-500">
                <span className="text-sky-400 font-semibold">{openTrails}</span>
                <span className="text-slate-600">/{trails.length}</span> trails
              </span>
              {groomedTrails > 0 && (
                <span className="text-teal-400 text-xs">{groomedTrails} groomed</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main layout: map image + sidebar */}
      <div className="flex-1 flex flex-col lg:flex-row" style={{ minHeight: 0 }}>

        {/* Trail map image */}
        <div className="flex-1 bg-[#060b14] flex items-start justify-center overflow-auto relative">
          {imageUrl ? (
            <div className="relative w-full h-full flex items-start justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={`${resortName} trail map`}
                className="w-full h-auto block"
                style={{ maxHeight: 'calc(100vh - 112px)', objectFit: 'contain', objectPosition: 'top center' }}
              />
              <a
                href={`https://skimap.org/skiareas/view/${overlays?.skimapAreaId}`}
                target="_blank"
                rel="noopener"
                className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white/40 hover:text-white/70 text-[10px] px-2.5 py-1.5 rounded-lg transition-colors"
              >
                © skimap.org
              </a>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-64 text-slate-600 gap-3">
              <span className="text-4xl">🗺️</span>
              <p className="text-sm">No trail map available for this resort</p>
            </div>
          )}
        </div>

        {/* Live status sidebar */}
        <div className="w-full lg:w-80 xl:w-96 bg-[#0d1425] border-t lg:border-t-0 lg:border-l border-white/5 flex flex-col" style={{ maxHeight: 'calc(100vh - 112px)' }}>

          {/* Tabs */}
          <div className="flex border-b border-white/5 shrink-0">
            {(['lifts', 'trails'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3.5 text-xs font-semibold uppercase tracking-widest transition-colors ${
                  activeTab === tab
                    ? 'text-white border-b-2 border-sky-500 bg-white/[0.02]'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab === 'lifts' ? `Lifts (${lifts.length})` : `Trails (${trails.length})`}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'lifts' && (
              <div className="divide-y divide-white/[0.04]">
                {lifts.length === 0 ? (
                  <p className="text-slate-600 text-sm text-center py-10">No lift status data</p>
                ) : lifts.map((lift: any) => (
                  <div key={lift.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.025] transition-colors">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{lift.liftName}</p>
                      <p className="text-slate-600 text-xs capitalize mt-0.5">{(lift.liftType ?? '').replace(/_/g, ' ')}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {lift.waitMinutes != null && lift.status === 'open' && (
                        <span className="text-amber-400 text-xs font-mono">{lift.waitMinutes}m wait</span>
                      )}
                      <span className={`w-2 h-2 rounded-full shrink-0 ${liftStatusColor[lift.status] ?? 'bg-slate-600'}`} />
                      <span className={`text-xs capitalize w-16 text-right ${
                        lift.status === 'open' ? 'text-emerald-400' :
                        lift.status === 'on_hold' ? 'text-amber-400' :
                        lift.status === 'scheduled' ? 'text-blue-400' : 'text-slate-500'
                      }`}>
                        {lift.status === 'on_hold' ? 'Hold' : lift.status ?? 'Unknown'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'trails' && (
              <div className="divide-y divide-white/[0.04]">
                {trails.length === 0 ? (
                  <p className="text-slate-600 text-sm text-center py-10">No trail status data</p>
                ) : trails.map((trail: any) => (
                  <div key={trail.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.025] transition-colors">
                    <div className="min-w-0 flex items-center gap-2.5">
                      <span className={`text-xs shrink-0 ${difficultyColor[trail.difficulty] ?? 'text-slate-400'}`}>
                        {difficultyIcon[trail.difficulty] ?? '●'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">{trail.trailName}</p>
                        {trail.snowDepthIn != null && trail.snowDepthIn > 0 && (
                          <p className="text-sky-400/60 text-xs mt-0.5">❄ {trail.snowDepthIn}" depth</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${trailStatusColor[trail.status] ?? 'bg-slate-600'}`} />
                      <span className={`text-xs capitalize w-16 text-right ${
                        trail.status === 'open' ? 'text-sky-400' :
                        trail.status === 'groomed' ? 'text-teal-400' : 'text-slate-500'
                      }`}>
                        {trail.status ?? 'Unknown'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/5 px-4 py-3 shrink-0">
            <p className="text-slate-700 text-[10px] text-center">
              Powered by <a href="/" className="hover:text-slate-500 transition-colors">PowderIQ</a>
              {' · '}Trail maps © <a href="https://skimap.org" target="_blank" rel="noopener" className="hover:text-slate-500 transition-colors">skimap.org</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
