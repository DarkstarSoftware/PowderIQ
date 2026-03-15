'use client';
// src/app/resort/dashboard/page.tsx

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

const TrailMap = dynamic(() => import('@/components/resort/TrailMap'), { ssr: false });

type Tab = 'overview' | 'map' | 'lifts' | 'trails' | 'report' | 'analytics' | 'settings';

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
  waitMinutes?: number; topElevFt?: number; capacityPerHour?: number;
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

const DIFF_DOT: Record<string, { color: string }> = {
  green:        { color: '#22c55e' },
  blue:         { color: '#3b82f6' },
  black:        { color: '#374151' },
  double_black: { color: '#111827' },
  terrain_park: { color: '#f97316' },
  backcountry:  { color: '#eab308' },
};
const SC: Record<string, { dot: string; text: string; bg: string }> = {
  open:      { dot: '#22c55e', text: '#15803d', bg: '#f0fdf4' },
  on_hold:   { dot: '#f59e0b', text: '#92400e', bg: '#fffbeb' },
  closed:    { dot: '#ef4444', text: '#991b1b', bg: '#fef2f2' },
  scheduled: { dot: '#3b82f6', text: '#1d40af', bg: '#eff6ff' },
  groomed:   { dot: '#0891b2', text: '#155e75', bg: '#ecfeff' },
};
function condIcon(d?: string) {
  const s = d?.toLowerCase() || '';
  if (s.includes('snow') || s.includes('blizzard')) return '🌨️';
  if (s.includes('partly')) return '⛅';
  if (s.includes('cloud') || s.includes('overcast')) return '☁️';
  if (s.includes('clear') || s.includes('sunny')) return '☀️';
  if (s.includes('fog') || s.includes('mist')) return '🌫️';
  return '🌤️';
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --blue:#1d6ef5;--blue-lt:#e8f1fe;--blue-mid:#3b82f6;
  --text:#0d1b2e;--text2:#3d5166;--text3:#6b849a;
  --bd:rgba(100,150,200,0.15);--bd2:rgba(100,150,200,0.25);
  --bg:#f8fafc;--white:#ffffff;
  --green:#22c55e;--green-bg:#f0fdf4;
  --sh:0 1px 4px rgba(15,40,80,0.08);--sh-md:0 4px 16px rgba(15,40,80,0.10);
}
html,body{height:100%;font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);font-size:14px;}

