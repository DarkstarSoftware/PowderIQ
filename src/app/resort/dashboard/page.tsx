'use client';
// src/app/resort/dashboard/page.tsx

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

const ResortMap = dynamic(() => import('@/components/resort/ResortMap'), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'lifts' | 'trails' | 'report';

interface ZoneWeather {
  zone: 'base' | 'mid' | 'summit';
  elevFt: number;
  tempF: number;
  feelsLikeF: number;
  windMph: number;
  windGustMph: number;
  windDir: string;
  visibilityMi: number;
  conditionDesc: string;
  humidity: number;
  snowfall1hIn: number;
  snowfall24hIn: number;
  snowDepthIn: number;
  forecastHigh: number;
  forecastLow: number;
  forecastSnowIn: number;
}

interface WeatherReport {
  resortId: string;
  fetchedAt: string;
  backend: string;
  zones: { base: ZoneWeather; mid: ZoneWeather; summit: ZoneWeather };
}

interface Lift {
  id: string;
  liftName: string;
  liftType: string;
  status: 'open' | 'on_hold' | 'closed' | 'scheduled';
  waitMinutes?: number;
  topElevFt?: number;
  baseElevFt?: number;
}

interface Trail {
  id: string;
  trailName: string;
  difficulty: 'green' | 'blue' | 'black' | 'double_black' | 'terrain_park' | 'backcountry';
  status: 'open' | 'groomed' | 'closed' | 'patrol_only';
  zone?: string;
  snowDepthIn?: number;
  groomedAt?: string;
}

interface SnowReport {
  id: string;
  reportDate: string;
  snowfall24hIn: number;
  openLifts: number;
  totalLifts: number;
  openTrails: number;
  totalTrails: number;
  narrative?: string;
  publishedAt?: string;
}

interface Resort {
  id: string;
  name: string;
  plan: string;
  planStatus: string;
  baseElevFt: number;
  summitElevFt: number;
  staffRole: string;
  mountain: { name: string; latitude: number; longitude: number; state: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  open:       'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  on_hold:    'bg-amber-500/20 text-amber-300 border-amber-500/30',
  closed:     'bg-red-500/20 text-red-400 border-red-500/30',
  scheduled:  'bg-blue-500/20 text-blue-300 border-blue-500/30',
  groomed:    'bg-teal-500/20 text-teal-300 border-teal-500/30',
  patrol_only:'bg-orange-500/20 text-orange-300 border-orange-500/30',
};

const DIFFICULTY_ICONS: Record<string, string> = {
  green: '●', blue: '◆', black: '◆', double_black: '◆◆', terrain_park: '▲', backcountry: '⬡',
};
const DIFFICULTY_COLORS: Record<string, string> = {
  green: 'text-emerald-400', blue: 'text-blue-400', black: 'text-gray-200',
  double_black: 'text-gray-200', terrain_park: 'text-orange-400', backcountry: 'text-yellow-400',
};

const LIFT_TYPE_ICONS: Record<string, string> = {
  gondola: '🚡', tram: '🚠', chairlift: '🚑', surface: '⛷️',
};

function WindHoldBanner({ zones }: { zones?: WeatherReport['zones'] }) {
  if (!zones) return null;
  const holdZones = (['summit', 'mid', 'base'] as const).filter(z => zones[z]?.windMph > 35);
  if (holdZones.length === 0) return null;
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl animate-pulse">
      <span className="text-amber-400 text-sm font-semibold">⚠ Wind Hold Risk</span>
      <span className="text-amber-300 text-sm">
        {holdZones.map(z => `${z} (${zones[z].windMph.toFixed(0)} mph)`).join(', ')} exceeds 35 mph threshold
      </span>
    </div>
  );
}

function ZoneCard({ zone, data }: { zone: 'base' | 'mid' | 'summit'; data?: ZoneWeather }) {
  const config = {
    summit: { label: 'Summit', icon: '🏔️', gradient: 'from-sky-950/30 to-indigo-950/20' },
    mid:    { label: 'Mid Mountain', icon: '⛷️', gradient: 'from-indigo-950/30 to-violet-950/20' },
    base:   { label: 'Base', icon: '🏠', gradient: 'from-emerald-950/20 to-teal-950/10' },
  }[zone];
  const windHold = (data?.windMph ?? 0) > 35;

  return (
    <div className={`bg-gradient-to-br ${config.gradient} border border-gray-700/60 rounded-2xl p-5`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-300 font-semibold text-sm">{config.icon} {config.label}</span>
        {data && <span className="text-gray-500 text-xs">{data.elevFt.toLocaleString()} ft</span>}
      </div>
      {data ? (
        <>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-4xl font-bold text-white tabular-nums">{data.tempF.toFixed(0)}°</span>
            <span className="text-gray-400 text-sm mb-1">F</span>
          </div>
          <p className="text-gray-400 text-sm capitalize mb-3">{data.conditionDesc}</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-900/50 rounded-lg p-2">
              <p className="text-gray-500 text-xs">Wind</p>
              <p className={`text-sm font-semibold ${windHold ? 'text-amber-400' : 'text-white'}`}>
                {data.windMph.toFixed(0)} mph {data.windDir}
                {windHold && ' ⚠'}
              </p>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-2">
              <p className="text-gray-500 text-xs">New Snow</p>
              <p className="text-sm font-semibold text-sky-300">{data.snowfall24hIn.toFixed(1)}"</p>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-2">
              <p className="text-gray-500 text-xs">Snow Depth</p>
              <p className="text-sm font-semibold text-white">{data.snowDepthIn.toFixed(0)}"</p>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-2">
              <p className="text-gray-500 text-xs">Visibility</p>
              <p className="text-sm font-semibold text-white">{data.visibilityMi.toFixed(1)} mi</p>
            </div>
          </div>
          <div className="mt-3 flex justify-between text-xs text-gray-500">
            <span>↓ {data.forecastLow.toFixed(0)}° Low</span>
            <span>↑ {data.forecastHigh.toFixed(0)}° High</span>
            <span>❄ {data.forecastSnowIn.toFixed(1)}" fcst</span>
          </div>
        </>
      ) : (
        <div className="h-32 flex items-center justify-center text-gray-600 text-sm">Loading…</div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function ResortDashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [resort, setResort] = useState<Resort | null>(null);
  const [weather, setWeather] = useState<WeatherReport | null>(null);
  const [lifts, setLifts] = useState<Lift[]>([]);
  const [liftSummary, setLiftSummary] = useState<any>(null);
  const [trails, setTrails] = useState<Trail[]>([]);
  const [trailsByZone, setTrailsByZone] = useState<Record<string, Trail[]>>({});
  const [trailSummary, setTrailSummary] = useState<any>(null);
  const [reports, setReports] = useState<SnowReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportNarrative, setReportNarrative] = useState('');

  const fetchAll = useCallback(async (tok: string, resortId: string) => {
    const headers = { Authorization: `Bearer ${tok}` };
    const [weatherRes, liftsRes, trailsRes, reportsRes] = await Promise.allSettled([
      fetch(`/api/resort/${resortId}/weather`, { headers }).then(r => r.json()),
      fetch(`/api/resort/${resortId}/lifts`, { headers }).then(r => r.json()),
      fetch(`/api/resort/${resortId}/trails`, { headers }).then(r => r.json()),
      fetch(`/api/resort/${resortId}/snow-report`, { headers }).then(r => r.json()),
    ]);
    if (weatherRes.status === 'fulfilled') setWeather(weatherRes.value?.data);
    if (liftsRes.status === 'fulfilled') {
      setLifts(liftsRes.value?.data?.lifts ?? []);
      setLiftSummary(liftsRes.value?.data?.summary);
    }
    if (trailsRes.status === 'fulfilled') {
      setTrails(trailsRes.value?.data?.trails ?? []);
      setTrailsByZone(trailsRes.value?.data?.byZone ?? {});
      setTrailSummary(trailsRes.value?.data?.summary);
    }
    if (reportsRes.status === 'fulfilled') setReports(reportsRes.value?.data ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push('/auth/login'); return; }
      const tok = data.session.access_token;
      setToken(tok);

      const resortsRes = await fetch('/api/resort', { headers: { Authorization: `Bearer ${tok}` } });
      if (!resortsRes.ok) { router.push('/resort/onboard'); return; }
      const resortsData = await resortsRes.json();
      const firstResort = resortsData.data?.[0];
      if (!firstResort) { router.push('/resort/onboard'); return; }

      setResort(firstResort);
      await fetchAll(tok, firstResort.id);
      setLoading(false);
    })();
  }, [router, fetchAll]);

  // Auto-refresh weather every 10 minutes
  useEffect(() => {
    if (!token || !resort) return;
    const interval = setInterval(() => {
      fetch(`/api/resort/${resort.id}/weather`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setWeather(d?.data));
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token, resort]);

  async function updateLiftStatus(liftName: string, status: string) {
    if (!resort || !token) return;
    await fetch(`/api/resort/${resort.id}/lifts`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ liftName, status }),
    });
    setLifts(prev => prev.map(l => l.liftName === liftName ? { ...l, status: status as any } : l));
    setLiftSummary((prev: any) => {
      if (!prev) return prev;
      const lift = lifts.find(l => l.liftName === liftName);
      if (!lift) return prev;
      const oldStatus = lift.status as string;
      return { ...prev, [oldStatus]: prev[oldStatus] - 1, [status]: (prev[status] || 0) + 1 };
    });
  }

  async function updateTrailStatus(trailName: string, status: string) {
    if (!resort || !token) return;
    await fetch(`/api/resort/${resort.id}/trails`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trailName, status }),
    });
    setTrails(prev => prev.map(t => t.trailName === trailName ? { ...t, status: status as any } : t));
    setTrailsByZone(prev => {
      const updated = { ...prev };
      for (const zone of Object.keys(updated)) {
        updated[zone] = updated[zone].map(t => t.trailName === trailName ? { ...t, status: status as any } : t);
      }
      return updated;
    });
  }

  async function generateSnowReport(publish = false) {
    if (!resort || !token) return;
    setGeneratingReport(true);
    const res = await fetch(`/api/resort/${resort.id}/snow-report`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ generate: true, publish }),
    });
    const data = await res.json();
    if (data.data?.report?.narrative) setReportNarrative(data.data.report.narrative);
    const newReport = data.data?.report;
    if (newReport) setReports(prev => [newReport, ...prev]);
    setGeneratingReport(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading resort dashboard…</p>
        </div>
      </div>
    );
  }

  const latestReport = reports[0];

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">← Dashboard</Link>
            <span className="text-gray-700">|</span>
            <div>
              <h1 className="text-white font-bold text-sm leading-none">{resort?.mountain?.name}</h1>
              <p className="text-gray-500 text-xs mt-0.5">{resort?.mountain?.state} · {resort?.plan} plan · {resort?.planStatus}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <WindHoldBanner zones={weather?.zones} />
            <span className="text-gray-600 text-xs hidden sm:block">
              Data: {weather?.backend ?? '—'} · Updated {weather ? new Date(weather.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-1 pb-0">
          {(['overview', 'lifts', 'trails', 'report'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'text-sky-400 border-sky-500'
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              {t === 'report' ? '❄ Snow Report' : t === 'lifts' ? '🚡 Lifts' : t === 'trails' ? '⛷️ Trails' : '📊 Overview'}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Weather zones */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['summit', 'mid', 'base'] as const).map(z => (
                <ZoneCard key={z} zone={z} data={weather?.zones?.[z]} />
              ))}
            </div>

            {/* Map + Ops Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 h-80 rounded-2xl overflow-hidden border border-gray-700/60">
                {resort && (
                  <ResortMap
                    lat={resort.mountain.latitude}
                    lng={resort.mountain.longitude}
                    baseElevFt={resort.baseElevFt}
                    summitElevFt={resort.summitElevFt}
                    zones={weather?.zones}
                    resortName={resort.mountain.name}
                  />
                )}
              </div>
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <h3 className="text-white font-semibold mb-4">Operations Summary</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Lifts Open</span>
                        <span className="text-white font-medium tabular-nums">{liftSummary?.open ?? 0}/{liftSummary?.total ?? lifts.length}</span>
                      </div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${lifts.length ? ((liftSummary?.open ?? 0) / lifts.length) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Trails Open</span>
                        <span className="text-white font-medium tabular-nums">{(trailSummary?.open ?? 0) + (trailSummary?.groomed ?? 0)}/{trailSummary?.total ?? trails.length}</span>
                      </div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${trails.length ? (((trailSummary?.open ?? 0) + (trailSummary?.groomed ?? 0)) / trails.length) * 100 : 0}%` }} />
                      </div>
                    </div>
                    {weather?.zones?.summit && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">Summit Snow (24h)</span>
                          <span className="text-sky-300 font-medium">{weather.zones.summit.snowfall24hIn.toFixed(1)}"</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {latestReport && (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <h3 className="text-white font-semibold mb-2">Latest Snow Report</h3>
                    <p className="text-gray-400 text-sm leading-relaxed line-clamp-4">
                      {latestReport.narrative || 'No narrative yet — generate one in the Snow Report tab.'}
                    </p>
                    {latestReport.publishedAt && (
                      <p className="text-gray-600 text-xs mt-2">Published {new Date(latestReport.publishedAt).toLocaleString()}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── LIFTS TAB ── */}
        {tab === 'lifts' && (
          <div className="space-y-4">
            {/* Summary pills */}
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Open', key: 'open', color: 'text-emerald-400' },
                { label: 'Hold', key: 'on_hold', color: 'text-amber-400' },
                { label: 'Scheduled', key: 'scheduled', color: 'text-blue-400' },
                { label: 'Closed', key: 'closed', color: 'text-red-400' },
              ].map(s => (
                <div key={s.key} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 flex items-center gap-2">
                  <span className={`text-xl font-bold tabular-nums ${s.color}`}>{liftSummary?.[s.key] ?? 0}</span>
                  <span className="text-gray-500 text-sm">{s.label}</span>
                </div>
              ))}
            </div>

            {lifts.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <p className="text-4xl mb-3">🚡</p>
                <p className="font-medium">No lifts seeded yet.</p>
                <p className="text-sm mt-1">Lifts are auto-seeded from Liftie on onboarding, or add them via the API.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {lifts.map(lift => (
                  <div key={lift.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-white font-medium text-sm leading-snug">{lift.liftName}</p>
                        <p className="text-gray-500 text-xs mt-0.5 capitalize">
                          {LIFT_TYPE_ICONS[lift.liftType] || '🚑'} {lift.liftType}
                          {lift.topElevFt && ` · ${lift.topElevFt.toLocaleString()} ft`}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-lg border capitalize whitespace-nowrap ${STATUS_COLORS[lift.status] || STATUS_COLORS.closed}`}>
                        {lift.status.replace('_', ' ')}
                      </span>
                    </div>
                    <select
                      value={lift.status}
                      onChange={e => updateLiftStatus(lift.liftName, e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-sky-500 cursor-pointer"
                    >
                      <option value="open">Open</option>
                      <option value="on_hold">On Hold</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="closed">Closed</option>
                    </select>
                    {lift.waitMinutes != null && (
                      <p className="text-gray-500 text-xs">Wait: {lift.waitMinutes} min</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TRAILS TAB ── */}
        {tab === 'trails' && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Open', key: 'open', color: 'text-emerald-400' },
                { label: 'Groomed', key: 'groomed', color: 'text-teal-400' },
                { label: 'Patrol Only', key: 'patrol_only', color: 'text-orange-400' },
                { label: 'Closed', key: 'closed', color: 'text-red-400' },
              ].map(s => (
                <div key={s.key} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 flex items-center gap-2">
                  <span className={`text-xl font-bold tabular-nums ${s.color}`}>{trailSummary?.[s.key] ?? 0}</span>
                  <span className="text-gray-500 text-sm">{s.label}</span>
                </div>
              ))}
            </div>

            {trails.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <p className="text-4xl mb-3">⛷️</p>
                <p className="font-medium">No trails added yet.</p>
                <p className="text-sm mt-1">Add trails via the API or CSV import.</p>
              </div>
            ) : (
              Object.entries(trailsByZone).map(([zone, zoneTrails]) => (
                <div key={zone}>
                  <h3 className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-3">{zone}</h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(zoneTrails as Trail[]).map(trail => (
                      <div key={trail.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-base ${DIFFICULTY_COLORS[trail.difficulty]}`}>
                                {DIFFICULTY_ICONS[trail.difficulty]}
                              </span>
                              <p className="text-white font-medium text-sm">{trail.trailName}</p>
                            </div>
                            <div className="flex gap-2 mt-1 text-xs text-gray-500">
                              <span className="capitalize">{trail.difficulty.replace('_', ' ')}</span>
                              {trail.snowDepthIn && <span>· {trail.snowDepthIn}" depth</span>}
                              {trail.groomedAt && trail.status === 'groomed' && (
                                <span>· groomed {new Date(trail.groomedAt).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-lg border capitalize whitespace-nowrap ${STATUS_COLORS[trail.status] || STATUS_COLORS.closed}`}>
                            {trail.status.replace('_', ' ')}
                          </span>
                        </div>
                        <select
                          value={trail.status}
                          onChange={e => updateTrailStatus(trail.trailName, e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-sky-500 cursor-pointer"
                        >
                          <option value="open">Open</option>
                          <option value="groomed">Groomed</option>
                          <option value="patrol_only">Patrol Only</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── SNOW REPORT TAB ── */}
        {tab === 'report' && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-1">Morning Snow Report</h3>
              <p className="text-gray-500 text-sm mb-5">
                Generate an AI-written narrative based on live conditions, or write your own.
              </p>

              <textarea
                value={reportNarrative}
                onChange={e => setReportNarrative(e.target.value)}
                placeholder="Your snow report narrative will appear here after generation, or type one manually…"
                rows={5}
                className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-xl p-4 resize-none focus:outline-none focus:border-sky-500 placeholder-gray-600"
              />

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => generateSnowReport(false)}
                  disabled={generatingReport}
                  className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                >
                  {generatingReport ? '✦ Generating…' : '✦ Generate AI Draft'}
                </button>
                <button
                  onClick={() => generateSnowReport(true)}
                  disabled={generatingReport || !reportNarrative}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                >
                  ✓ Publish Report
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(reportNarrative)}
                  disabled={!reportNarrative}
                  className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 text-sm px-4 py-2.5 rounded-xl transition-colors"
                  title="Copy to clipboard"
                >
                  Copy
                </button>
              </div>

              {resort?.plan === 'starter' && (
                <p className="text-amber-400/70 text-xs mt-3">
                  AI report generation requires Pro or Enterprise plan.{' '}
                  <Link href="/account" className="underline hover:text-amber-300">Upgrade</Link>
                </p>
              )}
            </div>

            {/* Previous reports */}
            {reports.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-4">Report History</h3>
                <div className="space-y-4">
                  {reports.map(r => (
                    <div key={r.id} className="border-b border-gray-800 last:border-0 pb-4 last:pb-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-400 text-sm">{new Date(r.reportDate).toLocaleDateString()}</span>
                        <div className="flex gap-3 text-xs text-gray-500">
                          <span>{r.openLifts}/{r.totalLifts} lifts</span>
                          <span>{r.openTrails}/{r.totalTrails} trails</span>
                          <span className="text-sky-400">{r.snowfall24hIn.toFixed(1)}" new</span>
                          {r.publishedAt && <span className="text-emerald-400">Published</span>}
                        </div>
                      </div>
                      {r.narrative && <p className="text-gray-400 text-sm leading-relaxed">{r.narrative}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
