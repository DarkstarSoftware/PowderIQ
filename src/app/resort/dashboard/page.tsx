'use client';
// src/app/resort/dashboard/page.tsx

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

const TrailMap = dynamic(() => import('@/components/resort/TrailMap'), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'map' | 'overview' | 'lifts' | 'trails' | 'report';

interface ZoneWeather {
  zone: 'base' | 'mid' | 'summit';
  elevFt: number; tempF: number; feelsLikeF: number;
  windMph: number; windGustMph: number; windDir: string;
  visibilityMi: number; conditionDesc: string; humidity: number;
  snowfall1hIn: number; snowfall24hIn: number; snowDepthIn: number;
  forecastHigh: number; forecastLow: number; forecastSnowIn: number;
}
interface WeatherReport {
  resortId: string; fetchedAt: string; backend: string;
  zones: { base: ZoneWeather; mid: ZoneWeather; summit: ZoneWeather };
}
interface Lift {
  id: string; liftName: string; liftType: string;
  status: 'open' | 'on_hold' | 'closed' | 'scheduled';
  waitMinutes?: number; topElevFt?: number;
}
interface Trail {
  id: string; trailName: string;
  difficulty: 'green' | 'blue' | 'black' | 'double_black' | 'terrain_park' | 'backcountry';
  status: 'open' | 'groomed' | 'closed' | 'patrol_only';
  zone?: string; snowDepthIn?: number; groomedAt?: string;
}
interface SnowReport {
  id: string; reportDate: string; snowfall24hIn: number;
  openLifts: number; totalLifts: number; openTrails: number; totalTrails: number;
  narrative?: string; publishedAt?: string;
}
interface Resort {
  id: string; name: string; plan: string; planStatus: string;
  baseElevFt: number; summitElevFt: number; staffRole: string;
  mountain: { name: string; latitude: number; longitude: number; state: string; slug?: string };
}

// ─── Small reusable components ────────────────────────────────────────────────

const STATUS_CHIP: Record<string, string> = {
  open:        'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  on_hold:     'bg-amber-500/20  text-amber-300  border-amber-500/30',
  closed:      'bg-red-500/20    text-red-400    border-red-500/30',
  scheduled:   'bg-blue-500/20   text-blue-300   border-blue-500/30',
  groomed:     'bg-teal-500/20   text-teal-300   border-teal-500/30',
  patrol_only: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
};
const DIFF_ICON: Record<string, string> = {
  green:'●', blue:'◆', black:'◆', double_black:'◆◆', terrain_park:'▲', backcountry:'⬡',
};
const DIFF_COLOR: Record<string, string> = {
  green:'text-emerald-400', blue:'text-blue-400', black:'text-gray-200',
  double_black:'text-gray-100', terrain_park:'text-orange-400', backcountry:'text-yellow-400',
};

function WindHoldBanner({ zones }: { zones?: WeatherReport['zones'] }) {
  const hold = (['summit','mid','base'] as const).filter(z => (zones?.[z]?.windMph ?? 0) > 35);
  if (!hold.length) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
      <span className="text-amber-400 text-sm font-semibold">⚠ Wind Hold</span>
      <span className="text-amber-300/70 text-xs hidden sm:block">
        {hold.map(z => `${z} (${zones![z].windMph.toFixed(0)} mph)`).join(', ')}
      </span>
    </div>
  );
}

