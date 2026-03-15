'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

/* ─── Types ─── */
interface Mountain {
  id: string; name: string; state: string; country: string;
  baseElevFt: number; topElevFt: number;
  totalTrails: number; totalLifts: number;
  latitude?: number; longitude?: number;
  imageUrl?: string; websiteUrl?: string;
}
interface ScoreData {
  score: number;
  breakdown: Record<string, number>;
  explanation: string;
}
interface ForecastDay {
  date: string; label: string; icon: string;
  desc: string; snowIn: number; precipPct: number;
  tempMax: number; tempMin: number;
}
interface Favorite { id: string; mountain: { id: string }; score?: number }

/* ─── Helpers ─── */
const FALLBACK_IMG = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80';

function getScoreLabel(score: number) {
  if (score >= 85) return { label: 'Excellent', color: '#16a34a', bg: '#dcfce7' };
  if (score >= 70) return { label: 'Great',     color: '#2563eb', bg: '#dbeafe' };
  if (score >= 55) return { label: 'Good',      color: '#0891b2', bg: '#cffafe' };
  if (score >= 40) return { label: 'Fair',      color: '#d97706', bg: '#fef3c7' };
  return                  { label: 'Poor',      color: '#dc2626', bg: '#fee2e2' };
}

function getBarColor(key: string, val: number) {
  if (key === 'wind' || key === 'Wind') return '#10b981';
  if (key.toLowerCase().includes('temp')) return val < 50 ? '#ef4444' : '#3b82f6';
  if (val >= 70) return '#3b82f6';
  if (val >= 40) return '#10b981';
  return '#3b82f6';
}

function wmoIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code <= 3) return '☁️';
  if (code <= 49) return '🌫️';
  if (code <= 59) return '🌦️';
  if (code <= 69) return '🌧️';
  if (code <= 79) return '❄️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  return '⛈️';
}
function wmoDesc(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly cloudy';
  if (code <= 3) return 'Overcast';
  if (code <= 49) return 'Foggy';
  if (code <= 59) return 'Drizzle';
  if (code <= 69) return 'Rain';
  if (code <= 71) return 'Light snow';
  if (code <= 75) return 'Snow';
  if (code <= 77) return 'Heavy snow';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snow showers';
  return 'Thunderstorm';
}

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

async function fetchForecast(lat: number, lon: number, elevFt: number): Promise<ForecastDay[]> {
  const elevM = Math.round(elevFt * 0.3048);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,snowfall_sum,precipitation_probability_max,weathercode&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=auto&forecast_days=7&elevation=${elevM}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.daily?.time || []).slice(1, 7).map((dateStr: string, i: number) => {
      const dt = new Date(dateStr + 'T12:00:00');
      const code = d.daily.weathercode[i + 1] ?? 0;
      return {
        date: dateStr,
        label: DAYS[dt.getDay()],
        icon: wmoIcon(code),
        desc: wmoDesc(code),
        snowIn: Math.round((d.daily.snowfall_sum[i + 1] ?? 0) * 10) / 10,
        precipPct: d.daily.precipitation_probability_max[i + 1] ?? 0,
        tempMax: Math.round(d.daily.temperature_2m_max[i + 1] ?? 32),
        tempMin: Math.round(d.daily.temperature_2m_min[i + 1] ?? 20),
      };
    });
  } catch { return []; }
}