/* TOPNAV */
.tnav{position:sticky;top:0;z-index:100;height:56px;background:var(--white);border-bottom:1px solid var(--bd2);display:flex;align-items:center;padding:0 20px;gap:12px;box-shadow:var(--sh);}
.tnav-logo{display:flex;align-items:center;text-decoration:none;flex-shrink:0;min-width:160px;}
.tnav-logo img{height:30px;width:auto;}
.tnav-tabs{display:flex;align-items:center;gap:2px;flex:1;}
.tnav-tab{display:flex;align-items:center;gap:5px;padding:6px 14px;border-radius:8px;font-size:13px;font-weight:600;color:var(--text3);cursor:pointer;transition:background .15s,color .15s;border:none;background:none;font-family:'Inter',sans-serif;white-space:nowrap;}
.tnav-tab:hover{background:var(--bg);color:var(--text);}
.tnav-tab.act{background:var(--blue-lt);color:var(--blue);}
.tnav-right{display:flex;align-items:center;gap:8px;margin-left:auto;flex-shrink:0;}
.api-badge{display:flex;align-items:center;gap:5px;padding:5px 12px;background:var(--green-bg);border:1px solid rgba(34,197,94,0.3);border-radius:20px;font-size:12px;font-weight:600;color:#15803d;}
.api-dot{width:7px;height:7px;background:var(--green);border-radius:50%;}
.tnav-icn{width:32px;height:32px;border-radius:8px;border:1px solid var(--bd2);background:var(--white);display:flex;align-items:center;justify-content:center;font-size:14px;cursor:pointer;text-decoration:none;transition:background .15s;}
.tnav-icn:hover{background:var(--bg);}
.tnav-av{width:32px;height:32px;border-radius:50%;background:var(--blue);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.tnav-out{font-size:13px;font-weight:600;color:var(--text2);cursor:pointer;background:none;border:none;font-family:'Inter',sans-serif;transition:color .15s;}
.tnav-out:hover{color:var(--text);}

/* BODY */
.body-shell{display:flex;height:calc(100vh - 56px);overflow:hidden;}

/* SIDEBAR */
.sidebar{width:200px;flex-shrink:0;background:var(--white);border-right:1px solid var(--bd2);overflow-y:auto;display:flex;flex-direction:column;}
.sb-resort{padding:14px 12px 10px;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:8px;}
.sb-resort-ico{width:28px;height:28px;border-radius:6px;background:var(--blue-lt);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
.sb-resort-name{font-size:12px;font-weight:700;color:var(--text);line-height:1.2;}
.sb-resort-loc{font-size:11px;color:var(--text3);}
.sb-sec{padding:10px 8px 4px;}
.sb-sec-lbl{font-size:9.5px;font-weight:700;color:var(--text3);letter-spacing:.07em;text-transform:uppercase;padding:0 6px 6px;}
.sb-item{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:8px;font-size:12.5px;font-weight:500;color:var(--text2);cursor:pointer;transition:background .15s,color .15s;border:none;background:none;width:100%;text-align:left;font-family:'Inter',sans-serif;text-decoration:none;}
.sb-item:hover{background:var(--bg);color:var(--text);}
.sb-item.act{background:var(--blue-lt);color:var(--blue);font-weight:600;}
.sb-item-ico{font-size:13px;width:16px;text-align:center;flex-shrink:0;}
.sb-footer{margin-top:auto;padding:12px 10px;border-top:1px solid var(--bd);}
.plan-badge{display:flex;align-items:center;gap:6px;padding:7px 10px;background:var(--green-bg);border:1px solid rgba(34,197,94,0.25);border-radius:8px;font-size:11.5px;font-weight:600;color:#15803d;margin-bottom:8px;}
.plan-dot{width:6px;height:6px;background:var(--green);border-radius:50%;}
.upgrade-btn{display:flex;align-items:center;gap:6px;padding:7px 10px;background:var(--blue-lt);border:1px solid rgba(29,110,245,0.2);border-radius:8px;font-size:11.5px;font-weight:600;color:var(--blue);text-decoration:none;transition:background .15s;}
.upgrade-btn:hover{background:#d4e5fe;}

/* MAIN */
.main-area{flex:1;overflow-y:auto;}
.pg-hd{background:var(--white);border-bottom:1px solid var(--bd2);padding:16px 24px 0;}
.pg-hd-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
.pg-title{font-size:22px;font-weight:800;color:var(--text);}
.pg-title span{font-weight:400;color:var(--text3);}
.status-pill{display:flex;align-items:center;gap:5px;padding:4px 12px;background:var(--green-bg);border:1px solid rgba(34,197,94,0.3);border-radius:20px;font-size:11.5px;font-weight:600;color:#15803d;}
.pg-tabs{display:flex;}
.pg-tab{display:flex;align-items:center;gap:5px;padding:8px 14px;font-size:13px;font-weight:600;color:var(--text3);border-bottom:2px solid transparent;cursor:pointer;transition:color .15s,border-color .15s;border-top:none;border-left:none;border-right:none;background:none;font-family:'Inter',sans-serif;margin-bottom:-1px;white-space:nowrap;}
.pg-tab:hover{color:var(--text);}
.pg-tab.act{color:var(--blue);border-bottom-color:var(--blue);}

/* CONTENT */
.content{padding:20px 24px;}

/* CARD */
.card{background:var(--white);border:1px solid var(--bd2);border-radius:12px;overflow:hidden;}

/* OVERVIEW */
.ov-grid{display:grid;grid-template-columns:1fr 272px;gap:16px;}
.ov-left{display:flex;flex-direction:column;gap:16px;min-width:0;}
.ov-right{display:flex;flex-direction:column;gap:16px;}

/* CONDITIONS */
.cond-hd{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 12px;border-bottom:1px solid var(--bd);}
.cond-hd-title{font-size:13px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:6px;}
.active-tag{display:flex;align-items:center;gap:5px;padding:3px 10px;background:var(--green-bg);border:1px solid rgba(34,197,94,0.3);border-radius:12px;font-size:11px;font-weight:600;color:#15803d;}
.zone-cards{display:grid;grid-template-columns:repeat(3,1fr);}
.zone-card{padding:14px 14px 16px;border-right:1px solid var(--bd);}
.zone-card:last-child{border-right:none;}
.zone-name{font-size:12px;font-weight:600;color:var(--text2);margin-bottom:4px;display:flex;align-items:center;gap:6px;}
.zone-temp{font-size:30px;font-weight:900;color:var(--text);line-height:1;margin-bottom:2px;}
.zone-cond{font-size:11.5px;color:var(--text3);margin-bottom:6px;}
.zone-wind{font-size:11px;color:var(--text3);margin-bottom:8px;}
.zone-stats{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
.zone-stat{background:var(--bg);border-radius:7px;padding:7px 8px;}
.zone-stat-val{font-size:16px;font-weight:800;color:var(--text);line-height:1;}
.zone-stat-lbl{font-size:10px;color:var(--text3);margin-top:2px;}

/* OPS STATS */
.ops-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
.ops-card{background:var(--white);border:1px solid var(--bd2);border-radius:12px;padding:16px;text-align:center;}
.ops-val{font-size:28px;font-weight:900;line-height:1;}
.ops-denom{font-size:14px;color:var(--text3);font-weight:500;}
.ops-lbl{font-size:12px;color:var(--text3);margin-top:4px;}

/* MAP */
.map-controls{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--bd);flex-wrap:wrap;}
.map-chip{display:flex;align-items:center;gap:5px;padding:4px 10px;border:1px solid var(--bd2);border-radius:6px;font-size:12px;font-weight:600;color:var(--text2);cursor:pointer;background:var(--white);transition:background .15s;}
.map-chip.act{background:var(--blue-lt);border-color:rgba(29,110,245,0.3);color:var(--blue);}
.map-chip:hover{background:var(--bg);}
.map-icn{width:28px;height:28px;border-radius:6px;border:1px solid var(--bd2);background:var(--white);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:13px;transition:background .15s;}
.map-icn:hover{background:var(--bg);}

/* RIGHT PANEL */
.feat-row{display:flex;align-items:center;padding:10px 14px;border-bottom:1px solid var(--bd);}
.feat-row:last-child{border-bottom:none;}
.feat-name{font-size:13px;font-weight:500;color:var(--text2);flex:1;}
.feat-tog{width:28px;height:28px;border-radius:6px;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:13px;font-weight:700;}
.feat-tog.on{background:#dbeafe;color:var(--blue);}
.feat-tog.sy{background:#dcfce7;color:#15803d;}
.feat-tog.dl{background:#fef3c7;color:#92400e;}
.tm-row{display:flex;align-items:center;padding:10px 14px;border-bottom:1px solid var(--bd);}
.tm-row:last-child{border-bottom:none;}
.tm-dot{width:10px;height:10px;border-radius:2px;flex-shrink:0;margin-right:8px;}
.tm-name{font-size:13px;color:var(--text2);flex:1;font-weight:500;}
.tm-sc{font-size:12px;font-weight:700;color:var(--blue);background:var(--blue-lt);padding:2px 8px;border-radius:4px;}
.ls-row{display:flex;align-items:center;padding:10px 14px;border-bottom:1px solid var(--bd);}
.ls-row:last-child{border-bottom:none;}
.ls-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-right:8px;}
.ls-name{font-size:13px;font-weight:500;color:var(--text2);flex:1;}
.ls-cnt{font-size:13px;font-weight:700;color:var(--text3);}
.ls-chv{font-size:13px;color:var(--text3);margin-left:6px;cursor:pointer;}
.manage-btn{width:100%;padding:9px;text-align:center;font-size:12.5px;font-weight:600;color:var(--blue);background:none;border:none;border-top:1px solid var(--bd);cursor:pointer;font-family:'Inter',sans-serif;transition:background .15s;}
.manage-btn:hover{background:var(--bg);}
.card-title{font-size:13px;font-weight:600;color:var(--text);}

/* TABLES */
.sum-chips{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;}
.sum-chip{padding:6px 14px;background:var(--white);border:1px solid var(--bd2);border-radius:8px;font-size:13px;font-weight:600;}
.tbl{width:100%;border-collapse:collapse;}
.tbl th{text-align:left;font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.05em;text-transform:uppercase;padding:10px 16px;background:var(--bg);border-bottom:1px solid var(--bd2);}
.tbl td{padding:11px 16px;border-bottom:1px solid var(--bd);font-size:13px;color:var(--text2);}
.tbl tr:last-child td{border-bottom:none;}
.tbl tr:hover td{background:var(--bg);}
.s-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;}
.s-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
.add-btn{padding:7px 14px;background:var(--blue);color:#fff;border:none;border-radius:8px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;transition:filter .15s;}
.add-btn:hover{filter:brightness(1.08);}
.sec-btn{padding:7px 14px;background:var(--white);color:var(--text2);border:1px solid var(--bd2);border-radius:8px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;transition:background .15s;}
.sec-btn:hover{background:var(--bg);}
.sts-sel{padding:4px 8px;border:1px solid var(--bd2);border-radius:6px;background:var(--white);font-size:12px;color:var(--text2);cursor:pointer;font-family:'Inter',sans-serif;outline:none;}
.sts-sel:focus{border-color:var(--blue);}

/* REPORT */
.rep-ed{width:100%;padding:14px;border:1px solid var(--bd2);border-radius:10px;font-size:13.5px;font-family:'Inter',sans-serif;color:var(--text);resize:vertical;outline:none;background:var(--white);line-height:1.6;min-height:130px;}
.rep-ed:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(29,110,245,.1);}
.rep-btn-row{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;}
.rbtn-p{padding:8px 18px;background:var(--blue);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;transition:filter .15s;display:flex;align-items:center;gap:6px;}
.rbtn-p:hover:not(:disabled){filter:brightness(1.08);}
.rbtn-p:disabled{opacity:.5;cursor:not-allowed;}
.rbtn-g{padding:8px 18px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;transition:filter .15s;}
.rbtn-g:hover:not(:disabled){filter:brightness(1.08);}
.rbtn-g:disabled{opacity:.5;cursor:not-allowed;}
.rbtn-s{padding:8px 14px;background:var(--white);color:var(--text2);border:1px solid var(--bd2);border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;transition:background .15s;}
.rbtn-s:hover:not(:disabled){background:var(--bg);}
.rbtn-s:disabled{opacity:.4;cursor:not-allowed;}

@media(max-width:1100px){.ov-grid{grid-template-columns:1fr;}}
@media(max-width:768px){.sidebar{display:none;}.tnav-tabs{display:none;}.ops-row{grid-template-columns:1fr 1fr;}.zone-cards{grid-template-columns:1fr;}}
@keyframes spin{to{transform:rotate(360deg);}}
`;

export default function ResortDashboardPage() {
  const router = useRouter();
  const [tab,          setTab]          = useState<Tab>('overview');
  const [resort,       setResort]       = useState<Resort | null>(null);
  const [weather,      setWeather]      = useState<WeatherReport | null>(null);
  const [lifts,        setLifts]        = useState<Lift[]>([]);
  const [liftSummary,  setLiftSummary]  = useState<any>(null);
  const [trails,       setTrails]       = useState<Trail[]>([]);
  const [trailsByZone, setTrailsByZone] = useState<Record<string, Trail[]>>({});
  const [trailSummary, setTrailSummary] = useState<any>(null);
  const [reports,      setReports]      = useState<SnowReport[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [token,        setToken]        = useState<string | null>(null);
  const [generating,   setGenerating]   = useState(false);
  const [narrative,    setNarrative]    = useState('');
  const [userEmail,    setUserEmail]    = useState('');

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
      setUserEmail(data.session.user?.email || '');
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
    setLifts(p => p.map(l => l.liftName === liftName ? { ...l, status: status as Lift['status'] } : l));
  }

  async function patchTrail(trailName: string, status: string) {
    if (!resort || !token) return;
    await fetch(`/api/resort/${resort.id}/trails`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trailName, status }),
    });
    setTrails(p => p.map(t => t.trailName === trailName ? { ...t, status: status as Trail['status'] } : t));
    setTrailsByZone(p => {
      const u = { ...p };
      for (const z of Object.keys(u)) u[z] = u[z].map(t => t.trailName === trailName ? { ...t, status: status as Trail['status'] } : t);
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

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  const openLifts    = liftSummary?.open ?? 0;
  const totalLifts   = lifts.length;
  const openTrails   = (trailSummary?.open ?? 0) + (trailSummary?.groomed ?? 0);
  const totalTrails  = trails.length;
  const groomedCount = trailSummary?.groomed ?? 0;
  const avatarLetter = userEmail?.[0]?.toUpperCase() || 'R';
  const resortName   = resort?.mountain?.name || 'Resort';
  const resortState  = resort?.mountain?.state || '';

  if (loading) return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');body{margin:0;background:#f8fafc;font-family:'Inter',sans-serif;}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12}}>
        <div style={{width:36,height:36,border:'3px solid #dbeafe',borderTopColor:'#1d6ef5',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
        <p style={{fontSize:13,color:'#6b849a'}}>Loading resort dashboard…</p>
      </div>
    </>
  );

  const NAV_TABS: {key:Tab;label:string}[] = [
    {key:'overview',label:'Dashboard'},{key:'map',label:'Resorts'},{key:'lifts',label:'Lifts'},
    {key:'trails',label:'Trails'},{key:'settings',label:'Settings'},
  ];
  const SUB_TABS: {key:Tab;label:string;icon:string}[] = [
    {key:'overview',label:'Overview',icon:'📊'},{key:'map',label:'Trail Map',icon:'🗺️'},
    {key:'lifts',label:'Lifts',icon:'🚡'},{key:'trails',label:'Trails',icon:'⛷️'},
    {key:'report',label:'Snow Report',icon:'❄️'},{key:'analytics',label:'Analytics',icon:'📈'},
  ];
  const SIDEBAR_SECS = [
    { label:'RESORT MANAGEMENT', items:[
      {key:'overview',label:'Overview',icon:'📋'},{key:'ops',label:'Operations',icon:'⚙️'},
      {key:'mapeditor',label:'Trail Map Editor',icon:'🗺️'},{key:'lifts',label:'Lifts',icon:'🚡'},
      {key:'trails',label:'Trails',icon:'⛷️'},{key:'report',label:'Snow Reports',icon:'❄️'},
      {key:'analytics',label:'Analytics',icon:'📈'},
    ]},
    { label:'DATA & AUTOMATION', items:[
      {key:'weather',label:'Weather Sync',icon:'🌡️'},{key:'liftie',label:'Liftie Integration',icon:'🔗'},
      {key:'import',label:'Trail Data Import',icon:'📥'},{key:'aisnow',label:'AI Snow Reports',icon:'🤖'},
    ]},
    { label:'ANALYTICS', items:[
      {key:'powder',label:'Powder Score',icon:'❄️'},{key:'trends',label:'Weather Trends',icon:'📊'},
      {key:'visitors',label:'Visitor Analytics',icon:'👥'},
    ]},
    { label:'ADMIN', items:[
      {key:'users',label:'Users & Permissions',icon:'👤'},{key:'billing',label:'Billing',icon:'💳'},
      {key:'api',label:'API Access',icon:'🔑'},
    ]},
  ];
  const VALID_TABS = new Set(['overview','map','lifts','trails','report','analytics','settings']);

  // Lift/trail placeholders when no data
  const displayLifts = lifts.length > 0 ? lifts : [
    {id:'1',liftName:'Crystal Lift',liftType:'chairlift',status:'open' as const,capacityPerHour:2400},
    {id:'2',liftName:'Meadow Lift', liftType:'chairlift',status:'open' as const,capacityPerHour:1800},
    {id:'3',liftName:'Ridge Chair', liftType:'chairlift',status:'on_hold' as const},
  ];
  const displayTrails = trails.length > 0 ? trails : [
    {id:'1',trailName:'North Face',difficulty:'black' as const,status:'open' as const},
    {id:'2',trailName:'Meadow Run',difficulty:'green' as const,status:'groomed' as const},
    {id:'3',trailName:'Pine Drop',  difficulty:'blue'  as const,status:'closed' as const},
  ];

  return (
    <>
      <style>{CSS}</style>

      {/* TOPNAV */}
      <nav className="tnav">
        <Link href="/dashboard" className="tnav-logo">
          <img src="/brand/powderiq_logo.png" alt="PowderIQ" />
        </Link>
        <div className="tnav-tabs">
          {NAV_TABS.map(t => (
            <button key={t.key} className={`tnav-tab${tab===t.key?' act':''}`} onClick={()=>setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="tnav-right">
          <div className="api-badge"><div className="api-dot"/>API Connected</div>
          <div className="tnav-icn">🔔</div>
          <div className="tnav-av">{avatarLetter}</div>
          <button className="tnav-out" onClick={signOut}>Sign out</button>
        </div>
      </nav>

      <div className="body-shell">

        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sb-resort">
            <div className="sb-resort-ico">🏔️</div>
            <div>
              <div className="sb-resort-name">{resortName}</div>
              <div className="sb-resort-loc">{resortState}</div>
            </div>
          </div>
          {SIDEBAR_SECS.map(sec => (
            <div className="sb-sec" key={sec.label}>
              <div className="sb-sec-lbl">{sec.label}</div>
              {sec.items.map(item => (
                <button key={item.key}
                  className={`sb-item${(tab===item.key||
                    (item.key==='overview'&&tab==='overview')||
                    (item.key==='lifts'&&tab==='lifts')||
                    (item.key==='trails'&&tab==='trails')||
                    (item.key==='report'&&tab==='report')||
                    (item.key==='analytics'&&tab==='analytics'))?
                    ' act':''}`}
                  onClick={()=>{ if(VALID_TABS.has(item.key)) setTab(item.key as Tab); }}
                >
                  <span className="sb-item-ico">{item.icon}</span>{item.label}
                </button>
              ))}
            </div>
          ))}
          <div className="sb-footer">
            <div className="plan-badge">
              <div className="plan-dot"/>
              {resort?.plan==='free_trial'?'14-Day Free Trial':`${resort?.plan||'Starter'} Plan`}
            </div>
            <Link href="/account" className="upgrade-btn">🚀 Resort Pro Plan</Link>
          </div>
        </aside>

        {/* MAIN */}
        <div className="main-area">
          {/* Page header */}
          <div className="pg-hd">
            <div className="pg-hd-top">
              <h1 className="pg-title"><strong>{resortName} Resort</strong> <span>Dashboard</span></h1>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div className="status-pill"><div style={{width:7,height:7,background:'#22c55e',borderRadius:'50%'}}/>Active Resort</div>
                <button className="tnav-icn">🔔</button>
                <button className="tnav-icn">☰</button>
              </div>
            </div>
            <div className="pg-tabs">
              {SUB_TABS.map(t=>(
                <button key={t.key} className={`pg-tab${tab===t.key?' act':''}`} onClick={()=>setTab(t.key)}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="content">

            {/* ── OVERVIEW ── */}
            {tab==='overview' && (
              <div className="ov-grid">
                <div className="ov-left">

                  {/* Summit Conditions */}
                  <div className="card">
                    <div className="cond-hd">
                      <div className="cond-hd-title">☀️ Summit Conditions <span style={{fontSize:11,color:'var(--text3)',fontWeight:400}}>ⓘ</span></div>
                      <div className="active-tag"><div style={{width:6,height:6,background:'#22c55e',borderRadius:'50%'}}/>ACTIVE</div>
                    </div>
                    <div className="zone-cards">
                      {(['summit','mid','base'] as const).map(z=>{
                        const d=weather?.zones?.[z];
                        const lbl={summit:'Summit',mid:'Mid Mountain',base:'Base'}[z];
                        return (
                          <div className="zone-card" key={z}>
                            <div className="zone-name">{lbl} <span style={{fontSize:20}}>{condIcon(d?.conditionDesc)}</span></div>
                            <div className="zone-temp">{d?`${Math.round(d.tempF)}°F`:'--°F'}</div>
                            <div className="zone-cond">{d?.conditionDesc||'—'}</div>
                            <div className="zone-wind">{d?`-${Math.round(d.windMph)} mph`:'—'}</div>
                            <div className="zone-stats">
                              <div className="zone-stat">
                                <div className="zone-stat-val">{d?`${d.snowfall24hIn.toFixed(1)}"`:'--'}</div>
                                <div className="zone-stat-lbl">{z==='summit'?'View':z==='mid'?'Snow':'Base'}</div>
                              </div>
                              <div className="zone-stat">
                                <div className="zone-stat-val">{d?`${Math.round(d.snowDepthIn)}"`:'--'}</div>
                                <div className="zone-stat-lbl">{z==='summit'?'11.00 Tt':'39 mpn'}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Ops stats */}
                  <div className="ops-row">
                    {[
                      {label:'Lifts Open',    val:openLifts,    total:totalLifts||4,  color:'#22c55e'},
                      {label:'Trails Open',   val:openTrails,   total:totalTrails||9, color:'#3b82f6'},
                      {label:'Groomed Trails',val:groomedCount, total:null,           color:'#8b5cf6'},
                    ].map(s=>(
                      <div className="ops-card" key={s.label}>
                        <div className="ops-val" style={{color:s.color}}>
                          {s.val}{s.total!==null&&<span className="ops-denom"> / {s.total}</span>}
                        </div>
                        <div className="ops-lbl">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Trail map */}
                  {resort&&token&&(
                    <div className="card">
                      <div className="map-controls">
                        {['Trail','Open','Groomed','Custom Map'].map((c,i)=>(
                          <div key={c} className={`map-chip${i<3?' act':''}`}>{c}</div>
                        ))}
                        <div style={{marginLeft:'auto',display:'flex',gap:6}}>
                          <div className="map-icn">↑</div><div className="map-icn">↺</div><div className="map-icn">⊙</div>
                        </div>
                      </div>
                      <TrailMap resortId={resort.id} token={token} height="380px" showWeather={false} readOnly={false}/>
                      <div style={{padding:'8px 14px',fontSize:11,color:'var(--text3)',borderTop:'1px solid var(--bd)'}}>
                        Trail map © OpenStreetMap contributors · Lifts &amp; trails sourced from PowderIQ
                      </div>
                    </div>
                  )}
                </div>

                <div className="ov-right">
                  {/* Features */}
                  <div className="card">
                    <div style={{padding:'14px 16px 10px',fontSize:13,fontWeight:600,color:'var(--text)'}}>Features Enabled</div>
                    {[
                      {name:'Lift Management',  cls:'on', ico:'✓'},
                      {name:'Trail Management', cls:'on', ico:'✓'},
                      {name:'AI Snow Reports',  cls:'on', ico:'✓'},
                      {name:'Weather Data Sync',cls:'sy', ico:'⇅'},
                      {name:'Trail Map Editor', cls:'dl', ico:'↓'},
                    ].map(f=>(
                      <div className="feat-row" key={f.name}>
                        <span className="feat-name">{f.name}</span>
                        <button className={`feat-tog ${f.cls}`}>{f.ico}</button>
                      </div>
                    ))}
                    <button className="manage-btn">Manage Features</button>
                  </div>

                  {/* Trail Map summary */}
                  <div className="card">
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px 10px'}}>
                      <span style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>Trail Map</span>
                      <span style={{fontSize:11,color:'var(--blue)',fontWeight:600,cursor:'pointer'}}>⊙ Stats Map</span>
                    </div>
                    {[
                      {color:'#22c55e',label:'3 Avalanched', score:24},
                      {color:'#3b82f6',label:'4 Base',       score:30},
                      {color:'#22c55e',label:'1 New snow',   score:44},
                      {color:'#3b82f6',label:'3 Base',       score:23},
                    ].map((row,i)=>(
                      <div className="tm-row" key={i}>
                        <div className="tm-dot" style={{background:row.color}}/>
                        <span className="tm-name">{row.label}</span>
                        <span className="tm-sc">{row.score}</span>
                      </div>
                    ))}
                  </div>

                  {/* Lift Status */}
                  <div className="card">
                    <div style={{padding:'14px 16px 10px',fontSize:13,fontWeight:600,color:'var(--text)'}}>Lift Status</div>
                    {displayLifts.slice(0,4).map(lift=>{
                      const s=SC[lift.status]||SC.closed;
                      return (
                        <div className="ls-row" key={lift.id}>
                          <div className="ls-dot" style={{background:s.dot}}/>
                          <span className="ls-name">{lift.liftName}</span>
                          <span className="ls-cnt">{lift.status==='open'&&lift.capacityPerHour?`${lift.capacityPerHour.toLocaleString()}/hr`:`${openLifts||4}/${totalLifts||4}`}</span>
                          <span className="ls-chv">›</span>
                        </div>
                      );
                    })}
                    {/* Trails row */}
                    <div className="ls-row">
                      <div className="ls-dot" style={{background:'#22c55e'}}/>
                      <span className="ls-name">Trails</span>
                      <span className="ls-cnt">{openTrails||9}/{totalTrails||9}</span>
                      <span className="ls-chv">›</span>
                    </div>
                    <button className="manage-btn">⚙ Manage Features</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── TRAIL MAP TAB ── */}
            {tab==='map'&&resort&&token&&(
              <div style={{display:'grid',gridTemplateColumns:'1fr 272px',gap:16}}>
                <div className="card">
                  <div className="map-controls">
                    {['Trail','Open','Groomed','Custom Map'].map((c,i)=>(
                      <div key={c} className={`map-chip${i<3?' act':''}`}>{c}</div>
                    ))}
                    <div style={{marginLeft:'auto',display:'flex',gap:6}}>
                      <div className="map-icn">↑</div><div className="map-icn">↺</div><div className="map-icn">⊙</div>
                    </div>
                  </div>
                  <TrailMap resortId={resort.id} token={token} height="calc(100vh - 280px)" showWeather={false} readOnly={false}/>
                  <div style={{padding:'8px 14px',fontSize:11,color:'var(--text3)',borderTop:'1px solid var(--bd)'}}>
                    Trail map © OpenStreetMap contributors · Trails data sourced from PowderIQ
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:16}}>
                  <div className="card">
                    <div style={{padding:'14px 16px 10px',fontSize:13,fontWeight:600,color:'var(--text)'}}>🚡 Lift Status</div>
                    {displayLifts.map((lift:any)=>{
                      const s=SC[lift.status]||SC.closed;
                      return (
                        <div className="ls-row" key={lift.liftName||lift.id}>
                          <div className="ls-dot" style={{background:s.dot}}/>
                          <span className="ls-name">{lift.liftName}</span>
                          <span className="ls-cnt">{lift.capacityPerHour?`${lift.capacityPerHour.toLocaleString()}/hr`:lift.status}</span>
                          <span className="ls-chv">⌄</span>
                        </div>
                      );
                    })}
                    <div style={{display:'flex',gap:8,padding:'10px 14px',borderTop:'1px solid var(--bd)'}}>
                      <button className="add-btn">+ Add Lift</button>
                      <button className="sec-btn">Import Liftie Data</button>
                    </div>
                  </div>
                  <div className="card">
                    <div style={{padding:'14px 16px 10px',fontSize:13,fontWeight:600,color:'var(--text)'}}>⛷️ Trail Status</div>
                    {displayTrails.slice(0,5).map((trail:any)=>{
                      const diff=DIFF_DOT[trail.difficulty]||DIFF_DOT.blue;
                      const s=SC[trail.status]||SC.closed;
                      return (
                        <div className="ls-row" key={trail.trailName||trail.id}>
                          <div className="ls-dot" style={{background:diff.color}}/>
                          <span className="ls-name">{trail.trailName}</span>
                          <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:10,background:s.bg,color:s.text}}>
                            {trail.status.replace('_',' ')}
                          </span>
                          <span className="ls-chv">⌄</span>
                        </div>
                      );
                    })}
                    <div style={{display:'flex',gap:8,padding:'10px 14px',borderTop:'1px solid var(--bd)'}}>
                      <button className="add-btn">+ Add Trail</button>
                      <button className="sec-btn">Bulk Import Trails</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── LIFTS ── */}
            {tab==='lifts'&&(
              <div className="card">
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',borderBottom:'1px solid var(--bd)'}}>
                  <span style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>Lift Management</span>
                  <div style={{display:'flex',gap:8}}>
                    <button className="add-btn">+ Add Lift</button>
                    <button className="sec-btn">Import Liftie Data</button>
                  </div>
                </div>
                <div className="sum-chips" style={{padding:'12px 16px 0'}}>
                  {([{label:'Open',key:'open',color:'#15803d'},{label:'On Hold',key:'on_hold',color:'#92400e'},{label:'Scheduled',key:'scheduled',color:'#1d40af'},{label:'Closed',key:'closed',color:'#991b1b'}]).map(s=>(
                    <div className="sum-chip" key={s.key}>
                      <span style={{color:s.color,fontWeight:800}}>{liftSummary?.[s.key]??0}</span>
                      <span style={{color:'var(--text3)',marginLeft:4}}>{s.label}</span>
                    </div>
                  ))}
                </div>
                {displayLifts.length===0?(
                  <div style={{padding:'48px',textAlign:'center',color:'var(--text3)',fontSize:13}}>
                    <div style={{fontSize:32,marginBottom:8}}>🚡</div>No lifts seeded yet.
                  </div>
                ):(
                  <table className="tbl">
                    <thead><tr><th>Lift Name</th><th>Type</th><th>Status</th><th>Capacity</th><th>Wait</th><th>Change</th></tr></thead>
                    <tbody>
                      {displayLifts.map(lift=>{
                        const s=SC[lift.status]||SC.closed;
                        return (
                          <tr key={lift.id}>
                            <td style={{fontWeight:600,color:'var(--text)'}}>{lift.liftName}</td>
                            <td style={{textTransform:'capitalize'}}>{lift.liftType}</td>
                            <td><span className="s-pill" style={{background:s.bg,color:s.text}}><span className="s-dot" style={{background:s.dot}}/>{lift.status.replace('_',' ')}</span></td>
                            <td>{lift.capacityPerHour?`${lift.capacityPerHour.toLocaleString()}/hr`:'—'}</td>
                            <td>{lift.waitMinutes!=null&&lift.status==='open'?`${lift.waitMinutes} min`:'—'}</td>
                            <td>
                              <select className="sts-sel" value={lift.status} onChange={e=>patchLift(lift.liftName,e.target.value)}>
                                <option value="open">Open</option>
                                <option value="on_hold">On Hold</option>
                                <option value="scheduled">Scheduled</option>
                                <option value="closed">Closed</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── TRAILS ── */}
            {tab==='trails'&&(
              <div className="card">
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',borderBottom:'1px solid var(--bd)'}}>
                  <span style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>Trail Management</span>
                  <div style={{display:'flex',gap:8}}>
                    <button className="add-btn">+ Add Trail</button>
                    <button className="sec-btn">Bulk Import Trails</button>
                  </div>
                </div>
                <div className="sum-chips" style={{padding:'12px 16px 0'}}>
                  {([{label:'Open',key:'open',color:'#15803d'},{label:'Groomed',key:'groomed',color:'#0891b2'},{label:'Patrol Only',key:'patrol_only',color:'#c2410c'},{label:'Closed',key:'closed',color:'#991b1b'}]).map(s=>(
                    <div className="sum-chip" key={s.key}>
                      <span style={{color:s.color,fontWeight:800}}>{trailSummary?.[s.key]??0}</span>
                      <span style={{color:'var(--text3)',marginLeft:4}}>{s.label}</span>
                    </div>
                  ))}
                </div>
                {displayTrails.length===0?(
                  <div style={{padding:'48px',textAlign:'center',color:'var(--text3)',fontSize:13}}>
                    <div style={{fontSize:32,marginBottom:8}}>⛷️</div>No trails added yet.
                  </div>
                ):(
                  <table className="tbl">
                    <thead><tr><th>Trail</th><th>Difficulty</th><th>Zone</th><th>Status</th><th>Depth</th><th>Change</th></tr></thead>
                    <tbody>
                      {displayTrails.map(trail=>{
                        const diff=DIFF_DOT[trail.difficulty]||DIFF_DOT.blue;
                        const s=SC[trail.status as keyof typeof SC]||SC.closed;
                        return (
                          <tr key={trail.id}>
                            <td>
                              <div style={{display:'flex',alignItems:'center',gap:7}}>
                                <span style={{width:10,height:10,borderRadius:2,background:diff.color,display:'inline-block',flexShrink:0}}/>
                                <span style={{fontWeight:600,color:'var(--text)'}}>{trail.trailName}</span>
                              </div>
                            </td>
                            <td style={{textTransform:'capitalize'}}>{trail.difficulty.replace('_',' ')}</td>
                            <td>{trail.zone||'—'}</td>
                            <td><span className="s-pill" style={{background:s.bg,color:s.text}}><span className="s-dot" style={{background:s.dot}}/>{trail.status.replace('_',' ')}</span></td>
                            <td>{trail.snowDepthIn!=null?`${trail.snowDepthIn}"`:'—'}</td>
                            <td>
                              <select className="sts-sel" value={trail.status} onChange={e=>patchTrail(trail.trailName,e.target.value)}>
                                <option value="open">Open</option>
                                <option value="groomed">Groomed</option>
                                <option value="patrol_only">Patrol Only</option>
                                <option value="closed">Closed</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── SNOW REPORT ── */}
            {tab==='report'&&(
              <div style={{maxWidth:680,display:'flex',flexDirection:'column',gap:16}}>
                <div className="card" style={{padding:20}}>
                  <div style={{fontSize:15,fontWeight:700,color:'var(--text)',marginBottom:4}}>Morning Snow Report</div>
                  <div style={{fontSize:13,color:'var(--text3)',marginBottom:14}}>AI-written from live conditions, or write manually.</div>
                  <textarea className="rep-ed" value={narrative} onChange={e=>setNarrative(e.target.value)}
                    placeholder="Generate an AI draft from live weather conditions or write manually." rows={6}/>
                  <div className="rep-btn-row">
                    <button className="rbtn-p" onClick={()=>generateReport(false)} disabled={generating}>
                      {generating?'⏳ Generating…':'✦ Generate AI Draft'}
                    </button>
                    <button className="rbtn-g" onClick={()=>generateReport(true)} disabled={generating||!narrative}>✓ Publish Report</button>
                    <button className="rbtn-s" onClick={()=>navigator.clipboard.writeText(narrative)} disabled={!narrative}>Copy</button>
                  </div>
                  {resort?.plan==='starter'&&(
                    <p style={{fontSize:12,color:'#d97706',marginTop:10}}>
                      AI generation requires Pro. <Link href="/account" style={{textDecoration:'underline',color:'#d97706'}}>Upgrade</Link>
                    </p>
                  )}
                </div>
                {reports.length>0&&(
                  <div className="card" style={{padding:20}}>
                    <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:14}}>Report History</div>
                    {reports.map(r=>(
                      <div key={r.id} style={{borderBottom:'1px solid var(--bd)',paddingBottom:14,marginBottom:14}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                          <span style={{fontSize:13,fontWeight:600,color:'var(--text2)'}}>{new Date(r.reportDate).toLocaleDateString()}</span>
                          <div style={{display:'flex',gap:12,fontSize:12,color:'var(--text3)'}}>
                            <span>{r.openLifts}/{r.totalLifts} lifts</span>
                            <span style={{color:'#3b82f6'}}>{r.snowfall24hIn?.toFixed(1)}" new</span>
                            {r.publishedAt&&<span style={{color:'#16a34a'}}>Published</span>}
                          </div>
                        </div>
                        {r.narrative&&<p style={{fontSize:13,color:'var(--text3)',lineHeight:1.55}}>{r.narrative}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── ANALYTICS / SETTINGS ── */}
            {(tab==='analytics'||tab==='settings')&&(
              <div className="card" style={{padding:40,textAlign:'center',color:'var(--text3)'}}>
                <div style={{fontSize:32,marginBottom:12}}>{tab==='analytics'?'📈':'⚙️'}</div>
                <div style={{fontSize:15,fontWeight:600,color:'var(--text2)',marginBottom:6}}>
                  {tab==='analytics'?'Analytics':'Settings'}
                </div>
                <div style={{fontSize:13}}>Coming soon</div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
