'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

interface Mountain { id: string; name: string; state: string; imageUrl?: string }
interface FavoriteItem { id: string; mountain: Mountain }

interface ForecastDay {
  dayLabel: string;
  snowIn: number;
  tempHighF?: number;
  tempLowF?: number;
  conditionDesc?: string;
}

interface ResortForecast {
  fav: FavoriteItem;
  days: ForecastDay[];
  loading: boolean;
  error?: string;
}

const MOUNTAIN_IMAGES: Record<string, string> = {
  'Alta':             'https://images.unsplash.com/photo-1605540436563-5bca919ae766?w=600&q=70',
  'Kirkwood':         'https://images.unsplash.com/photo-1548777123-e216912df7d8?w=600&q=70',
  'Snowbird':         'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600&q=70',
  'Jackson Hole':     'https://images.unsplash.com/photo-1453872302360-eed3c5f8ff66?w=600&q=70',
  'Mt. Bachelor':     'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=70',
  'Stevens Pass':     'https://images.unsplash.com/photo-1546961342-ea5f73e193f9?w=600&q=70',
  'Sugar Bowl':       'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=70',
  'Crystal Mountain': 'https://images.unsplash.com/photo-1478827536114-da961b7f86d2?w=600&q=70',
};
const FALLBACK = 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=70';
function getMtnImg(m: Mountain) { return m.imageUrl || MOUNTAIN_IMAGES[m.name] || FALLBACK; }

function weatherIcon(desc?: string, snow?: number): string {
  if ((snow ?? 0) > 6) return '🌨';
  if ((snow ?? 0) > 0) return '🌦';
  const d = (desc ?? '').toLowerCase();
  if (d.includes('clear') || d.includes('sunny')) return '☀️';
  if (d.includes('cloud')) return '☁️';
  if (d.includes('snow')) return '🌨';
  if (d.includes('rain')) return '🌧';
  return '⛅';
}

function fmt(n?: number, dec = 0) { return n == null ? '—' : n.toFixed(dec); }

function parseForecast(fd: any): ForecastDay[] {
  // Try standard array shapes
  let raw: any[] = Array.isArray(fd) ? fd
    : Array.isArray(fd.data) ? fd.data
    : Array.isArray(fd.data?.periods) ? fd.data.periods
    : Array.isArray(fd.data?.forecast) ? fd.data.forecast
    : Array.isArray(fd.data?.daily) ? fd.data.daily
    : [];

  // Fallback: API returns { data: { mountain, snow: { zones: { base, mid, summit } } } }
  if (raw.length === 0) {
    const snow  = fd.data?.snow ?? fd.snow ?? fd.data;
    const zones = snow?.zones ?? snow;
    const best  = zones?.base ?? zones?.mid ?? zones?.summit ?? null;
    if (best) {
      const today = new Date();
      const days  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      raw = [
        { dayLabel:'Today', snowIn: best.snowfall24hIn ?? 0, tempHighF: best.forecastHigh ?? best.tempF, tempLowF: best.forecastLow, conditionDesc: best.conditionDesc ?? '' },
        ...[1,2,3,4,5].map(i => {
          const d = new Date(today); d.setDate(d.getDate() + i);
          return { dayLabel: days[d.getDay()], snowIn: best.forecastSnowIn ?? 0, tempHighF: best.forecastHigh, tempLowF: best.forecastLow, conditionDesc: best.conditionDesc ?? '' };
        }),
      ];
    }
  }

  return raw.slice(0, 7).map((p: any) => ({
    dayLabel:     p.dayLabel ?? p.day ?? (p.date ? new Date(p.date).toLocaleDateString('en-US',{weekday:'short'}) : '?'),
    snowIn:       p.snowIn ?? p.snowfall24hIn ?? p.precipIn ?? p.snow ?? 0,
    tempHighF:    p.tempHighF ?? p.high ?? p.maxTempF,
    tempLowF:     p.tempLowF  ?? p.low  ?? p.minTempF,
    conditionDesc:p.conditionDesc ?? p.description ?? p.shortForecast ?? '',
  }));
}