/* ─── Nav shared styles (matching dashboard) ─── */
const NAV_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  :root {
    --blue:#1d6ef5; --blue-light:#e8f1fe; --blue-mid:#3b82f6;
    --text:#0d1b2e; --text-2:#3d5166; --text-3:#6b849a;
    --border:rgba(100,150,200,0.15); --border-2:rgba(100,150,200,0.25);
    --bg:#f0f5fb; --white:#ffffff;
    --shadow:0 2px 12px rgba(15,40,80,0.08); --shadow-lg:0 8px 32px rgba(15,40,80,0.14);
  }
  body { font-family:'Inter',sans-serif; background:var(--bg); color:var(--text); }

  /* ── Topnav ── */
  .topnav { position:sticky; top:0; z-index:50; height:60px; background:var(--white);
    border-bottom:1px solid var(--border-2); display:flex; align-items:center;
    padding:0 20px; gap:16px; box-shadow:var(--shadow); }
  .nav-logo { display:flex; align-items:center; gap:8px; text-decoration:none; flex-shrink:0; }
  .nav-logo img { height:32px; width:auto; }
  .nav-tabs { display:flex; align-items:center; gap:2px; flex:1; }
  .nav-tab { display:flex; align-items:center; gap:6px; padding:6px 14px; border-radius:8px;
    font-size:13px; font-weight:600; color:var(--text-3); text-decoration:none;
    transition:background .15s,color .15s; white-space:nowrap; }
  .nav-tab:hover { background:var(--bg); color:var(--text); }
  .nav-tab.active { background:var(--blue-light); color:var(--blue); }
  .nav-tab-icon { font-size:15px; }
  .nav-right { display:flex; align-items:center; gap:8px; margin-left:auto; flex-shrink:0; }
  .nav-icon-btn { width:34px; height:34px; border-radius:8px; border:1px solid var(--border-2);
    background:var(--white); display:flex; align-items:center; justify-content:center;
    cursor:pointer; font-size:16px; transition:background .15s; text-decoration:none; }
  .nav-icon-btn:hover { background:var(--bg); }
  .nav-avatar { width:34px; height:34px; border-radius:50%; background:var(--blue);
    color:#fff; font-size:13px; font-weight:700; display:flex; align-items:center; justify-content:center; }
  .nav-signout { padding:6px 14px; border-radius:8px; border:1px solid var(--border-2);
    background:var(--white); font-size:13px; font-weight:600; color:var(--text-2);
    cursor:pointer; transition:background .15s; font-family:'Inter',sans-serif; }
  .nav-signout:hover { background:var(--bg); }

  /* ── Layout ── */
  .page-shell { display:flex; height:calc(100vh - 60px); overflow:hidden; }
  .sidebar { width:196px; background:var(--white); border-right:1px solid var(--border-2);
    display:flex; flex-direction:column; overflow-y:auto; flex-shrink:0; padding:12px 8px; }
  .sidebar-label { font-size:10px; font-weight:700; color:var(--text-3);
    letter-spacing:0.06em; text-transform:uppercase; padding:8px 10px 6px; }
  .sidebar-resort-item { display:flex; align-items:center; gap:8px; padding:7px 8px;
    border-radius:9px; cursor:pointer; transition:background .15s; margin:1px 0;
    text-decoration:none; }
  .sidebar-resort-item:hover { background:var(--bg); }
  .sidebar-resort-item.active { background:var(--blue-light); }
  .sidebar-resort-thumb { width:24px; height:24px; border-radius:6px; object-fit:cover;
    background:var(--bg); flex-shrink:0; }
  .sidebar-resort-name { font-size:12px; font-weight:600; color:var(--text-2);
    flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .sidebar-resort-score { font-size:11px; font-weight:700; color:var(--blue); flex-shrink:0; }
  .main-scroll { flex:1; overflow-y:auto; }

  /* ── Hero image ── */
  .hero-wrap { position:relative; height:240px; overflow:hidden; }
  .hero-img { width:100%; height:100%; object-fit:cover; }
  .hero-overlay { position:absolute; inset:0;
    background:linear-gradient(to top, rgba(13,27,46,0.72) 0%, rgba(13,27,46,0.1) 60%, transparent 100%); }
  .hero-info { position:absolute; bottom:0; left:0; right:0; padding:20px 28px; }
  .hero-name { font-size:28px; font-weight:800; color:#fff; line-height:1.1; }
  .hero-loc  { font-size:14px; color:rgba(255,255,255,0.75); margin-top:3px; }
  .hero-badge { position:absolute; bottom:20px; right:28px;
    display:flex; align-items:center; gap:0; border-radius:10px; overflow:hidden;
    box-shadow:0 4px 16px rgba(0,0,0,0.3); }
  .hero-score-num { font-size:26px; font-weight:900; color:#fff;
    padding:10px 14px; min-width:56px; text-align:center; }
  .hero-score-label { font-size:13px; font-weight:700; color:#fff;
    padding:10px 16px; }

  /* ── Main grid ── */
  .detail-grid { display:grid; grid-template-columns:1fr 280px; gap:20px;
    padding:20px 24px; max-width:1200px; }
  .detail-left { display:flex; flex-direction:column; gap:16px; }
  .detail-right { display:flex; flex-direction:column; gap:16px; }

  /* ── Card base ── */
  .card { background:var(--white); border:1px solid var(--border-2);
    border-radius:14px; overflow:hidden; }
  .card-head { font-size:10px; font-weight:700; color:var(--text-3);
    letter-spacing:0.07em; text-transform:uppercase; padding:14px 18px 0;
    display:flex; align-items:center; gap:6px; }
  .card-head-icon { font-size:14px; }

  /* ── Conditions card ── */
  .conditions-card { padding:16px 18px; }
  .conditions-title { font-size:11px; font-weight:700; color:var(--text-3);
    text-transform:uppercase; letter-spacing:0.07em; margin-bottom:14px;
    display:flex; align-items:center; gap:6px; }
  .conditions-score-row { display:flex; align-items:center; gap:14px; margin-bottom:14px; }
  .cond-score-num { font-size:42px; font-weight:900; line-height:1; }
  .cond-score-badge { font-size:15px; font-weight:700; color:#fff;
    padding:6px 16px; border-radius:8px; }
  .cond-explanation { font-size:13px; color:var(--text-2); line-height:1.5; flex:1; }

  /* ── Breakdown ── */
  .breakdown-list { display:flex; flex-direction:column; gap:10px; margin-top:4px; }
  .breakdown-row { display:flex; align-items:center; gap:12px; }
  .breakdown-label { font-size:13px; font-weight:500; color:var(--text-2); width:130px; flex-shrink:0; }
  .breakdown-bar-wrap { flex:1; height:6px; background:rgba(100,150,200,0.12); border-radius:3px; overflow:hidden; }
  .breakdown-bar { height:100%; border-radius:3px; transition:width 0.6s cubic-bezier(0.22,1,0.36,1); }
  .breakdown-val { font-size:12px; font-weight:700; color:var(--text-3); width:52px; text-align:right; flex-shrink:0; }

  /* ── Forecast card ── */
  .forecast-row { display:flex; align-items:center; padding:10px 18px;
    border-bottom:1px solid var(--border); }
  .forecast-row:last-child { border-bottom:none; }
  .fc-day  { font-size:13px; font-weight:600; color:var(--text-2); width:38px; flex-shrink:0; }
  .fc-icon { font-size:18px; margin:0 8px; flex-shrink:0; width:24px; text-align:center; }
  .fc-desc { font-size:12px; color:var(--text-3); flex:1; }
  .fc-snow { font-size:15px; font-weight:800; color:var(--text); flex-shrink:0; }
  .fc-unit { font-size:10px; color:var(--text-3); margin-left:1px; }

  /* ── Quick links ── */
  .quick-link { display:flex; align-items:center; gap:10px; padding:11px 14px;
    border-bottom:1px solid var(--border); text-decoration:none;
    transition:background .15s; cursor:pointer; background:none; border-left:none;
    border-right:none; width:100%; font-family:'Inter',sans-serif; }
  .quick-link:first-of-type { border-top:none; }
  .quick-link:last-child { border-bottom:none; }
  .quick-link:hover { background:var(--bg); }
  .quick-link-icon { font-size:16px; flex-shrink:0; }
  .quick-link-text { font-size:13px; font-weight:600; color:var(--text-2); flex:1; text-align:left; }
  .quick-link-arrow { font-size:14px; color:var(--text-3); flex-shrink:0; }

  /* ── Snowfall chart ── */
  .snow-chart { padding:0 18px 16px; }
  .snow-bars { display:flex; align-items:flex-end; gap:6px; height:80px; margin-top:12px; }
  .snow-bar-wrap { display:flex; flex-direction:column; align-items:center; gap:4px; flex:1; }
  .snow-bar { width:100%; border-radius:4px 4px 0 0;
    background:linear-gradient(180deg,#7ec8f0,#3b82f6);
    transition:height 0.6s cubic-bezier(0.22,1,0.36,1); min-height:4px; }
  .snow-bar-label { font-size:9px; color:var(--text-3); font-weight:600; white-space:nowrap; }
  .snow-bar-val { font-size:9px; color:var(--text-2); font-weight:700; }

  /* ── Stats strip ── */
  .stats-strip { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
  .stat-card { background:var(--white); border:1px solid var(--border-2);
    border-radius:12px; padding:14px 12px; text-align:center; }
  .stat-val { font-size:20px; font-weight:800; color:var(--text); line-height:1; }
  .stat-label { font-size:11px; color:var(--text-3); margin-top:4px; font-weight:500; }

  /* ── Fav button ── */
  .fav-btn { padding:7px 14px; border-radius:8px; border:1px solid var(--border-2);
    background:var(--white); font-size:13px; font-weight:600; color:var(--text-2);
    cursor:pointer; transition:background .15s,border-color .15s; font-family:'Inter',sans-serif; }
  .fav-btn.active { background:#fef9c3; border-color:#d97706; color:#92400e; }
  .fav-btn:hover { background:var(--bg); }

  /* ── Responsive ── */
  @media(max-width:900px) {
    .sidebar { display:none; }
    .detail-grid { grid-template-columns:1fr; }
    .detail-right { order:-1; }
    .stats-strip { grid-template-columns:repeat(2,1fr); }
  }
  @media(max-width:600px) {
    .hero-name { font-size:20px; }
    .nav-tabs { display:none; }
  }
`;

/* ─── Component ─── */
export default function MountainDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [mountain,   setMountain]   = useState<Mountain | null>(null);
  const [scoreData,  setScoreData]  = useState<ScoreData | null>(null);
  const [forecast,   setForecast]   = useState<ForecastDay[]>([]);
  const [isFav,      setIsFav]      = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [favorites,  setFavorites]  = useState<Favorite[]>([]);
  const [userEmail,  setUserEmail]  = useState('');
  const [userRole,   setUserRole]   = useState('');
  const [loading,    setLoading]    = useState(true);
  const [token,      setToken]      = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const t = data.session?.access_token || '';
      setToken(t);
      setUserEmail(data.session?.user?.email || '');

      const [mRes, sRes, fRes, favsRes, meRes] = await Promise.all([
        fetch(`/api/mountains/${id}`),
        fetch(`/api/mountains/${id}/score`, t ? { headers: { Authorization: `Bearer ${t}` } } : {}),
        fetch(`/api/mountains/${id}/forecast`, t ? { headers: { Authorization: `Bearer ${t}` } } : {}),
        t ? fetch('/api/favorites', { headers: { Authorization: `Bearer ${t}` } }) : Promise.resolve(null),
        t ? fetch('/api/me', { headers: { Authorization: `Bearer ${t}` } }) : Promise.resolve(null),
      ]);

      let mtn: Mountain | null = null;
      if (mRes.ok) { mtn = (await mRes.json()).data; setMountain(mtn); }
      if (sRes.ok) setScoreData((await sRes.json()).data);
      if (favsRes?.ok) {
        const fd = await favsRes.json();
        const favList = fd.data || [];
        setFavorites(favList);
        setIsFav(favList.some((f: Favorite) => f.mountain.id === id));
      }
      if (meRes?.ok) {
        const me = await meRes.json();
        setUserRole(me.data?.role || '');
      }

      // Load forecast from Open-Meteo if we have coords
      if (fRes?.ok) {
        const fd2 = await fRes.json();
        const m2 = fd2.data?.mountain as Mountain | undefined;
        const lat = m2?.latitude  ?? mtn?.latitude;
        const lon = m2?.longitude ?? mtn?.longitude;
        const elev = m2?.topElevFt ?? mtn?.topElevFt ?? 8000;
        if (lat && lon) {
          const fc = await fetchForecast(lat, lon, elev);
          setForecast(fc);
        }
      }

      setLoading(false);
    })();
  }, [id]);

  async function toggleFavorite() {
    if (!token || favLoading) return;
    setFavLoading(true);
    await fetch('/api/favorites', {
      method: isFav ? 'DELETE' : 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mountainId: id }),
    });
    setIsFav(v => !v);
    setFavLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  }

  const getMountainImage = (m: Mountain) =>
    m.imageUrl || FALLBACK_IMG;

  /* ── Loading ── */
  if (loading) return (
    <>
      <style>{NAV_STYLES}</style>
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
        <div style={{ width:32, height:32, border:'3px solid var(--blue-light)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} role="status" aria-label="Loading" />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </>
  );

  if (!mountain) return (
    <>
      <style>{NAV_STYLES}</style>
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'var(--bg)', color:'var(--text-3)', fontSize:14 }}>
        Mountain not found. <Link href="/mountains" style={{ color:'var(--blue)' }}>Browse mountains →</Link>
      </div>
    </>
  );

  const scoreInfo = scoreData ? getScoreLabel(scoreData.score) : null;
  const avatarLetter = userEmail?.[0]?.toUpperCase() || 'U';
  const maxSnow = Math.max(...forecast.map(f => f.snowIn), 1);

  const breakdownEntries = scoreData
    ? Object.entries(scoreData.breakdown).map(([k, v]) => ({
        label: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
        value: v,
      }))
    : [];

  return (
    <>
      <style>{NAV_STYLES}</style>

      {/* ── TOPNAV ── */}
      <nav className="topnav" role="navigation" aria-label="Main navigation">
        <Link href="/dashboard" className="nav-logo" aria-label="PowderIQ home">
          <img src="/brand/powderiq_logo.png" alt="PowderIQ" style={{ height:32 }} />
        </Link>

        <div className="nav-tabs" role="tablist">
          <Link href="/dashboard"   className="nav-tab"><span className="nav-tab-icon">📊</span>Dashboard</Link>
          <Link href="/mountains"   className="nav-tab active" aria-current="page"><span className="nav-tab-icon">🏔️</span>Resorts</Link>
          <Link href="/forecasts"   className="nav-tab"><span className="nav-tab-icon">📅</span>Forecasts</Link>
          {(userRole==='pro_user'||userRole==='admin') && (
            <Link href="/compare"   className="nav-tab"><span className="nav-tab-icon">📈</span>Analytics</Link>
          )}
          {(userRole==='pro_user'||userRole==='admin') && (
            <Link href="/alerts"    className="nav-tab"><span className="nav-tab-icon">🔔</span>Alerts</Link>
          )}
          {userRole==='resort_admin' && (
            <Link href="/resort/dashboard" className="nav-tab"><span className="nav-tab-icon">🎿</span>Resort</Link>
          )}
        </div>

        <div className="nav-right">
          <Link href="/account" className="nav-icon-btn" aria-label="Settings">⚙️</Link>
          <Link href="/account" className="nav-icon-btn" aria-label="Notifications">🔔</Link>
          <div className="nav-avatar" aria-hidden="true">{avatarLetter}</div>
          <button className="nav-signout" onClick={handleSignOut}>Sign out</button>
        </div>
      </nav>

      {/* ── PAGE SHELL ── */}
      <div className="page-shell">

        {/* ── SIDEBAR ── */}
        <aside className="sidebar" aria-label="Saved resorts">
          {favorites.length > 0 && (
            <>
              <div className="sidebar-label">Saved Resorts</div>
              {favorites.map(f => (
                <Link
                  key={f.id}
                  href={`/mountains/${f.mountain.id}`}
                  className={`sidebar-resort-item${f.mountain.id === id ? ' active' : ''}`}
                >
                  <div className="sidebar-resort-thumb" style={{
                    background: 'linear-gradient(135deg,#dbeafe,#bfdbfe)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:12
                  }}>🏔</div>
                  <span className="sidebar-resort-name">{(f as any).mountain?.name || 'Resort'}</span>
                  {f.score != null && <span className="sidebar-resort-score">{f.score}</span>}
                </Link>
              ))}
            </>
          )}
        </aside>

        {/* ── MAIN SCROLL ── */}
        <div className="main-scroll">

          {/* Hero */}
          <div className="hero-wrap">
            <img
              src={getMountainImage(mountain)}
              alt={mountain.name}
              className="hero-img"
              onError={e => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }}
            />
            <div className="hero-overlay" />
            <div className="hero-info">
              <h1 className="hero-name">{mountain.name}</h1>
              <p className="hero-loc">{mountain.state}, {mountain.country}</p>
            </div>
            {scoreInfo && scoreData && (
              <div className="hero-badge">
                <div className="hero-score-num" style={{ background: scoreInfo.color }}>
                  {scoreData.score}
                </div>
                <div className="hero-score-label" style={{ background: scoreInfo.color }}>
                  {scoreInfo.label}
                </div>
              </div>
            )}
          </div>

          {/* Content grid */}
          <div className="detail-grid">

            {/* ── LEFT ── */}
            <div className="detail-left">

              {/* Stats strip */}
              <div className="stats-strip">
                {[
                  { label:'Base Elev.', val:`${mountain.baseElevFt.toLocaleString()} ft` },
                  { label:'Summit',     val:`${mountain.topElevFt.toLocaleString()} ft` },
                  { label:'Trails',     val: mountain.totalTrails },
                  { label:'Lifts',      val: mountain.totalLifts },
                ].map(s => (
                  <div className="stat-card" key={s.label}>
                    <div className="stat-val">{s.val}</div>
                    <div className="stat-label">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Conditions + Score */}
              {scoreData && scoreInfo && (
                <div className="card">
                  <div className="conditions-card">
                    <div className="conditions-title">
                      <span>⛷️</span>
                      CURRENT CONDITIONS — {mountain.name}
                    </div>

                    <div className="conditions-score-row">
                      <div className="cond-score-num" style={{ color: scoreInfo.color }}>
                        {scoreData.score}
                      </div>
                      <div className="cond-score-badge" style={{ background: scoreInfo.color }}>
                        {scoreInfo.label}
                      </div>
                      <div className="cond-explanation">
                        {scoreData.explanation}
                      </div>
                    </div>

                    {/* Breakdown */}
                    <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--text-2)', marginBottom:12 }}>
                        Today&apos;s Powder Score
                      </div>
                      <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:14 }}>
                        {scoreData.explanation}
                      </div>
                      <div className="breakdown-list">
                        {breakdownEntries.map(({ label, value }) => (
                          <div className="breakdown-row" key={label}>
                            <div className="breakdown-label">{label}</div>
                            <div className="breakdown-bar-wrap">
                              <div
                                className="breakdown-bar"
                                style={{
                                  width: `${value}%`,
                                  background: getBarColor(label, value),
                                }}
                              />
                            </div>
                            <div className="breakdown-val">{value}/100</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Fav + website row */}
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:18, paddingTop:14, borderTop:'1px solid var(--border)' }}>
                      {token && (
                        <button
                          className={`fav-btn${isFav ? ' active' : ''}`}
                          onClick={toggleFavorite}
                          disabled={favLoading}
                          aria-pressed={isFav}
                        >
                          {isFav ? '⭐ Saved' : '☆ Save Resort'}
                        </button>
                      )}
                      {mountain.websiteUrl && (
                        <a
                          href={mountain.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize:13, color:'var(--blue)', fontWeight:600, textDecoration:'none' }}
                        >
                          Visit Website ↗
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT ── */}
            <div className="detail-right">

              {/* 6-Day Forecast */}
              <div className="card">
                <div className="card-head">
                  <span className="card-head-icon">🌨️</span>
                  6-DAY SNOW FORECAST
                </div>
                <div style={{ marginTop:8 }}>
                  {forecast.length > 0 ? forecast.map(day => (
                    <div className="forecast-row" key={day.date}>
                      <div className="fc-day">{day.label}</div>
                      <div className="fc-icon">{day.icon}</div>
                      <div className="fc-desc">{day.desc}</div>
                      <div className="fc-snow">
                        {day.snowIn}
                        <span className="fc-unit"> in</span>
                      </div>
                    </div>
                  )) : (
                    <div style={{ padding:'16px 18px', fontSize:13, color:'var(--text-3)' }}>
                      Forecast unavailable
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Links */}
              <div className="card">
                <div className="card-head">
                  <span className="card-head-icon">🔗</span>
                  QUICK LINKS
                </div>
                <div style={{ marginTop:8 }}>
                  {mountain.websiteUrl && (
                    <a href={mountain.websiteUrl} target="_blank" rel="noopener noreferrer" className="quick-link">
                      <span className="quick-link-icon">🌐</span>
                      <span className="quick-link-text">Visit Resort Website</span>
                      <span className="quick-link-arrow">›</span>
                    </a>
                  )}
                  <Link href={`/mountains/${id}/trails`} className="quick-link">
                    <span className="quick-link-icon">🗺️</span>
                    <span className="quick-link-text">View Trail Map</span>
                    <span className="quick-link-arrow">›</span>
                  </Link>
                  <Link href={`/resort/dashboard`} className="quick-link">
                    <span className="quick-link-icon">📊</span>
                    <span className="quick-link-text">Open Resort Dashboard</span>
                    <span className="quick-link-arrow">›</span>
                  </Link>
                </div>
              </div>

              {/* Snowfall chart */}
              {forecast.length > 0 && (
                <div className="card">
                  <div className="card-head">
                    <span className="card-head-icon">❄️</span>
                    SNOWFALL°
                  </div>
                  <div className="snow-chart">
                    <div className="snow-bars">
                      {forecast.map(day => {
                        const pct = maxSnow > 0 ? (day.snowIn / maxSnow) * 100 : 10;
                        return (
                          <div className="snow-bar-wrap" key={day.date}>
                            <div className="snow-bar-val">{day.snowIn}"</div>
                            <div className="snow-bar" style={{ height:`${Math.max(pct, 5)}%` }} />
                            <div className="snow-bar-label">{day.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
