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
  desc: string; snowIn: number;
}
interface Favorite {
  id: string;
  score?: number;
  mountain: { id: string; name: string; imageUrl?: string };
}

/* ─── Helpers ─── */
const FALLBACK = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80';
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function scoreStyle(s: number) {
  if (s >= 85) return { label:'Excellent', color:'#16a34a' };
  if (s >= 70) return { label:'Great',     color:'#2563eb' };
  if (s >= 55) return { label:'Good',      color:'#0891b2' };
  if (s >= 40) return { label:'Fair',      color:'#d97706' };
  return              { label:'Poor',      color:'#b91c1c' };
}

function barColor(key: string) {
  const k = key.toLowerCase();
  if (k.includes('wind'))  return '#10b981';
  if (k.includes('temp'))  return '#ef4444';
  if (k.includes('crowd')) return '#f59e0b';
  return '#3b82f6';
}

function wmoIcon(c: number) {
  if (c===0) return '☀️';
  if (c<=2)  return '🌤️';
  if (c<=3)  return '☁️';
  if (c<=49) return '🌫️';
  if (c<=69) return '🌦️';
  if (c<=77) return '🌨️';
  if (c<=82) return '🌧️';
  if (c<=86) return '❄️';
  return '⛈️';
}
function wmoDesc(c: number) {
  if (c===0) return 'Clear sky';
  if (c<=2)  return 'Partly cloudy';
  if (c<=3)  return 'Overcast';
  if (c<=49) return 'Foggy';
  if (c<=59) return 'Drizzle';
  if (c<=69) return 'Rain';
  if (c<=71) return 'Light snow';
  if (c<=75) return 'Snow';
  if (c<=77) return 'Heavy snow';
  if (c<=82) return 'Showers';
  if (c<=86) return 'Snow showers';
  return 'Thunderstorm';
}

async function loadForecast(lat: number, lon: number, elevFt: number): Promise<ForecastDay[]> {
  try {
    const elevM = Math.round(elevFt * 0.3048);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
      + `&daily=snowfall_sum,weathercode`
      + `&precipitation_unit=inch&timezone=auto&forecast_days=7&elevation=${elevM}`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.daily?.time || []).slice(1, 7).map((dt: string, i: number) => {
      const day = new Date(dt + 'T12:00:00');
      const code = d.daily.weathercode[i + 1] ?? 0;
      return {
        date: dt,
        label: DAYS[day.getDay()],
        icon: wmoIcon(code),
        desc: wmoDesc(code),
        snowIn: Math.round((d.daily.snowfall_sum[i + 1] ?? 0) * 10) / 10,
      };
    });
  } catch { return []; }
}