function ZoneCard({ zone, d }: { zone: 'base'|'mid'|'summit'; d?: ZoneWeather }) {
  const cfg = {
    summit:{ icon:'🏔️', label:'Summit',       grad:'from-sky-950/40 to-indigo-950/20' },
    mid:   { icon:'⛷️',  label:'Mid Mountain', grad:'from-indigo-950/40 to-violet-950/20' },
    base:  { icon:'🏠',  label:'Base',         grad:'from-emerald-950/20 to-teal-950/10' },
  }[zone];
  const windHold = (d?.windMph ?? 0) > 35;
  return (
    <div className={`bg-gradient-to-br ${cfg.grad} border border-gray-700/60 rounded-2xl p-5`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-300 font-semibold text-sm">{cfg.icon} {cfg.label}</span>
        {d && <span className="text-gray-500 text-xs">{d.elevFt.toLocaleString()} ft</span>}
      </div>
      {d ? (
        <>
          <p className="text-4xl font-bold text-white tabular-nums mb-1">{d.tempF.toFixed(0)}°F</p>
          <p className="text-gray-400 text-sm capitalize mb-3">{d.conditionDesc}</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label:'Wind',   val:`${d.windMph.toFixed(0)} mph ${d.windDir}${windHold?' ⚠':''}`, cls: windHold ? 'text-amber-400' : 'text-white' },
              { label:'New Snow', val:`${d.snowfall24hIn.toFixed(1)}"`, cls:'text-sky-300' },
              { label:'Depth',  val:`${d.snowDepthIn.toFixed(0)}"`, cls:'text-white' },
              { label:'Viz',    val:`${d.visibilityMi.toFixed(1)} mi`, cls:'text-white' },
            ].map(row => (
              <div key={row.label} className="bg-gray-900/50 rounded-lg p-2">
                <p className="text-gray-500 mb-0.5">{row.label}</p>
                <p className={`font-semibold ${row.cls}`}>{row.val}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between text-xs text-gray-500">
            <span>↓ {d.forecastLow.toFixed(0)}° Low</span>
            <span>↑ {d.forecastHigh.toFixed(0)}° High</span>
            <span>❄ {d.forecastSnowIn.toFixed(1)}" fcst</span>
          </div>
        </>
      ) : (
        <div className="h-32 flex items-center justify-center text-gray-600 text-sm">Loading…</div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ResortDashboardPage() {
  const router = useRouter();
  const [tab, setTab]         = useState<Tab>('map');
  const [resort, setResort]   = useState<Resort | null>(null);
  const [weather, setWeather] = useState<WeatherReport | null>(null);
  const [lifts, setLifts]     = useState<Lift[]>([]);
  const [liftSummary, setLiftSummary]   = useState<any>(null);
  const [trails, setTrails]             = useState<Trail[]>([]);
  const [trailsByZone, setTrailsByZone] = useState<Record<string, Trail[]>>({});
  const [trailSummary, setTrailSummary] = useState<any>(null);
  const [reports, setReports]           = useState<SnowReport[]>([]);
  const [loading, setLoading]           = useState(true);
  const [token, setToken]               = useState<string | null>(null);
  const [generating, setGenerating]     = useState(false);
  const [narrative, setNarrative]       = useState('');

  const fetchAll = useCallback(async (tok: string, id: string) => {
    const h = { Authorization: `Bearer ${tok}` };
    const [w, l, t, r] = await Promise.allSettled([
      fetch(`/api/resort/${id}/weather`,     { headers: h }).then(x => x.json()),
      fetch(`/api/resort/${id}/lifts`,       { headers: h }).then(x => x.json()),
      fetch(`/api/resort/${id}/trails`,      { headers: h }).then(x => x.json()),
      fetch(`/api/resort/${id}/snow-report`, { headers: h }).then(x => x.json()),
    ]);
    if (w.status === 'fulfilled') setWeather(w.value?.data);
    if (l.status === 'fulfilled') { setLifts(l.value?.data?.lifts ?? []); setLiftSummary(l.value?.data?.summary); }
    if (t.status === 'fulfilled') { setTrails(t.value?.data?.trails ?? []); setTrailsByZone(t.value?.data?.byZone ?? {}); setTrailSummary(t.value?.data?.summary); }
    if (r.status === 'fulfilled') setReports(r.value?.data ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push('/auth/login'); return; }
      const tok = data.session.access_token;
      setToken(tok);
      const res = await fetch('/api/resort', { headers: { Authorization: `Bearer ${tok}` } });
      if (!res.ok) { router.push('/resort/onboard'); return; }
      const json = await res.json();
      const r = json.data?.[0];
      if (!r) { router.push('/resort/onboard'); return; }
      setResort(r);
      await fetchAll(tok, r.id);
      setLoading(false);
    })();
  }, [router, fetchAll]);

  useEffect(() => {
    if (!token || !resort) return;
    const iv = setInterval(() => {
      fetch(`/api/resort/${resort.id}/weather`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setWeather(d?.data));
    }, 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, [token, resort]);

  async function patchLift(liftName: string, status: string) {
    if (!resort || !token) return;
    await fetch(`/api/resort/${resort.id}/lifts`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ liftName, status }),
    });
    setLifts(p => p.map(l => l.liftName === liftName ? { ...l, status: status as any } : l));
  }

  async function patchTrail(trailName: string, status: string) {
    if (!resort || !token) return;
    await fetch(`/api/resort/${resort.id}/trails`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trailName, status }),
    });
    setTrails(p => p.map(t => t.trailName === trailName ? { ...t, status: status as any } : t));
    setTrailsByZone(p => {
      const u = { ...p };
      for (const z of Object.keys(u)) u[z] = u[z].map(t => t.trailName === trailName ? { ...t, status: status as any } : t);
      return u;
    });
  }

  async function generateReport(publish = false) {
    if (!resort || !token) return;
    setGenerating(true);
    const res = await fetch(`/api/resort/${resort.id}/snow-report`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ generate: true, publish }),
    });
    const data = await res.json();
    if (data.data?.report?.narrative) setNarrative(data.data.report.narrative);
    if (data.data?.report) setReports(p => [data.data.report, ...p]);
    setGenerating(false);
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Loading resort dashboard…</p>
      </div>
    </div>
  );

  const TABS: { key: Tab; label: string }[] = [
    { key: 'map',      label: '🗺 Trail Map'   },
    { key: 'overview', label: '📊 Overview'    },
    { key: 'lifts',    label: '🚡 Lifts'       },
    { key: 'trails',   label: '⛷️ Trails'      },
    { key: 'report',   label: '❄ Snow Report'  },
  ];

  const mountainSlug = resort?.mountain?.slug
    ?? resort?.mountain?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return (
    <div className="min-h-screen bg-gray-950">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-300 text-sm transition-colors shrink-0">
              ← Dashboard
            </Link>
            <span className="text-gray-700">|</span>
            <div className="min-w-0">
              <h1 className="text-white font-bold text-sm truncate">{resort?.mountain?.name}</h1>
              <p className="text-gray-500 text-xs">{resort?.mountain?.state} · {resort?.plan} · {resort?.planStatus}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <WindHoldBanner zones={weather?.zones} />
            <Link
              href={`/mountains/${mountainSlug}/map`}
              target="_blank"
              className="hidden sm:flex items-center gap-1 text-xs text-gray-500 hover:text-sky-400 border border-gray-700 hover:border-sky-700 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              ↗ Guest Map
            </Link>
            <span className="text-gray-600 text-xs hidden lg:block">
              {weather ? `Updated ${new Date(weather.fetchedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}` : '—'}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                tab === t.key ? 'text-sky-400 border-sky-500' : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── MAP TAB ── */}
      {tab === 'map' && resort && token && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-8">
          {/* Weather strip */}
          {weather && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {(['summit','mid','base'] as const).map(z => {
                const d = weather.zones[z];
                if (!d) return null;
                const windHold = d.windMph > 35;
                const border = { summit:'border-sky-700/40 bg-sky-950/20', mid:'border-indigo-700/40 bg-indigo-950/20', base:'border-emerald-700/40 bg-emerald-950/20' }[z];
                return (
                  <div key={z} className={`rounded-xl border ${border} px-4 py-3 flex items-center justify-between`}>
                    <div>
                      <p className="text-gray-500 text-xs mb-0.5 capitalize">{z === 'mid' ? 'Mid Mtn' : z}</p>
                      <p className="text-white font-bold text-xl tabular-nums">{d.tempF.toFixed(0)}°F</p>
                      <p className="text-gray-500 text-xs capitalize truncate max-w-[100px]">{d.conditionDesc}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${windHold ? 'text-amber-400' : 'text-gray-300'}`}>
                        {windHold ? '⚠ ' : ''}{d.windMph.toFixed(0)} mph
                      </p>
                      <p className="text-sky-400 text-sm font-semibold">{d.snowfall24hIn.toFixed(1)}" new</p>
                      <p className="text-gray-500 text-xs">{d.snowDepthIn.toFixed(0)}" base</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Trail Map — height fills remaining viewport */}
          <TrailMap
            resortId={resort.id}
            token={token}
            height="calc(100vh - 310px)"
            showWeather={true}
            readOnly={false}
          />

          <p className="text-gray-700 text-xs mt-2 text-center">
            Trail geometry © OpenStreetMap contributors · Lift & trail status from PowderIQ live data · Click any feature for details
          </p>
        </div>
      )}

      {/* ── All other tabs ── */}
      {tab !== 'map' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['summit','mid','base'] as const).map(z => (
                  <ZoneCard key={z} zone={z} d={weather?.zones?.[z]} />
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
                  <h3 className="text-white font-semibold">Operations</h3>
                  {[
                    { label:'Lifts Open',   open: liftSummary?.open ?? 0,  total: lifts.length,  color:'bg-emerald-500' },
                    { label:'Trails Open',  open:(trailSummary?.open ?? 0)+(trailSummary?.groomed ?? 0), total: trails.length, color:'bg-sky-500' },
                  ].map(row => (
                    <div key={row.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">{row.label}</span>
                        <span className="text-white font-medium">{row.open}/{row.total}</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full ${row.color} rounded-full`} style={{ width:`${row.total ? (row.open/row.total)*100 : 0}%` }} />
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setTab('map')}
                    className="mt-2 w-full text-sm text-sky-400 hover:text-sky-300 border border-sky-900 hover:border-sky-700 rounded-xl py-2 transition-colors">
                    🗺 Open Trail Map →
                  </button>
                </div>
                {reports[0] && (
                  <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <h3 className="text-white font-semibold mb-2">Latest Snow Report</h3>
                    <p className="text-gray-400 text-sm leading-relaxed line-clamp-5">{reports[0].narrative || 'No narrative — generate one in the Snow Report tab.'}</p>
                    {reports[0].publishedAt && <p className="text-gray-600 text-xs mt-2">Published {new Date(reports[0].publishedAt).toLocaleString()}</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* LIFTS */}
          {tab === 'lifts' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                {([{label:'Open',key:'open',c:'text-emerald-400'},{label:'Hold',key:'on_hold',c:'text-amber-400'},{label:'Scheduled',key:'scheduled',c:'text-blue-400'},{label:'Closed',key:'closed',c:'text-red-400'}] as const).map(s => (
                  <div key={s.key} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 flex items-center gap-2">
                    <span className={`text-xl font-bold tabular-nums ${s.c}`}>{liftSummary?.[s.key] ?? 0}</span>
                    <span className="text-gray-500 text-sm">{s.label}</span>
                  </div>
                ))}
              </div>
              {lifts.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <p className="text-4xl mb-3">🚡</p>
                  <p>No lifts seeded yet. They auto-seed from Liftie on onboarding.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {lifts.map(lift => (
                    <div key={lift.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-white font-medium text-sm">{lift.liftName}</p>
                          <p className="text-gray-500 text-xs capitalize">{lift.liftType}{lift.topElevFt ? ` · ${lift.topElevFt.toLocaleString()} ft` : ''}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-lg border capitalize whitespace-nowrap ${STATUS_CHIP[lift.status] || STATUS_CHIP.closed}`}>
                          {lift.status.replace('_',' ')}
                        </span>
                      </div>
                      {lift.waitMinutes != null && lift.status === 'open' && (
                        <p className="text-amber-400 text-xs font-medium">⏱ {lift.waitMinutes} min wait</p>
                      )}
                      <select value={lift.status} onChange={e => patchLift(lift.liftName, e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-sky-500 cursor-pointer">
                        <option value="open">Open</option>
                        <option value="on_hold">On Hold</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TRAILS */}
          {tab === 'trails' && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-3">
                {([{label:'Open',key:'open',c:'text-emerald-400'},{label:'Groomed',key:'groomed',c:'text-teal-400'},{label:'Patrol Only',key:'patrol_only',c:'text-orange-400'},{label:'Closed',key:'closed',c:'text-red-400'}] as const).map(s => (
                  <div key={s.key} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 flex items-center gap-2">
                    <span className={`text-xl font-bold tabular-nums ${s.c}`}>{trailSummary?.[s.key] ?? 0}</span>
                    <span className="text-gray-500 text-sm">{s.label}</span>
                  </div>
                ))}
              </div>
              {trails.length === 0 ? (
                <div className="text-center py-16 text-gray-500"><p className="text-4xl mb-3">⛷️</p><p>No trails added yet.</p></div>
              ) : (
                Object.entries(trailsByZone).map(([zone, zt]) => (
                  <div key={zone}>
                    <h3 className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-3">{zone}</h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {(zt as Trail[]).map(trail => (
                        <div key={trail.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`${DIFF_COLOR[trail.difficulty]}`}>{DIFF_ICON[trail.difficulty]}</span>
                                <p className="text-white font-medium text-sm">{trail.trailName}</p>
                              </div>
                              <p className="text-gray-500 text-xs capitalize mt-0.5">
                                {trail.difficulty.replace('_',' ')}
                                {trail.snowDepthIn ? ` · ${trail.snowDepthIn}" depth` : ''}
                              </p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-lg border capitalize whitespace-nowrap ${STATUS_CHIP[trail.status] || STATUS_CHIP.closed}`}>
                              {trail.status.replace('_',' ')}
                            </span>
                          </div>
                          <select value={trail.status} onChange={e => patchTrail(trail.trailName, e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-sky-500 cursor-pointer">
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

          {/* SNOW REPORT */}
          {tab === 'report' && (
            <div className="max-w-2xl space-y-6">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-1">Morning Snow Report</h3>
                <p className="text-gray-500 text-sm mb-5">AI-written from live conditions, or write manually.</p>
                <textarea value={narrative} onChange={e => setNarrative(e.target.value)}
                  placeholder="Generate an AI draft or type your narrative here…" rows={5}
                  className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-xl p-4 resize-none focus:outline-none focus:border-sky-500 placeholder-gray-600" />
                <div className="flex gap-3 mt-4">
                  <button onClick={() => generateReport(false)} disabled={generating}
                    className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                    {generating ? '✦ Generating…' : '✦ Generate AI Draft'}
                  </button>
                  <button onClick={() => generateReport(true)} disabled={generating || !narrative}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                    ✓ Publish Report
                  </button>
                  <button onClick={() => navigator.clipboard.writeText(narrative)} disabled={!narrative}
                    className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 text-sm px-4 py-2.5 rounded-xl transition-colors">
                    Copy
                  </button>
                </div>
                {resort?.plan === 'starter' && (
                  <p className="text-amber-400/70 text-xs mt-3">AI generation requires Pro or Enterprise. <Link href="/account" className="underline">Upgrade</Link></p>
                )}
              </div>
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
      )}
    </div>
  );
}