const SHARED_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  :root {
    --blue:#1d6ef5; --blue-dark:#1558d6; --blue-light:#e8f1fe; --blue-mid:#3b82f6;
    --text:#0d1b2e; --text-2:#3d5166; --text-3:#6b849a;
    --border:rgba(100,150,200,0.15); --border-2:rgba(100,150,200,0.25);
    --bg:#f0f5fb; --bg-2:#e8f2fb; --white:#ffffff;
    --green:#16a34a; --amber:#d97706;
    --shadow:0 2px 12px rgba(15,40,80,0.08); --shadow-lg:0 8px 32px rgba(15,40,80,0.14);
  }
  body { font-family:'Inter',system-ui,sans-serif; background:var(--bg); color:var(--text); -webkit-font-smoothing:antialiased; }
  a:focus-visible, button:focus-visible { outline:3px solid var(--blue); outline-offset:2px; border-radius:6px; }
  .app-shell { display:flex; flex-direction:column; min-height:100vh; }
  .topnav { background:var(--white); border-bottom:1px solid var(--border-2); height:60px; display:flex; align-items:center; padding:0 20px; gap:12px; flex-shrink:0; box-shadow:0 1px 4px rgba(15,40,80,0.06); position:sticky; top:0; z-index:40; }
  .topnav-logo { display:flex; align-items:center; gap:8px; text-decoration:none; flex-shrink:0; }
  .topnav-logo-icon { width:32px; height:32px; border-radius:9px; background:linear-gradient(135deg,var(--blue),var(--blue-mid)); display:flex; align-items:center; justify-content:center; font-size:17px; }
  .topnav-brand { font-size:17px; font-weight:800; color:var(--text); letter-spacing:-0.03em; }
  .topnav-tabs { display:flex; gap:2px; margin-left:8px; flex:1; overflow-x:auto; }
  .topnav-tab { padding:7px 14px; border-radius:8px 8px 0 0; font-size:13px; font-weight:600; color:var(--text-3); cursor:pointer; border:none; border-bottom:2px solid transparent; background:transparent; font-family:'Inter',sans-serif; display:flex; align-items:center; gap:5px; text-decoration:none; transition:color .15s,border-color .15s,background .15s; white-space:nowrap; }
  .topnav-tab:hover { background:var(--blue-light); color:var(--text); }
  .topnav-tab.active { color:var(--blue); border-bottom-color:var(--blue); background:var(--blue-light); }
  .topnav-right { display:flex; align-items:center; gap:8px; margin-left:auto; flex-shrink:0; }
  .topnav-icon-btn { width:34px; height:34px; border-radius:9px; background:var(--bg); border:1px solid var(--border-2); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:15px; transition:background .15s; text-decoration:none; }
  .topnav-avatar { width:34px; height:34px; border-radius:50%; background:linear-gradient(135deg,var(--blue),var(--blue-mid)); display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; color:#fff; border:2px solid var(--border-2); }
  .topnav-signout { font-size:13px; font-weight:600; color:var(--text-3); background:none; border:none; cursor:pointer; font-family:'Inter',sans-serif; padding:6px 12px; border-radius:8px; transition:background .15s,color .15s; }
  .topnav-signout:hover { background:var(--bg); color:var(--text); }
  .page-body { flex:1; background:var(--bg); }
  .page-inner { max-width:1100px; margin:0 auto; padding:28px 24px 64px; }
  .page-title { font-size:26px; font-weight:900; color:var(--text); letter-spacing:-0.03em; margin-bottom:6px; }
  .page-sub { font-size:14px; color:var(--text-3); margin-bottom:24px; }
  .card { background:var(--white); border:1px solid var(--border-2); border-radius:16px; padding:18px; box-shadow:var(--shadow); }
  .skeleton { background:linear-gradient(90deg,#e8f0f8 25%,#d4e4f0 50%,#e8f0f8 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:10px; }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  .empty-state { text-align:center; padding:80px 20px; }
  .empty-icon { font-size:48px; margin-bottom:14px; }
  .empty-title { font-size:20px; font-weight:800; color:var(--text-2); margin-bottom:8px; }
  .empty-sub { font-size:14px; color:var(--text-3); margin-bottom:24px; }
  .empty-btn { display:inline-block; padding:12px 28px; border-radius:10px; font-size:14px; font-weight:700; color:#fff; background:var(--blue); text-decoration:none; }
  @media(max-width:700px){ .topnav-tabs{display:none;} }
`;

export default function ForecastsPage() {
  const router = useRouter();
  const [token,     setToken]     = useState('');
  const [userName,  setUserName]  = useState('');
  const [userRole,  setUserRole]  = useState('user');
  const [hasResort, setHasResort] = useState(false);
  const [resorts,   setResorts]   = useState<ResortForecast[]>([]);
  const [pageLoad,  setPageLoad]  = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push('/auth/login'); return; }
      const tok = data.session.access_token;
      setToken(tok);

      const [meRes, favRes, resortRes] = await Promise.all([
        fetch('/api/me',        { headers: { Authorization: `Bearer ${tok}` } }),
        fetch('/api/favorites', { headers: { Authorization: `Bearer ${tok}` } }),
        fetch('/api/resort',    { headers: { Authorization: `Bearer ${tok}` } }),
      ]);

      if (meRes.ok) {
        const me = await meRes.json();
        setUserRole(me.data?.role || 'user');
        setUserName(me.data?.profile?.displayName || '');
      }
      if (resortRes.ok) {
        const rd = await resortRes.json();
        setHasResort((rd.data?.length ?? 0) > 0);
      }

      if (favRes.ok) {
        const favData = await favRes.json();
        const items: FavoriteItem[] = favData.data || [];
        // Seed each resort with loading state
        const initial = items.map(f => ({ fav: f, days: [], loading: true }));
        setResorts(initial);
        setPageLoad(false);

        // Fetch forecasts for each in parallel
        items.forEach(async (fav, idx) => {
          try {
            const res = await fetch(`/api/mountains/${fav.mountain.id}/forecast`, {
              headers: { Authorization: `Bearer ${tok}` },
            });
            const days = res.ok ? parseForecast(await res.json()) : [];
            setResorts(prev => prev.map((r, i) => i === idx ? { ...r, days, loading: false } : r));
          } catch {
            setResorts(prev => prev.map((r, i) => i === idx ? { ...r, loading: false, error: 'Failed to load' } : r));
          }
        });

        if (items.length === 0) setPageLoad(false);
      } else {
        setPageLoad(false);
      }
    })();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <>
      <style>{SHARED_CSS + `
        .resort-block { margin-bottom:28px; }
        .resort-header { display:flex; align-items:center; gap:14px; margin-bottom:14px; }
        .resort-thumb { width:52px; height:52px; border-radius:12px; object-fit:cover; flex-shrink:0; }
        .resort-name { font-size:18px; font-weight:800; color:var(--text); letter-spacing:-0.02em; }
        .resort-state { font-size:13px; color:var(--text-3); margin-top:2px; }
        .resort-link { font-size:12px; font-weight:600; color:var(--blue); text-decoration:none; margin-left:auto; padding:6px 14px; border:1px solid rgba(29,110,245,0.3); border-radius:8px; background:var(--blue-light); }
        .resort-link:hover { background:#dbeafe; }
        .fc-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:8px; }
        @media(max-width:700px){ .fc-grid{grid-template-columns:repeat(4,1fr);} }
        .fc-cell { background:var(--bg); border:1px solid var(--border); border-radius:12px; padding:12px 6px; text-align:center; }
        .fc-cell.today { background:var(--blue-light); border-color:rgba(29,110,245,0.25); }
        .fc-day-name { font-size:11px; font-weight:700; color:var(--text-3); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.03em; }
        .fc-icon { font-size:22px; margin-bottom:5px; }
        .fc-snow { font-size:16px; font-weight:900; color:var(--text); }
        .fc-snow-unit { font-size:10px; color:var(--text-3); font-weight:500; }
        .fc-temp { font-size:10px; color:var(--text-3); margin-top:3px; }
        .fc-empty { height:120px; display:flex; align-items:center; justify-content:center; color:var(--text-3); font-size:13px; background:var(--bg); border-radius:12px; border:1px dashed var(--border-2); }
        .divider { height:1px; background:var(--border); margin:6px 0 24px; }
      `}</style>
      <div className="app-shell">
        <header className="topnav" role="banner">
          <Link href="/" className="topnav-logo" aria-label="PowderIQ home">
            <div className="topnav-logo-icon" aria-hidden="true">❄️</div>
            <span className="topnav-brand">PowderIQ</span>
          </Link>
          <nav className="topnav-tabs" aria-label="Main navigation">
            <Link href="/dashboard" className="topnav-tab"><span aria-hidden="true">📊</span>Dashboard</Link>
            <Link href="/mountains" className="topnav-tab"><span aria-hidden="true">🏔️</span>Resorts</Link>
            <Link href="/forecasts" className="topnav-tab active" aria-current="page"><span aria-hidden="true">📅</span>Forecasts</Link>
            {(userRole==='pro_user'||userRole==='admin') && <Link href="/compare" className="topnav-tab"><span aria-hidden="true">📈</span>Analytics</Link>}
            {(userRole==='pro_user'||userRole==='admin') && <Link href="/alerts"  className="topnav-tab"><span aria-hidden="true">🔔</span>Alerts</Link>}
            {hasResort && <Link href="/resort/dashboard" className="topnav-tab"><span aria-hidden="true">🎿</span>Resort</Link>}
            {userRole==='admin' && <Link href="/admin" className="topnav-tab"><span aria-hidden="true">⚙️</span>Admin</Link>}
          </nav>
          <div className="topnav-right">
            <Link href="/account" className="topnav-icon-btn" aria-label="Account">⚙️</Link>
            <div className="topnav-avatar">{userName ? userName[0].toUpperCase() : '👤'}</div>
            <button className="topnav-signout" onClick={handleLogout}>Sign out</button>
          </div>
        </header>

        <main className="page-body">
          <div className="page-inner">
            <h1 className="page-title">📅 Forecasts</h1>
            <p className="page-sub">7-day snow outlook for your saved resorts</p>

            {pageLoad ? (
              <>
                {[0,1,2].map(i => (
                  <div key={i} className="card resort-block" style={{marginBottom:24}}>
                    <div className="skeleton" style={{height:52,width:240,borderRadius:10,marginBottom:14}} />
                    <div className="fc-grid">
                      {[...Array(7)].map((_,j) => <div key={j} className="skeleton" style={{height:110}} />)}
                    </div>
                  </div>
                ))}
              </>
            ) : resorts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon" aria-hidden="true">📅</div>
                <div className="empty-title">No saved resorts yet</div>
                <div className="empty-sub">Save some mountains to see their forecasts here.</div>
                <Link href="/mountains" className="empty-btn">Browse Mountains</Link>
              </div>
            ) : (
              resorts.map((r, idx) => (
                <div key={r.fav.id} className="resort-block">
                  <div className="resort-header">
                    <img
                      src={getMtnImg(r.fav.mountain)}
                      alt=""
                      className="resort-thumb"
                      onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK; }}
                    />
                    <div>
                      <div className="resort-name">{r.fav.mountain.name}</div>
                      <div className="resort-state">{r.fav.mountain.state}</div>
                    </div>
                    <Link href={`/mountains/${r.fav.mountain.id}`} className="resort-link">
                      View details →
                    </Link>
                  </div>

                  {r.loading ? (
                    <div className="fc-grid">
                      {[...Array(7)].map((_,j) => <div key={j} className="skeleton" style={{height:110}} />)}
                    </div>
                  ) : r.days.length === 0 ? (
                    <div className="fc-empty">No forecast data available</div>
                  ) : (
                    <div className="fc-grid">
                      {r.days.map((d, i) => (
                        <div key={i} className={`fc-cell${i===0?' today':''}`}>
                          <div className="fc-day-name">{d.dayLabel}</div>
                          <div className="fc-icon" aria-hidden="true">{weatherIcon(d.conditionDesc, d.snowIn)}</div>
                          <div className="fc-snow">{fmt(d.snowIn, 1)}<span className="fc-snow-unit">in</span></div>
                          {(d.tempHighF != null || d.tempLowF != null) && (
                            <div className="fc-temp">
                              {d.tempHighF != null ? `${fmt(d.tempHighF)}°` : ''}
                              {d.tempLowF  != null ? ` / ${fmt(d.tempLowF)}°` : ''}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {idx < resorts.length - 1 && <div className="divider" style={{marginTop:20}} />}
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </>
  );
}