/* ─── Page ─── */
export default function MountainDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [mountain,  setMountain]  = useState<Mountain | null>(null);
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [forecast,  setForecast]  = useState<ForecastDay[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isFav,     setIsFav]     = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userRole,  setUserRole]  = useState('');
  const [token,     setToken]     = useState('');
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const t = sess.session?.access_token || '';
      setToken(t);
      setUserEmail(sess.session?.user?.email || '');
      const headers: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {};

      const [mRes, sRes, fRes, favsRes, meRes] = await Promise.all([
        fetch(`/api/mountains/${id}`),
        fetch(`/api/mountains/${id}/score`, { headers }),
        fetch(`/api/mountains/${id}/forecast`, { headers }),
        t ? fetch('/api/favorites', { headers }) : Promise.resolve(null),
        t ? fetch('/api/me', { headers }) : Promise.resolve(null),
      ]);

      let mtn: Mountain | null = null;
      if (mRes.ok) { mtn = (await mRes.json()).data; setMountain(mtn); }
      if (sRes.ok) setScoreData((await sRes.json()).data);

      if (favsRes?.ok) {
        const fd = await favsRes.json();
        const list: Favorite[] = fd.data || [];
        setFavorites(list);
        setIsFav(list.some(f => f.mountain.id === id));
      }
      if (meRes?.ok) {
        const me = await meRes.json();
        setUserRole(me.data?.role || '');
      }

      if (fRes?.ok) {
        const fd2 = await fRes.json();
        const m2 = fd2.data?.mountain as Mountain | undefined;
        const lat  = m2?.latitude  ?? mtn?.latitude;
        const lon  = m2?.longitude ?? mtn?.longitude;
        const elev = m2?.topElevFt ?? mtn?.topElevFt ?? 8000;
        if (lat && lon) setForecast(await loadForecast(lat, lon, elev));
      }

      setLoading(false);
    })();
  }, [id]);

  async function toggleFav() {
    if (!token) return;
    await fetch('/api/favorites', {
      method: isFav ? 'DELETE' : 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mountainId: id }),
    });
    setIsFav(v => !v);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  }

  const avatarLetter = userEmail?.[0]?.toUpperCase() || 'U';
  const si = scoreData ? scoreStyle(scoreData.score) : null;
  const maxSnow = Math.max(...forecast.map(f => f.snowIn), 1);
  const breakdownEntries = scoreData
    ? Object.entries(scoreData.breakdown).map(([k, v]) => ({
        label: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
        raw: k, value: v,
      }))
    : [];

  /* ─── Loading ─── */
  if (loading) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');
        body{margin:0;background:#f0f5fb;font-family:'Inter',sans-serif;}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{width:32,height:32,border:'3px solid #dbeafe',borderTopColor:'#1d6ef5',borderRadius:'50%',animation:'spin .7s linear infinite'}} />
      </div>
    </>
  );

  if (!mountain) return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');body{margin:0;background:#f0f5fb;font-family:'Inter',sans-serif;}`}</style>
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontSize:14,color:'#6b849a'}}>
        Mountain not found.&nbsp;<Link href="/mountains" style={{color:'#1d6ef5'}}>Browse mountains →</Link>
      </div>
    </>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        :root {
          --blue:#1d6ef5; --blue-light:#e8f1fe;
          --text:#0d1b2e; --text-2:#3d5166; --text-3:#6b849a;
          --border:rgba(100,150,200,0.15); --border-2:rgba(100,150,200,0.25);
          --bg:#f0f5fb; --white:#ffffff;
          --shadow:0 2px 12px rgba(15,40,80,0.08);
          --shadow-lg:0 8px 32px rgba(15,40,80,0.14);
        }
        html,body { height:100%; font-family:'Inter',sans-serif; background:var(--bg); color:var(--text); }

        /* TOPNAV */
        .tnav {
          position:sticky; top:0; z-index:100; height:60px;
          background:var(--white); border-bottom:1px solid var(--border-2);
          display:flex; align-items:center; padding:0 20px; gap:10px;
          box-shadow:var(--shadow);
        }
        .tnav-logo { display:flex; align-items:center; text-decoration:none; flex-shrink:0; }
        .tnav-logo img { height:34px; width:auto; }
        .tnav-tabs { display:flex; align-items:center; gap:2px; margin-left:8px; flex:1; overflow:hidden; }
        .tnav-tab {
          display:flex; align-items:center; gap:6px; padding:7px 14px;
          border-radius:9px; font-size:13px; font-weight:600; color:var(--text-3);
          text-decoration:none; white-space:nowrap; transition:background .15s,color .15s;
        }
        .tnav-tab:hover { background:var(--bg); color:var(--text); }
        .tnav-tab.act  { background:var(--blue-light); color:var(--blue); }
        .tnav-right { display:flex; align-items:center; gap:6px; margin-left:auto; flex-shrink:0; }
        .tnav-icon {
          width:34px; height:34px; border-radius:8px; border:1px solid var(--border-2);
          background:var(--white); display:flex; align-items:center; justify-content:center;
          font-size:15px; text-decoration:none; cursor:pointer; transition:background .15s;
        }
        .tnav-icon:hover { background:var(--bg); }
        .tnav-avatar {
          width:34px; height:34px; border-radius:50%; background:var(--blue);
          color:#fff; font-size:13px; font-weight:700;
          display:flex; align-items:center; justify-content:center;
        }
        .tnav-signout {
          padding:6px 14px; border-radius:8px; border:none; background:none;
          font-size:13px; font-weight:600; color:var(--text-2);
          cursor:pointer; font-family:'Inter',sans-serif; transition:color .15s;
        }
        .tnav-signout:hover { color:var(--text); }

        /* SHELL */
        .shell { display:flex; height:calc(100vh - 60px); overflow:hidden; }

        /* SIDEBAR */
        .sidebar {
          width:196px; flex-shrink:0; background:var(--white);
          border-right:1px solid var(--border-2); overflow-y:auto; padding:12px 8px;
        }
        .sb-label {
          font-size:10px; font-weight:700; color:var(--text-3);
          letter-spacing:.07em; text-transform:uppercase; padding:6px 10px 8px;
        }
        .sb-item {
          display:flex; align-items:center; gap:8px; padding:7px 8px;
          border-radius:9px; cursor:pointer; text-decoration:none;
          transition:background .15s; margin:1px 0;
        }
        .sb-item:hover { background:var(--bg); }
        .sb-item.act { background:var(--blue-light); }
        .sb-thumb {
          width:24px; height:24px; border-radius:6px; flex-shrink:0; overflow:hidden;
          background:linear-gradient(135deg,#dbeafe,#bfdbfe);
          display:flex; align-items:center; justify-content:center; font-size:11px;
        }
        .sb-thumb img { width:100%; height:100%; object-fit:cover; }
        .sb-name {
          font-size:12px; font-weight:600; color:var(--text-2); flex:1;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .sb-score { font-size:11px; font-weight:700; color:var(--blue); flex-shrink:0; }

        /* MAIN */
        .main-scroll { flex:1; overflow-y:auto; padding:24px 24px 40px; }

        /* Page header */
        .pg-title { font-size:30px; font-weight:800; color:var(--text); line-height:1.1; }
        .pg-loc   { font-size:14px; color:var(--text-3); margin-top:4px; margin-bottom:20px; }

        /* Content grid */
        .cgrid { display:grid; grid-template-columns:1fr 288px; gap:20px; align-items:start; }
        .cleft  { display:flex; flex-direction:column; gap:16px; min-width:0; }
        .cright { display:flex; flex-direction:column; gap:16px; }

        /* Hero photo */
        .hero {
          border-radius:16px; overflow:hidden; position:relative;
          height:208px; box-shadow:var(--shadow-lg); flex-shrink:0;
        }
        .hero img { width:100%; height:100%; object-fit:cover; display:block; }
        .hero-grad {
          position:absolute; inset:0;
          background:linear-gradient(to top,rgba(8,16,36,.78) 0%,rgba(8,16,36,.08) 55%,transparent 100%);
        }
        .hero-bl { position:absolute; bottom:18px; left:20px; }
        .hero-bl-name { font-size:22px; font-weight:800; color:#fff; line-height:1.1; }
        .hero-bl-loc  { font-size:13px; color:rgba(255,255,255,.72); margin-top:2px; }
        .hero-badge {
          position:absolute; bottom:18px; right:18px;
          display:flex; border-radius:10px; overflow:hidden;
          box-shadow:0 4px 20px rgba(0,0,0,.4);
        }
        .hb-num {
          font-size:26px; font-weight:900; color:#fff;
          padding:10px 14px; min-width:54px; text-align:center;
          display:flex; align-items:center; justify-content:center; line-height:1;
        }
        .hb-label {
          font-size:14px; font-weight:700; color:#fff;
          padding:10px 16px; display:flex; align-items:center;
        }

        /* Card */
        .card { background:var(--white); border:1px solid var(--border-2); border-radius:14px; overflow:hidden; }

        /* Conditions card top */
        .cond-top { padding:16px 18px 14px; border-bottom:1px solid var(--border); }
        .cond-lbl {
          font-size:11px; font-weight:700; color:var(--text-3);
          letter-spacing:.07em; text-transform:uppercase;
          margin-bottom:14px; display:flex; align-items:center; gap:6px;
        }
        .cond-row { display:flex; align-items:center; gap:12px; }
        .cond-num  { font-size:48px; font-weight:900; line-height:1; flex-shrink:0; }
        .cond-pill { font-size:15px; font-weight:700; color:#fff; padding:8px 18px; border-radius:9px; flex-shrink:0; }
        .cond-expl { font-size:13px; color:var(--text-2); line-height:1.55; flex:1; }

        /* Breakdown */
        .bdsec { padding:16px 18px; }
        .bd-title { font-size:15px; font-weight:700; color:var(--text); margin-bottom:6px; }
        .bd-sub   { font-size:12.5px; color:var(--text-3); margin-bottom:16px; line-height:1.45; }
        .bd-row   { display:flex; align-items:center; gap:12px; margin-bottom:11px; }
        .bd-row:last-of-type { margin-bottom:0; }
        .bd-lbl { font-size:13px; font-weight:500; color:var(--text-2); width:130px; flex-shrink:0; }
        .bd-bg  { flex:1; height:6px; background:rgba(100,150,200,.12); border-radius:3px; overflow:hidden; }
        .bd-bar { height:100%; border-radius:3px; }
        .bd-val { font-size:12px; font-weight:700; color:var(--text-3); width:50px; text-align:right; flex-shrink:0; }

        /* Forecast */
        .fc-hd {
          padding:14px 18px 10px; font-size:11px; font-weight:700; color:var(--text-3);
          letter-spacing:.07em; text-transform:uppercase; border-bottom:1px solid var(--border);
          display:flex; align-items:center; gap:6px;
        }
        .fc-row { display:flex; align-items:center; padding:10px 18px; border-bottom:1px solid var(--border); }
        .fc-row:last-child { border-bottom:none; }
        .fc-day  { font-size:14px; font-weight:700; color:var(--text-2); width:40px; flex-shrink:0; }
        .fc-icon { font-size:18px; width:28px; text-align:center; flex-shrink:0; }
        .fc-desc { font-size:13px; color:var(--text-3); flex:1; }
        .fc-snow { font-size:16px; font-weight:800; color:var(--text); flex-shrink:0; }
        .fc-unit { font-size:11px; color:var(--text-3); font-weight:500; margin-left:2px; }

        /* Quick links */
        .ql-hd {
          padding:14px 18px 10px; font-size:11px; font-weight:700; color:var(--text-3);
          letter-spacing:.07em; text-transform:uppercase; border-bottom:1px solid var(--border);
          display:flex; align-items:center; gap:6px;
        }
        .ql-row {
          display:flex; align-items:center; gap:10px; padding:12px 16px;
          border-bottom:1px solid var(--border); text-decoration:none; transition:background .15s; cursor:pointer;
        }
        .ql-row:last-child { border-bottom:none; }
        .ql-row:hover { background:var(--bg); }
        .ql-ico { width:28px; height:28px; border-radius:7px; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; }
        .ql-txt { font-size:13px; font-weight:600; color:var(--text-2); flex:1; }
        .ql-arr { font-size:17px; color:var(--text-3); flex-shrink:0; }

        /* Snow chart */
        .sc-hd {
          padding:14px 18px 0; font-size:11px; font-weight:700; color:var(--text-3);
          letter-spacing:.07em; text-transform:uppercase; display:flex; align-items:center; gap:6px;
        }
        .sc-body { display:flex; padding:8px 12px 14px; gap:4px; }
        .sc-yax  { display:flex; flex-direction:column; justify-content:space-between; align-items:flex-end; font-size:10px; color:var(--text-3); width:30px; flex-shrink:0; padding:0 4px 18px 0; }
        .sc-grid { flex:1; display:flex; flex-direction:column; }
        .sc-bars { flex:1; display:flex; align-items:flex-end; gap:5px; height:72px; border-left:1px solid var(--border); border-bottom:1px solid var(--border); padding:0 4px; position:relative; }
        .sc-bars::before { content:''; position:absolute; top:50%; left:0; right:0; border-top:1px dashed var(--border); }
        .sc-col  { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%; }
        .sc-bar  { width:100%; border-radius:3px 3px 0 0; background:linear-gradient(180deg,#93c5fd,#3b82f6); min-height:3px; }
        .sc-xlbl { display:flex; gap:5px; margin-top:4px; padding:0 4px; }
        .sc-xl   { flex:1; text-align:center; font-size:9px; color:var(--text-3); font-weight:600; }

        /* Fav button */
        .fav-btn {
          padding:7px 14px; border-radius:8px; border:1px solid var(--border-2);
          background:var(--white); font-size:13px; font-weight:600; color:var(--text-2);
          cursor:pointer; font-family:'Inter',sans-serif; transition:background .15s,border-color .15s;
        }
        .fav-btn.on { background:#fef3c7; border-color:#d97706; color:#92400e; }
        .fav-btn:hover { background:var(--bg); }

        @media(max-width:960px) {
          .sidebar { display:none; }
          .cgrid { grid-template-columns:1fr; }
        }
        @media(max-width:640px) {
          .tnav-tabs { display:none; }
          .main-scroll { padding:16px; }
          .pg-title { font-size:22px; }
        }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>

      {/* ── TOPNAV ── */}
      <nav className="tnav">
        <Link href="/dashboard" className="tnav-logo">
          <img src="/brand/powderiq_logo.png" alt="PowderIQ" />
        </Link>

        <div className="tnav-tabs">
          <Link href="/dashboard" className="tnav-tab">
            <span>📊</span>Dashboard
          </Link>
          <Link href="/mountains" className="tnav-tab act" aria-current="page">
            <span>🏔️</span>Resorts
          </Link>
          <Link href="/forecasts" className="tnav-tab">
            <span>📅</span>Forecasts
          </Link>
          {(userRole==='pro_user'||userRole==='admin') && (
            <Link href="/compare" className="tnav-tab"><span>📈</span>Analytics</Link>
          )}
          {(userRole==='pro_user'||userRole==='admin') && (
            <Link href="/alerts" className="tnav-tab"><span>🔔</span>Alerts</Link>
          )}
          {userRole==='resort_admin' && (
            <Link href="/resort/dashboard" className="tnav-tab"><span>🎿</span>Resort</Link>
          )}
        </div>

        <div className="tnav-right">
          <Link href="/account" className="tnav-icon" aria-label="Settings">⚙️</Link>
          <Link href="/account" className="tnav-icon" aria-label="Notifications">🔔</Link>
          <div className="tnav-avatar">{avatarLetter}</div>
          <button className="tnav-signout" onClick={signOut}>Sign out</button>
        </div>
      </nav>

      {/* ── SHELL ── */}
      <div className="shell">

        {/* ── SIDEBAR ── */}
        <aside className="sidebar">
          {favorites.length > 0 && (
            <>
              <div className="sb-label">Saved Resorts</div>
              {favorites.map(f => (
                <Link
                  key={f.id}
                  href={`/mountains/${f.mountain.id}`}
                  className={`sb-item${f.mountain.id === id ? ' act' : ''}`}
                >
                  <div className="sb-thumb">
                    {f.mountain.imageUrl
                      ? <img src={f.mountain.imageUrl} alt="" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                      : '🏔'}
                  </div>
                  <span className="sb-name">{f.mountain.name}</span>
                  {f.score != null && <span className="sb-score">{f.score}</span>}
                </Link>
              ))}
            </>
          )}
        </aside>

        {/* ── MAIN ── */}
        <div className="main-scroll">

          {/* Plain title above photo */}
          <h1 className="pg-title">{mountain.name}</h1>
          <p className="pg-loc">{mountain.state}, {mountain.country}</p>

          <div className="cgrid">

            {/* LEFT */}
            <div className="cleft">

              {/* Hero photo card */}
              <div className="hero">
                <img
                  src={mountain.imageUrl || FALLBACK}
                  alt={mountain.name}
                  onError={e => { (e.target as HTMLImageElement).src = FALLBACK; }}
                />
                <div className="hero-grad" />
                <div className="hero-bl">
                  <div className="hero-bl-name">{mountain.name}</div>
                  <div className="hero-bl-loc">{mountain.state}, {mountain.country}</div>
                </div>
                {si && scoreData && (
                  <div className="hero-badge">
                    <div className="hb-num" style={{ background: si.color }}>{scoreData.score}</div>
                    <div className="hb-label" style={{ background: si.color }}>{si.label}</div>
                  </div>
                )}
              </div>

              {/* Conditions + Breakdown card */}
              {scoreData && si && (
                <div className="card">
                  <div className="cond-top">
                    <div className="cond-lbl">
                      <span>⛷️</span> CURRENT CONDITIONS — {mountain.name}
                    </div>
                    <div className="cond-row">
                      <div className="cond-num" style={{ color: si.color }}>{scoreData.score}</div>
                      <div className="cond-pill" style={{ background: si.color }}>{si.label}</div>
                      <div className="cond-expl">{scoreData.explanation}</div>
                    </div>
                  </div>

                  <div className="bdsec">
                    <div className="bd-title">Today&apos;s Powder Score</div>
                    <div className="bd-sub">{scoreData.explanation}</div>
                    {breakdownEntries.map(({ label, raw, value }) => (
                      <div className="bd-row" key={label}>
                        <div className="bd-lbl">{label}</div>
                        <div className="bd-bg">
                          <div className="bd-bar" style={{ width:`${value}%`, background: barColor(raw) }} />
                        </div>
                        <div className="bd-val">{value}/100</div>
                      </div>
                    ))}

                    {token && (
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:18, paddingTop:14, borderTop:'1px solid var(--border)' }}>
                        <button className={`fav-btn${isFav ? ' on' : ''}`} onClick={toggleFav} aria-pressed={isFav}>
                          {isFav ? '⭐ Saved' : '☆ Save Resort'}
                        </button>
                        {mountain.websiteUrl && (
                          <a href={mountain.websiteUrl} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize:13, color:'var(--blue)', fontWeight:600, textDecoration:'none' }}>
                            Visit Website ↗
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT */}
            <div className="cright">

              {/* 6-Day Forecast */}
              <div className="card">
                <div className="fc-hd">🌨️ &nbsp;6-DAY SNOW FORECAST</div>
                {forecast.length > 0 ? forecast.map(day => (
                  <div className="fc-row" key={day.date}>
                    <div className="fc-day">{day.label}</div>
                    <div className="fc-icon">{day.icon}</div>
                    <div className="fc-desc">{day.desc}</div>
                    <div className="fc-snow">{day.snowIn}<span className="fc-unit"> in</span></div>
                  </div>
                )) : (
                  <div style={{ padding:'14px 18px', fontSize:13, color:'var(--text-3)' }}>Forecast loading…</div>
                )}
              </div>

              {/* Quick Links */}
              <div className="card">
                <div className="ql-hd">🔗 &nbsp;QUICK LINKS</div>
                {mountain.websiteUrl && (
                  <a href={mountain.websiteUrl} target="_blank" rel="noopener noreferrer" className="ql-row">
                    <div className="ql-ico" style={{ background:'#dbeafe' }}>🌐</div>
                    <span className="ql-txt">Visit Resort Website</span>
                    <span className="ql-arr">›</span>
                  </a>
                )}
                <Link href={`/mountains/${id}/trails`} className="ql-row">
                  <div className="ql-ico" style={{ background:'#dcfce7' }}>🗺️</div>
                  <span className="ql-txt">View Trail Map</span>
                  <span className="ql-arr">›</span>
                </Link>
                <Link href="/resort/dashboard" className="ql-row">
                  <div className="ql-ico" style={{ background:'#fef3c7' }}>📊</div>
                  <span className="ql-txt">Open Resort Dashboard</span>
                  <span className="ql-arr">›</span>
                </Link>
              </div>

              {/* Snowfall chart */}
              {forecast.length > 0 && (
                <div className="card">
                  <div className="sc-hd">❄️ &nbsp;SNOWFALL°</div>
                  <div className="sc-body">
                    <div className="sc-yax">
                      <span>{Math.ceil(maxSnow)} in</span>
                      <span>{Math.ceil(maxSnow / 2)} in</span>
                    </div>
                    <div className="sc-grid">
                      <div className="sc-bars">
                        {forecast.map(day => {
                          const h = maxSnow > 0 ? Math.max((day.snowIn / maxSnow) * 100, 4) : 4;
                          return (
                            <div className="sc-col" key={day.date}>
                              <div className="sc-bar" style={{ height:`${h}%` }} />
                            </div>
                          );
                        })}
                      </div>
                      <div className="sc-xlbl">
                        {forecast.map(day => (
                          <div className="sc-xl" key={day.date}>{day.label}</div>
                        ))}
                      </div>
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
