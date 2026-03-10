'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import ScoreBadge from '@/components/ScoreBadge';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Mountain { id: string; name: string; state: string; imageUrl?: string; slug?: string }
interface FavoriteItem { id: string; mountain: Mountain; score?: number }

interface MountainScore {
  score: number;
  snowfall24hIn?: number;
  windMph?: number;
  tempF?: number;
  snowDepthIn?: number;
  conditionDesc?: string;
  fetchedAt?: string;
}

interface ForecastPeriod {
  date: string;
  dayLabel?: string;
  icon?: string;
  snowIn: number;
  tempHighF?: number;
  tempLowF?: number;
  conditionDesc?: string;
  precipPct?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MOUNTAIN_IMAGES: Record<string, string> = {
  'Alta':             'https://images.unsplash.com/photo-1605540436563-5bca919ae766?w=800&q=70',
  'Kirkwood':         'https://images.unsplash.com/photo-1548777123-e216912df7d8?w=800&q=70',
  'Snowbird':         'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&q=70',
  'Jackson Hole':     'https://images.unsplash.com/photo-1453872302360-eed3c5f8ff66?w=800&q=70',
  'Mt. Bachelor':     'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=70',
  'Stevens Pass':     'https://images.unsplash.com/photo-1546961342-ea5f73e193f9?w=800&q=70',
  'Sugar Bowl':       'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800&q=70',
  'Crystal Mountain': 'https://images.unsplash.com/photo-1478827536114-da961b7f86d2?w=800&q=70',
};
const FALLBACK_IMG = 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=70';
function getMountainImage(m: Mountain): string {
  return m.imageUrl || MOUNTAIN_IMAGES[m.name] || FALLBACK_IMG;
}

function getScoreLabel(s: number): string {
  if (s >= 90) return 'Powder Star';
  if (s >= 80) return 'Great';
  if (s >= 65) return 'Good';
  if (s >= 50) return 'Decent';
  return 'Low';
}
function getScoreColor(s: number): string {
  if (s >= 85) return '#1d6ef5';
  if (s >= 70) return '#22c55e';
  if (s >= 55) return '#f59e0b';
  return '#94a3b8';
}

function weatherIcon(desc?: string, snow?: number): string {
  if (!desc && !snow) return '⛅';
  if ((snow ?? 0) > 6) return '🌨';
  if ((snow ?? 0) > 0) return '🌦';
  const d = (desc ?? '').toLowerCase();
  if (d.includes('clear') || d.includes('sunny')) return '☀️';
  if (d.includes('cloud')) return '☁️';
  if (d.includes('snow')) return '🌨';
  if (d.includes('rain')) return '🌧';
  return '⛅';
}

function fmt(n?: number, decimals = 0): string {
  if (n == null) return '—';
  return n.toFixed(decimals);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();

  const [favorites,    setFavorites]    = useState<FavoriteItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [userRole,     setUserRole]     = useState<string>('user');
  const [userName,     setUserName]     = useState<string>('');
  const [hasResort,    setHasResort]    = useState<boolean>(false);
  const [token,        setToken]        = useState<string>('');
  const [activeTab,    setActiveTab]    = useState<string>('dashboard');
  const [selectedFav,  setSelectedFav]  = useState<FavoriteItem | null>(null);

  // Per-selected-resort data
  const [scoreData,    setScoreData]    = useState<MountainScore | null>(null);
  const [forecast,     setForecast]     = useState<ForecastPeriod[]>([]);
  const [scoreLoading, setScoreLoading] = useState(false);

  // ── Initial load ────────────────────────────────────────────────────────────
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

        // Fetch scores for all favorites in parallel
        const withScores = await Promise.all(
          items.map(async (f) => {
            try {
              const sRes = await fetch(`/api/mountains/${f.mountain.id}/score`, {
                headers: { Authorization: `Bearer ${tok}` },
              });
              if (sRes.ok) {
                const s = await sRes.json();
                return { ...f, score: s.data?.score };
              }
            } catch {}
            return f;
          })
        );
        setFavorites(withScores);
        if (withScores.length > 0) setSelectedFav(withScores[0]);
      }
      setLoading(false);
    })();
  }, [router]);

  // ── Load detail data when selected resort changes ───────────────────────────
  const loadResortDetail = useCallback(async (fav: FavoriteItem, tok: string) => {
    if (!fav || !tok) return;
    setScoreLoading(true);
    setScoreData(null);
    setForecast([]);

    try {
      const [scoreRes, forecastRes] = await Promise.allSettled([
        fetch(`/api/mountains/${fav.mountain.id}/score`,    { headers: { Authorization: `Bearer ${tok}` } }),
        fetch(`/api/mountains/${fav.mountain.id}/forecast`, { headers: { Authorization: `Bearer ${tok}` } }),
      ]);

      // ── Score API: returns { data: { score, breakdown, explanation } }
      // ── Forecast API: returns { data: { mountain, snow: SnowData } }
      //    SnowData = { snowfall24h, snowfall7d, baseDepthIn, windMph, tempF, tempMinF, tempMaxF }

      let mountainLat: number | null = null;
      let mountainLon: number | null = null;
      let mountainBaseElev = 4000;
      let mountainSummitElev = 8000;

      if (forecastRes.status === 'fulfilled' && forecastRes.value.ok) {
        const fd = await forecastRes.value.json();
        // snow is the SnowData flat object
        const snow = fd.data?.snow ?? fd.data ?? {};
        const mountain = fd.data?.mountain ?? {};

        mountainLat         = mountain.latitude  ?? null;
        mountainLon         = mountain.longitude ?? null;
        mountainBaseElev    = mountain.baseElevFt   ?? 4000;
        mountainSummitElev  = mountain.topElevFt    ?? 8000;

        // Derive a condition description from SnowData fields
        const snow24h = snow.snowfall24h ?? 0;
        const wind    = snow.windMph ?? 0;
        const temp    = snow.tempF ?? 28;
        let condDesc = '';
        if (snow24h > 6)       condDesc = 'Heavy snow';
        else if (snow24h > 2)  condDesc = 'Snow showers';
        else if (snow24h > 0)  condDesc = 'Light snow';
        else if (wind > 35)    condDesc = 'Windy';
        else if (temp > 34)    condDesc = 'Partly cloudy';
        else                   condDesc = 'Clear & cold';

        // Use score from scoreRes if available, else fav.score
        let scoreVal = fav.score ?? 0;
        if (scoreRes.status === 'fulfilled' && scoreRes.value.ok) {
          const sd = await scoreRes.value.json();
          scoreVal = sd.data?.score ?? scoreVal;
        }

        setScoreData({
          score:         scoreVal,
          snowfall24hIn: snow.snowfall24h,
          windMph:       snow.windMph,
          tempF:         snow.tempF,
          snowDepthIn:   snow.baseDepthIn,
          conditionDesc: condDesc,
          fetchedAt:     null,
        });
      } else if (scoreRes.status === 'fulfilled' && scoreRes.value.ok) {
        // Score-only fallback if forecast failed
        const sd = await scoreRes.value.json();
        setScoreData({
          score:         sd.data?.score ?? fav.score ?? 0,
          snowfall24hIn: undefined,
          windMph:       undefined,
          tempF:         undefined,
          snowDepthIn:   undefined,
          conditionDesc: undefined,
          fetchedAt:     null,
        });
      }

      // ── 6-day forecast: fetch Open-Meteo directly using mountain lat/lon
      if (mountainLat !== null && mountainLon !== null) {
        try {
          const summitElevM = Math.round(mountainSummitElev * 0.3048);
          const omUrl =
            `https://api.open-meteo.com/v1/forecast?latitude=${mountainLat}&longitude=${mountainLon}` +
            `&daily=temperature_2m_max,temperature_2m_min,snowfall_sum,precipitation_probability_max,weathercode` +
            `&temperature_unit=fahrenheit&precipitation_unit=inch` +
            `&timezone=auto&forecast_days=7&elevation=${summitElevM}`;

          const omRes = await fetch(omUrl);
          if (omRes.ok) {
            const om = await omRes.json();
            const daily = om.daily ?? {};
            const WMO: Record<number, string> = {
              0:'Clear sky', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast',
              45:'Fog', 48:'Icy fog',
              51:'Light drizzle', 53:'Drizzle', 55:'Heavy drizzle',
              61:'Light rain', 63:'Rain', 65:'Heavy rain',
              71:'Light snow', 73:'Snow', 75:'Heavy snow',
              77:'Snow grains', 80:'Rain showers', 81:'Rain showers', 82:'Heavy showers',
              85:'Snow showers', 86:'Heavy snow showers',
              95:'Thunderstorm', 96:'Thunderstorm w/ hail', 99:'Heavy thunderstorm',
            };
            const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
            const periods: ForecastPeriod[] = (daily.time ?? []).slice(0, 7).map((dateStr: string, i: number) => {
              const d = new Date(dateStr + 'T12:00:00');
              const wcode = daily.weathercode?.[i] ?? 0;
              return {
                date:         dateStr,
                dayLabel:     i === 0 ? 'Today' : dayNames[d.getDay()],
                snowIn:       daily.snowfall_sum?.[i] ?? 0,
                tempHighF:    daily.temperature_2m_max?.[i],
                tempLowF:     daily.temperature_2m_min?.[i],
                conditionDesc:WMO[wcode] ?? 'Mixed',
                precipPct:    daily.precipitation_probability_max?.[i],
              };
            });
            setForecast(periods);
          }
        } catch (omErr) {
          console.warn('Open-Meteo forecast fetch failed:', omErr);
        }
      }
    } catch (e) {
      console.error('Failed to load resort detail', e);
    }
    setScoreLoading(false);
  }, []);

  useEffect(() => {
    if (selectedFav && token) loadResortDetail(selectedFav, token);
  }, [selectedFav, token, loadResortDetail]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  // ── Derived display values ───────────────────────────────────────────────────
  const activeFav   = selectedFav ?? favorites[0] ?? null;
  const heroImg     = activeFav ? getMountainImage(activeFav.mountain) : FALLBACK_IMG;
  const score       = scoreData?.score ?? activeFav?.score ?? 0;
  const scoreColor  = getScoreColor(score);
  const scoreLabel  = getScoreLabel(score);
  const updatedTime = scoreData?.fetchedAt
    ? new Date(scoreData.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  // Build chart data from forecast snowfall
  const chartData = forecast.length > 0
    ? forecast.map(f => ({ val: f.snowIn, label: f.dayLabel ?? '' }))
    : [];
  const chartMax = Math.max(...chartData.map(d => d.val), 1);

  return (
    <>
      <style>{`
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

        .app-shell { display:flex; flex-direction:column; height:100vh; overflow:hidden; }

        /* TOP NAV */
        .topnav { background:var(--white); border-bottom:1px solid var(--border-2); height:60px; display:flex; align-items:center; padding:0 20px; gap:12px; flex-shrink:0; box-shadow:0 1px 4px rgba(15,40,80,0.06); }
        .topnav-logo { display:flex; align-items:center; gap:8px; text-decoration:none; flex-shrink:0; }
        .topnav-logo-icon { width:32px; height:32px; border-radius:9px; background:linear-gradient(135deg,var(--blue),var(--blue-mid)); display:flex; align-items:center; justify-content:center; font-size:17px; box-shadow:0 2px 6px rgba(29,110,245,0.3); }
        .topnav-brand { font-size:17px; font-weight:800; color:var(--text); letter-spacing:-0.03em; }
        .topnav-tabs { display:flex; gap:2px; margin-left:8px; flex:1; overflow-x:auto; }
        .topnav-tab { padding:7px 14px; border-radius:8px 8px 0 0; font-size:13px; font-weight:600; color:var(--text-3); cursor:pointer; border:none; border-bottom:2px solid transparent; background:transparent; font-family:'Inter',sans-serif; display:flex; align-items:center; gap:5px; text-decoration:none; transition:color .15s,border-color .15s,background .15s; white-space:nowrap; }
        .topnav-tab:hover { background:var(--blue-light); color:var(--text); }
        .topnav-tab.active { color:var(--blue); border-bottom-color:var(--blue); background:var(--blue-light); }
        .topnav-right { display:flex; align-items:center; gap:8px; margin-left:auto; flex-shrink:0; }
        .topnav-icon-btn { width:34px; height:34px; border-radius:9px; background:var(--bg); border:1px solid var(--border-2); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:15px; transition:background .15s; text-decoration:none; }
        .topnav-icon-btn:hover { background:var(--blue-light); }
        .topnav-avatar { width:34px; height:34px; border-radius:50%; background:linear-gradient(135deg,var(--blue),var(--blue-mid)); display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; color:#fff; cursor:pointer; border:2px solid var(--border-2); }
        .topnav-signout { font-size:13px; font-weight:600; color:var(--text-3); background:none; border:none; cursor:pointer; font-family:'Inter',sans-serif; padding:6px 12px; border-radius:8px; transition:background .15s,color .15s; }
        .topnav-signout:hover { background:var(--bg); color:var(--text); }

        /* BODY */
        .app-body { display:flex; flex:1; overflow:hidden; }

        /* SIDEBAR */
        .sidebar { width:196px; background:var(--white); border-right:1px solid var(--border-2); display:flex; flex-direction:column; overflow-y:auto; flex-shrink:0; }
        .sidebar-section { padding:12px 8px 4px; }
        .sidebar-nav-item { display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:9px; font-size:13px; font-weight:600; color:var(--text-3); cursor:pointer; text-decoration:none; transition:background .15s,color .15s; border:none; background:transparent; font-family:'Inter',sans-serif; width:100%; }
        .sidebar-nav-item:hover { background:var(--bg); color:var(--text); }
        .sidebar-nav-item.active { background:var(--blue-light); color:var(--blue); }
        .sidebar-nav-icon { font-size:14px; width:18px; text-align:center; }
        .sidebar-divider { height:1px; background:var(--border); margin:6px 10px; }
        .sidebar-label { font-size:10px; font-weight:700; color:var(--text-3); letter-spacing:0.06em; text-transform:uppercase; padding:8px 10px 4px; }
        .sidebar-resort-item { display:flex; align-items:center; gap:8px; padding:7px 8px; border-radius:9px; cursor:pointer; transition:background .15s; margin:1px 4px; }
        .sidebar-resort-item:hover { background:var(--bg); }
        .sidebar-resort-item.active { background:var(--blue-light); }
        .sidebar-resort-thumb { width:24px; height:24px; border-radius:6px; object-fit:cover; background:var(--bg-2); flex-shrink:0; }
        .sidebar-resort-name { font-size:12px; font-weight:600; color:var(--text-2); flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .sidebar-resort-score { font-size:11px; font-weight:700; color:var(--blue); flex-shrink:0; }

        /* MAIN */
        .main-content { flex:1; overflow-y:auto; background:var(--bg); }
        .main-inner { max-width:1060px; margin:0 auto; padding:20px 22px 48px; }

        /* HERO */
        .hero-card { border-radius:18px; overflow:hidden; position:relative; margin-bottom:16px; box-shadow:var(--shadow-lg); }
        .hero-img { width:100%; height:190px; object-fit:cover; display:block; }
        .hero-overlay { position:absolute; inset:0; background:linear-gradient(to bottom,rgba(0,0,0,0.05) 0%,rgba(0,0,0,0.52) 100%); }
        .hero-label { position:absolute; bottom:14px; left:16px; }
        .hero-resort-name { font-size:22px; font-weight:900; color:#fff; letter-spacing:-0.02em; text-shadow:0 2px 8px rgba(0,0,0,0.4); }
        .hero-state { font-size:13px; color:rgba(255,255,255,0.8); margin-top:2px; font-weight:500; }
        .hero-updated { position:absolute; top:12px; right:12px; background:rgba(255,255,255,0.15); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.25); border-radius:100px; padding:4px 11px; font-size:11px; font-weight:600; color:#fff; }

        /* GRID */
        .content-grid { display:grid; grid-template-columns:1fr 268px; gap:14px; }
        @media(max-width:860px){ .content-grid{grid-template-columns:1fr;} }

        /* CARDS */
        .card { background:var(--white); border:1px solid var(--border-2); border-radius:16px; padding:16px; box-shadow:var(--shadow); }
        .card + .card { margin-top:14px; }
        .card-title { font-size:12px; font-weight:700; color:var(--text-3); margin-bottom:12px; display:flex; align-items:center; gap:5px; letter-spacing:0.02em; text-transform:uppercase; }

        /* SCORE */
        .score-big { font-size:64px; font-weight:900; line-height:1; letter-spacing:-0.04em; }
        .score-label-text { font-size:20px; font-weight:800; margin-top:4px; }
        .score-sub { font-size:12px; color:var(--text-3); margin-top:3px; }
        .metrics-row { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:14px; }
        .metric-box { background:var(--bg); border-radius:10px; padding:10px 6px; text-align:center; border:1px solid var(--border); }
        .metric-val { font-size:14px; font-weight:700; color:var(--text); white-space:nowrap; }
        .metric-key { font-size:10px; color:var(--text-3); margin-top:2px; }
        .metric-loading { height:14px; border-radius:4px; }

        /* FORECAST STRIP */
        .forecast-strip { display:flex; gap:7px; }
        .fc-day { flex:1; background:var(--bg); border-radius:10px; padding:10px 5px; text-align:center; border:1px solid var(--border); min-width:0; }
        .fc-day-name { font-size:11px; font-weight:600; color:var(--text-3); margin-bottom:5px; }
        .fc-icon { font-size:20px; }
        .fc-snow-val { font-size:14px; font-weight:800; color:var(--text); margin-top:4px; }
        .fc-snow-unit { font-size:10px; color:var(--text-3); font-weight:500; }
        .fc-temp { font-size:10px; color:var(--text-3); margin-top:2px; }

        /* FORECAST SIDEBAR */
        .fc-sidebar-row { display:flex; align-items:center; padding:9px 0; border-bottom:1px solid var(--border); }
        .fc-sidebar-row:last-child { border-bottom:none; padding-bottom:0; }
        .fc-sidebar-day { font-size:13px; font-weight:600; color:var(--text-2); width:36px; flex-shrink:0; }
        .fc-sidebar-icon { font-size:17px; margin:0 8px; flex-shrink:0; }
        .fc-sidebar-desc { font-size:11px; color:var(--text-3); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .fc-sidebar-snow { font-size:16px; font-weight:900; color:var(--text); flex-shrink:0; }
        .fc-sidebar-unit { font-size:10px; color:var(--text-3); margin-left:2px; }

        /* CHART */
        .chart-wrap { background:var(--bg); border-radius:10px; padding:12px 8px 6px; margin-top:12px; }
        .chart-bars { display:flex; align-items:flex-end; gap:4px; height:72px; }
        .chart-bar-col { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; height:100%; justify-content:flex-end; }
        .chart-bar { width:100%; border-radius:3px 3px 0 0; background:linear-gradient(180deg,var(--blue),#93c5fd); min-height:3px; transition:height .3s; }
        .chart-bar-lbl { font-size:8px; color:var(--text-3); }
        .chart-empty { height:72px; display:flex; align-items:center; justify-content:center; font-size:12px; color:var(--text-3); }

        /* FAVS GRID */
        .section-heading { font-size:13px; font-weight:700; color:var(--text-3); letter-spacing:0.02em; text-transform:uppercase; margin-bottom:12px; display:flex; align-items:center; gap:5px; }
        .fav-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:12px; }
        .fav-card { background:var(--white); border:1px solid var(--border-2); border-radius:14px; overflow:hidden; text-decoration:none; color:inherit; box-shadow:var(--shadow); transition:transform .2s,box-shadow .2s,border-color .2s; display:flex; flex-direction:column; }
        .fav-card:hover { transform:translateY(-3px); box-shadow:var(--shadow-lg); border-color:rgba(29,110,245,0.3); }
        .fav-img { width:100%; height:130px; object-fit:cover; display:block; }
        .fav-img-placeholder { width:100%; height:130px; background:linear-gradient(135deg,#bfdbfe,#93c5fd); display:flex; align-items:center; justify-content:center; font-size:28px; }
        .fav-body { padding:12px; display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .fav-name { font-size:14px; font-weight:800; color:var(--text); }
        .fav-state { font-size:12px; color:var(--text-3); margin-top:1px; }

        /* UPGRADE */
        .upgrade-banner { background:linear-gradient(135deg,#eff6ff,#dbeafe); border:1px solid rgba(29,110,245,0.2); border-radius:14px; padding:14px 18px; display:flex; align-items:center; justify-content:space-between; gap:14px; margin-bottom:16px; flex-wrap:wrap; }
        .upgrade-title { font-size:14px; font-weight:700; color:var(--text); }
        .upgrade-sub { font-size:12px; color:var(--text-2); margin-top:2px; }
        .upgrade-btn { padding:8px 18px; border-radius:9px; font-size:13px; font-weight:700; color:#fff; background:var(--blue); text-decoration:none; white-space:nowrap; box-shadow:0 2px 8px rgba(29,110,245,0.3); }
        .upgrade-btn:hover { filter:brightness(1.1); }

        /* EMPTY */
        .empty-state { text-align:center; padding:60px 20px; }
        .empty-icon { font-size:44px; margin-bottom:12px; }
        .empty-title { font-size:18px; font-weight:700; color:var(--text-2); margin-bottom:6px; }
        .empty-sub { font-size:14px; color:var(--text-3); margin-bottom:20px; }
        .empty-btn { display:inline-block; padding:11px 24px; border-radius:10px; font-size:14px; font-weight:700; color:#fff; background:var(--blue); text-decoration:none; box-shadow:0 2px 8px rgba(29,110,245,0.3); }

        /* SKELETON */
        .skeleton { background:linear-gradient(90deg,#e8f0f8 25%,#d4e4f0 50%,#e8f0f8 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:10px; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

        /* QUICK LINKS */
        .quick-link { display:flex; align-items:center; gap:8px; padding:9px 10px; border-radius:9px; background:var(--bg); text-decoration:none; font-size:13px; font-weight:600; color:var(--text-2); border:1px solid var(--border); transition:background .15s,color .15s; }
        .quick-link:hover { background:var(--blue-light); color:var(--blue); }
        .quick-link.highlight { background:var(--blue-light); color:var(--blue); border-color:rgba(29,110,245,0.2); }

        /* SCORE LOADING */
        .data-loading { opacity:0.5; pointer-events:none; }

        @media(max-width:700px){
          .sidebar{display:none;}
          .topnav-tabs{display:none;}
          .metrics-row{grid-template-columns:repeat(2,1fr);}
        }
      `}</style>

      <div className="app-shell">

        {/* ── TOP NAV ── */}
        <header className="topnav" role="banner">
          <Link href="/" className="topnav-logo" aria-label="PowderIQ home">
            <div className="topnav-logo-icon" aria-hidden="true">❄️</div>
            <span className="topnav-brand">PowderIQ</span>
          </Link>

          <nav className="topnav-tabs" aria-label="Main navigation">
            <Link href="/dashboard" className="topnav-tab active" aria-current="page">
              <span aria-hidden="true">📊</span>Dashboard
            </Link>
            <Link href="/mountains" className="topnav-tab">
              <span aria-hidden="true">🏔️</span>Resorts
            </Link>
            <Link href="/forecasts" className="topnav-tab">
              <span aria-hidden="true">📅</span>Forecasts
            </Link>
            {(userRole==='pro_user'||userRole==='admin') && (
              <Link href="/compare" className="topnav-tab">
                <span aria-hidden="true">📈</span>Analytics
              </Link>
            )}
            {(userRole==='pro_user'||userRole==='admin') && (
              <Link href="/alerts" className="topnav-tab">
                <span aria-hidden="true">🔔</span>Alerts
              </Link>
            )}
            {hasResort && (
              <Link href="/resort/dashboard" className="topnav-tab">
                <span aria-hidden="true">🎿</span>Resort
              </Link>
            )}
            {userRole==='admin' && (
              <Link href="/admin" className="topnav-tab">
                <span aria-hidden="true">⚙️</span>Admin
              </Link>
            )}
          </nav>

          <div className="topnav-right">
            <Link href="/account" className="topnav-icon-btn" aria-label="Account settings">⚙️</Link>
            <div className="topnav-icon-btn" aria-label="Notifications" role="button" tabIndex={0}>🔔</div>
            <div className="topnav-avatar" aria-label={`Signed in as ${userName || 'user'}`}>
              {userName ? userName[0].toUpperCase() : '👤'}
            </div>
            <button className="topnav-signout" onClick={handleLogout}>Sign out</button>
          </div>
        </header>

        <div className="app-body">

          {/* ── SIDEBAR ── */}
          <aside className="sidebar" aria-label="Sidebar navigation">
            <div className="sidebar-section">
              <Link href="/dashboard" className="sidebar-nav-item active" aria-current="page">
                <span className="sidebar-nav-icon" aria-hidden="true">📊</span>Dashboard
              </Link>
              <Link href="/mountains" className="sidebar-nav-item">
                <span className="sidebar-nav-icon" aria-hidden="true">🏔️</span>Resorts
              </Link>
              <Link href="/forecasts" className="sidebar-nav-item">
                <span className="sidebar-nav-icon" aria-hidden="true">📅</span>Forecasts
              </Link>
              {(userRole==='pro_user'||userRole==='admin') && (
                <Link href="/compare" className="sidebar-nav-item">
                  <span className="sidebar-nav-icon" aria-hidden="true">📈</span>Analytics
                </Link>
              )}
              {(userRole==='pro_user'||userRole==='admin') && (
                <Link href="/alerts" className="sidebar-nav-item">
                  <span className="sidebar-nav-icon" aria-hidden="true">🔔</span>Alerts
                </Link>
              )}
            </div>

            <div className="sidebar-divider" />

            {favorites.length > 0 && (
              <>
                <div className="sidebar-label">Saved Resorts</div>
                {favorites.map(f=>(
                  <div key={f.id}
                    className={`sidebar-resort-item${activeFav?.id===f.id?' active':''}`}
                    onClick={()=>setSelectedFav(f)}
                    role="button" tabIndex={0}
                    aria-label={`View ${f.mountain.name}`}
                    aria-pressed={activeFav?.id===f.id}
                    onKeyDown={e=>e.key==='Enter'&&setSelectedFav(f)}>
                    <img src={getMountainImage(f.mountain)} alt="" aria-hidden="true"
                      className="sidebar-resort-thumb"
                      onError={e=>{(e.target as HTMLImageElement).src=FALLBACK_IMG}} />
                    <span className="sidebar-resort-name">{f.mountain.name}</span>
                    {f.score!=null && <span className="sidebar-resort-score">{f.score}</span>}
                  </div>
                ))}
              </>
            )}
          </aside>

          {/* ── MAIN ── */}
          <main className="main-content" id="main-content">
            <div className="main-inner">

              {loading ? (
                <div aria-label="Loading" aria-busy="true">
                  <div className="skeleton" style={{height:190,marginBottom:14}} />
                  <div style={{display:'grid',gridTemplateColumns:'1fr 268px',gap:14}}>
                    <div className="skeleton" style={{height:220}} />
                    <div className="skeleton" style={{height:220}} />
                  </div>
                </div>
              ) : (
                <>
                  {userRole==='user' && (
                    <div className="upgrade-banner" role="complementary">
                      <div>
                        <div className="upgrade-title">📊 Upgrade to Pro</div>
                        <div className="upgrade-sub">Unlock Compare, Alerts, and personalized scoring weights.</div>
                      </div>
                      <Link href="/account" className="upgrade-btn">Upgrade Now</Link>
                    </div>
                  )}

                  {favorites.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon" aria-hidden="true">⭐</div>
                      <div className="empty-title">No favorites yet</div>
                      <div className="empty-sub">Add mountains to track your powder windows.</div>
                      <Link href="/mountains" className="empty-btn">Browse Mountains</Link>
                    </div>
                  ) : (
                    <>
                      {/* HERO */}
                      <div className="hero-card">
                        <img src={heroImg} alt={activeFav?.mountain.name ?? ''} className="hero-img"
                          onError={e=>{(e.target as HTMLImageElement).src=FALLBACK_IMG}} />
                        <div className="hero-overlay" aria-hidden="true" />
                        <div className="hero-label">
                          <div className="hero-resort-name">{activeFav?.mountain.name} Resort</div>
                          <div className="hero-state">{activeFav?.mountain.state}</div>
                        </div>
                        {updatedTime && (
                          <div className="hero-updated">✓ Updated {updatedTime}</div>
                        )}
                      </div>

                      <div className={`content-grid${scoreLoading?' data-loading':''}`}>

                        {/* LEFT */}
                        <div style={{display:'flex',flexDirection:'column',gap:14}}>

                          {/* SCORE + METRICS */}
                          <div className="card" aria-label={`${activeFav?.mountain.name} conditions`}>
                            <div className="card-title">
                              <span aria-hidden="true">🏔️</span>
                              Current Conditions — {activeFav?.mountain.name}
                            </div>
                            <div style={{display:'flex',alignItems:'flex-start',gap:20}}>
                              <div>
                                <div className="score-big" style={{color:scoreColor}}>{score}</div>
                                <div className="score-label-text" style={{color:scoreColor}}>{scoreLabel}</div>
                                <div className="score-sub">Powder Score</div>
                              </div>
                              {scoreData?.conditionDesc && (
                                <div style={{padding:'8px 12px',background:'var(--bg)',borderRadius:10,border:'1px solid var(--border)',fontSize:13,color:'var(--text-2)',fontWeight:500,marginTop:4,maxWidth:200,lineHeight:1.5}}>
                                  {scoreData.conditionDesc}
                                </div>
                              )}
                            </div>
                            <div className="metrics-row">
                              {[
                                {val: scoreData?.snowfall24hIn!=null ? `${fmt(scoreData.snowfall24hIn,1)}"` : '—', key:'New Snow 24h'},
                                {val: scoreData?.windMph!=null       ? `${fmt(scoreData.windMph)} mph`      : '—', key:'Wind Speed'},
                                {val: scoreData?.tempF!=null         ? `${fmt(scoreData.tempF)}°F`          : '—', key:'Temperature'},
                                {val: scoreData?.snowDepthIn!=null   ? `${fmt(scoreData.snowDepthIn)}"`     : '—', key:'Base Depth'},
                              ].map(m=>(
                                <div key={m.key} className="metric-box">
                                  {scoreLoading
                                    ? <div className={`skeleton metric-loading`} />
                                    : <div className="metric-val">{m.val}</div>
                                  }
                                  <div className="metric-key">{m.key}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* 6-DAY FORECAST STRIP */}
                          <div className="card" aria-label="6-day snow forecast">
                            <div className="card-title"><span aria-hidden="true">📅</span>6-Day Snow Forecast</div>
                            {scoreLoading ? (
                              <div className="skeleton" style={{height:90,borderRadius:10}} />
                            ) : forecast.length > 0 ? (
                              <div className="forecast-strip">
                                {forecast.map((d,i)=>(
                                  <div key={i} className="fc-day">
                                    <div className="fc-day-name">{d.dayLabel}</div>
                                    <div className="fc-icon" aria-hidden="true">{weatherIcon(d.conditionDesc, d.snowIn)}</div>
                                    <div className="fc-snow-val">{fmt(d.snowIn,1)}<span className="fc-snow-unit">in</span></div>
                                    {(d.tempHighF!=null||d.tempLowF!=null) && (
                                      <div className="fc-temp">{d.tempHighF!=null?`${fmt(d.tempHighF)}°`:''}{d.tempLowF!=null?` / ${fmt(d.tempLowF)}°`:''}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{color:'var(--text-3)',fontSize:13,padding:'12px 0',textAlign:'center'}}>
                                Forecast data unavailable
                              </div>
                            )}
                          </div>

                          {/* SNOWFALL CHART */}
                          <div className="card" aria-label="Forecast snowfall chart">
                            <div className="card-title"><span aria-hidden="true">📊</span>Forecast Snowfall</div>
                            {chartData.length > 0 ? (
                              <div className="chart-wrap">
                                <div className="chart-bars">
                                  {chartData.map((d,i)=>(
                                    <div key={i} className="chart-bar-col">
                                      <div className="chart-bar"
                                        style={{height:`${Math.max((d.val/chartMax)*100,4)}%`}}
                                        title={`${d.label}: ${d.val}"`} />
                                    </div>
                                  ))}
                                </div>
                                <div style={{display:'flex',gap:4,marginTop:4}}>
                                  {chartData.map((d,i)=>(
                                    <div key={i} className="chart-bar-col">
                                      <span className="chart-bar-lbl">{d.label}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="chart-empty">No forecast data</div>
                            )}
                          </div>

                          {/* ALL FAVORITES */}
                          <div>
                            <div className="section-heading"><span aria-hidden="true">⭐</span>Your Saved Mountains</div>
                            <div className="fav-grid" role="list">
                              {favorites.map(f=>(
                                <Link key={f.id} href={`/mountains/${f.mountain.id}`}
                                  className="fav-card" role="listitem"
                                  aria-label={`${f.mountain.name}, ${f.mountain.state}${f.score!=null?`, score ${f.score}`:''}`}>
                                  <img
                                    src={getMountainImage(f.mountain)}
                                    alt={f.mountain.name}
                                    className="fav-img"
                                    loading="lazy"
                                    onError={e=>{(e.target as HTMLImageElement).src=FALLBACK_IMG}}
                                  />
                                  <div className="fav-body">
                                    <div>
                                      <div className="fav-name">{f.mountain.name}</div>
                                      <div className="fav-state">{f.mountain.state}</div>
                                    </div>
                                    {f.score!=null && <ScoreBadge score={f.score} />}
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </div>

                        </div>

                        {/* RIGHT SIDEBAR */}
                        <div style={{display:'flex',flexDirection:'column',gap:14}}>

                          {/* FORECAST LIST */}
                          <div className="card" aria-label="Detailed forecast">
                            <div className="card-title"><span aria-hidden="true">❄️</span>6-Day Snow Forecast</div>
                            {scoreLoading ? (
                              [...Array(5)].map((_,i)=>(
                                <div key={i} className="skeleton" style={{height:36,marginBottom:6,borderRadius:8}} />
                              ))
                            ) : forecast.length > 0 ? (
                              forecast.map((d,i)=>(
                                <div key={i} className="fc-sidebar-row">
                                  <span className="fc-sidebar-day">{d.dayLabel}</span>
                                  <span className="fc-sidebar-icon" aria-hidden="true">{weatherIcon(d.conditionDesc,d.snowIn)}</span>
                                  <span className="fc-sidebar-desc">{d.conditionDesc || (d.snowIn>0?'Snow likely':'Clear')}</span>
                                  <span className="fc-sidebar-snow">{fmt(d.snowIn,0)}</span>
                                  <span className="fc-sidebar-unit">in</span>
                                </div>
                              ))
                            ) : (
                              <div style={{color:'var(--text-3)',fontSize:12,padding:'8px 0',textAlign:'center'}}>No data</div>
                            )}
                          </div>

                          {/* QUICK LINKS */}
                          <div className="card">
                            <div className="card-title"><span aria-hidden="true">🔗</span>Quick Links</div>
                            <div style={{display:'flex',flexDirection:'column',gap:6}}>
                              <Link href="/mountains" className="quick-link"><span>🏔️</span>Browse All Mountains</Link>
                              {activeFav && (
                                <Link href={`/mountains/${activeFav.mountain.id}`} className="quick-link"><span>📄</span>View {activeFav.mountain.name}</Link>
                              )}
                              {(userRole==='pro_user'||userRole==='admin') && <>
                                <Link href="/compare" className="quick-link"><span>📊</span>Compare Resorts</Link>
                                <Link href="/alerts"  className="quick-link"><span>🔔</span>Powder Alerts</Link>
                              </>}
                              {hasResort && (
                                <Link href="/resort/dashboard" className="quick-link highlight"><span>🎿</span>Resort Dashboard</Link>
                              )}
                            </div>
                          </div>

                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
