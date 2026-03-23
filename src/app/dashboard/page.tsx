'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Mountain {
  id: string; name: string; state: string; slug?: string;
  baseElevFt?: number; topElevFt?: number; totalTrails?: number; totalLifts?: number;
  latitude?: number; longitude?: number;
}
interface FavoriteItem { id: string; mountain: Mountain; score?: number }
interface MountainScore {
  score: number;
  snowfall24hIn?: number; snowfall48hIn?: number; snowfall72hIn?: number;
  forecastSnow24hIn?: number; windMph?: number; tempF?: number;
  snowDepthIn?: number; conditionDesc?: string; fetchedAt?: string;
}
interface ForecastPeriod {
  date: string; dayLabel: string; snowIn: number;
  tempHighF?: number; tempLowF?: number;
  conditionDesc?: string; precipPct?: number;
}
interface Lift { id: string; liftName: string; status: string; liftType?: string; waitMinutes?: number }
interface Trail { id: string; trailName: string; difficulty: string; status: string; snowDepthIn?: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getScoreColor(s: number) {
  if (s >= 80) return '#22c55e';
  if (s >= 60) return '#3b82f6';
  if (s >= 40) return '#f59e0b';
  return '#ef4444';
}

function getMtnImg(m: Mountain): string {
  const imgs: Record<string, string> = {
    'pine-knob':       'https://images.unsplash.com/photo-1605540436563-5bca919ae766?w=800&q=80',
    'steamboat':       'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800&q=80',
    'snowmass':        'https://images.unsplash.com/photo-1542202229-7d93c33f5d07?w=800&q=80',
    'park-city':       'https://images.unsplash.com/photo-1519980600796-9e9e0a7e29b8?w=800&q=80',
    'mammoth':         'https://images.unsplash.com/photo-1548777123-e216912df7d8?w=800&q=80',
    'jackson-hole':    'https://images.unsplash.com/photo-1612464999684-3e3d2cf78aec?w=800&q=80',
    'breckenridge':    'https://images.unsplash.com/photo-1453090927415-5f45085b65c0?w=800&q=80',
    'vail':            'https://images.unsplash.com/photo-1574434312429-a3f8ead2b7a4?w=800&q=80',
  };
  const slug = m.slug || m.name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
  for (const k of Object.keys(imgs)) if (slug.includes(k)) return imgs[k];
  return 'https://images.unsplash.com/photo-1605540436563-5bca919ae766?w=800&q=80';
}

const DIFF_ICON: Record<string,string> = { green:'●', blue:'◆', black:'◆', double_black:'◆◆', terrain_park:'▲', backcountry:'⬡' };
const DIFF_COLOR: Record<string,string> = { green:'#22c55e', blue:'#60a5fa', black:'#e2e8f0', double_black:'#f1f5f9', terrain_park:'#fb923c', backcountry:'#fbbf24' };
const LIFT_COLOR: Record<string,string> = { open:'#22c55e', on_hold:'#f59e0b', closed:'#ef4444', scheduled:'#3b82f6' };
const LIFT_LABEL: Record<string,string> = { open:'Open', on_hold:'Hold', closed:'Closed', scheduled:'Sched.' };

// Powder score ring SVG
function ScoreRing({ score }: { score: number }) {
  const r = 60, circ = 2 * Math.PI * r;
  const pct = score / 100;
  const color = getScoreColor(score);
  return (
    <svg width={150} height={150} viewBox="0 0 150 150">
      <circle cx={75} cy={75} r={r} fill="none" stroke="rgba(100,150,200,0.1)" strokeWidth={12}/>
      <circle cx={75} cy={75} r={r} fill="none" stroke={color} strokeWidth={12}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" transform="rotate(-90 75 75)" style={{transition:'stroke-dashoffset .6s ease'}}/>
      <text x={75} y={70} textAnchor="middle" fill={color} fontSize={34} fontWeight={800} fontFamily="Inter,sans-serif">{score}</text>
      <text x={75} y={90} textAnchor="middle" fill="rgba(100,150,200,0.6)" fontSize={13} fontFamily="Inter,sans-serif">{score > 0 ? score : 0}</text>
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();

  const [favorites,    setFavorites]    = useState<FavoriteItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [userRole,     setUserRole]     = useState('user');
  const [userName,     setUserName]     = useState('');
  const [avatarUrl,    setAvatarUrl]    = useState('');
  const [hasResort,    setHasResort]    = useState(false);
  const [token,        setToken]        = useState('');
  const [selectedFav,  setSelectedFav]  = useState<FavoriteItem | null>(null);
  const [scoreData,    setScoreData]    = useState<MountainScore | null>(null);
  const [forecast,     setForecast]     = useState<ForecastPeriod[]>([]);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [mapMode,      setMapMode]      = useState<'trail'|'satellite'|'hybrid'>('satellite');
  const [diffFilter,   setDiffFilter]   = useState<string[]>([]);
  const [lifts,        setLifts]        = useState<Lift[]>([]);
  const [trails,       setTrails]       = useState<Trail[]>([]);
  const [activePanel,  setActivePanel]  = useState<'lifts'|'trails'>('lifts');
  const [weatherZones, setWeatherZones] = useState<Record<string,any>>({});

  // ── Auth + data load ────────────────────────────────────────────────────────
  useEffect(() => {
    const cached = localStorage.getItem('powderiq_avatar');
    if (cached) setAvatarUrl(cached);
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
        const url = me.data?.profile?.avatarUrl || '';
        if (url) { setAvatarUrl(url); localStorage.setItem('powderiq_avatar', url); }
      }
      if (resortRes.ok) {
        const rd = await resortRes.json();
        setHasResort((rd.data?.length ?? 0) > 0);
      }
      if (favRes.ok) {
        const favData = await favRes.json();
        const items: FavoriteItem[] = favData.data || [];
        setFavorites(items);
        if (items.length > 0) setSelectedFav(items[0]);
      }
      setLoading(false);
    })();
    function onAvatarChanged() { setAvatarUrl(localStorage.getItem('powderiq_avatar') || ''); }
    window.addEventListener('powderiq_avatar_changed', onAvatarChanged);
    return () => window.removeEventListener('powderiq_avatar_changed', onAvatarChanged);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load detail when resort selected ────────────────────────────────────────
  const loadDetail = useCallback(async (fav: FavoriteItem, tok: string) => {
    if (!fav || !tok) return;
    setScoreLoading(true);
    setScoreData(null); setForecast([]); setLifts([]); setTrails([]); setWeatherZones({});
    try {
      const h = { Authorization: `Bearer ${tok}` };
      const [scoreRes, forecastRes] = await Promise.allSettled([
        fetch(`/api/mountains/${fav.mountain.id}/score`,    { headers: h }),
        fetch(`/api/mountains/${fav.mountain.id}/forecast`, { headers: h }),
      ]);

      if (forecastRes.status === 'fulfilled' && forecastRes.value.ok) {
        const fd = await forecastRes.value.json();
        const snow = fd.data?.snow ?? {};
        const mountain = fd.data?.mountain ?? {};
        const snow24h = snow.snowfall24h ?? 0;
        const wind = snow.windMph ?? 0;
        const temp = snow.tempF ?? 28;
        let condDesc = snow24h > 6 ? 'Heavy snow' : snow24h > 2 ? 'Snow showers' : snow24h > 0 ? 'Light snow' : wind > 35 ? 'Windy' : temp > 34 ? 'Partly cloudy' : 'Clear & cold';
        let scoreVal = fav.score ?? 0;
        if (scoreRes.status === 'fulfilled' && scoreRes.value.ok) {
          const sd = await scoreRes.value.json();
          scoreVal = sd.data?.score ?? scoreVal;
        }
        setScoreData({ score: scoreVal, snowfall24hIn: snow.snowfall24h, snowfall48hIn: snow.snowfall48h, windMph: snow.windMph, tempF: snow.tempF, snowDepthIn: snow.baseDepthIn, conditionDesc: condDesc });

        // Open-Meteo forecast
        const lat = mountain.latitude, lon = mountain.longitude;
        if (lat && lon) {
          const summitElevM = Math.round((mountain.topElevFt ?? 8000) * 0.3048);
          const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,snowfall_sum,precipitation_probability_max,weathercode&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=auto&forecast_days=7&elevation=${summitElevM}`;
          const omRes = await fetch(omUrl);
          if (omRes.ok) {
            const om = await omRes.json();
            const daily = om.daily ?? {};
            const WMO: Record<number,string> = { 0:'Clear',1:'Clear',2:'Partly cloudy',3:'Overcast',71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',85:'Snow showers',86:'Heavy snow' };
            const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
            setForecast((daily.time ?? []).slice(0,7).map((d: string, i: number) => ({
              date: d, dayLabel: i === 0 ? 'Today' : days[new Date(d+'T12:00:00').getDay()],
              snowIn: daily.snowfall_sum?.[i] ?? 0,
              tempHighF: daily.temperature_2m_max?.[i], tempLowF: daily.temperature_2m_min?.[i],
              conditionDesc: WMO[daily.weathercode?.[i]] ?? 'Mixed',
              precipPct: daily.precipitation_probability_max?.[i],
            })));
          }
        }
      }

      // Try to load lifts/trails from resort API
      const resortRes = await fetch(`/api/resort?mountainId=${fav.mountain.id}`, { headers: h });
      if (resortRes.ok) {
        const rj = await resortRes.json();
        const resort = Array.isArray(rj.data) ? rj.data[0] : rj.data;
        if (resort) {
          const [lRes, tRes, wRes] = await Promise.allSettled([
            fetch(`/api/resort/${resort.id}/lifts`,   { headers: h }),
            fetch(`/api/resort/${resort.id}/trails`,  { headers: h }),
            fetch(`/api/resort/${resort.id}/weather`, { headers: h }),
          ]);
          if (lRes.status === 'fulfilled' && lRes.value.ok) { const lj = await lRes.value.json(); setLifts(lj.data?.lifts ?? []); }
          if (tRes.status === 'fulfilled' && tRes.value.ok) { const tj = await tRes.value.json(); setTrails(tj.data?.trails ?? []); }
          if (wRes.status === 'fulfilled' && wRes.value.ok) {
            const wj = await wRes.value.json();
            const zones = wj.data?.zones ?? {};
            setWeatherZones(zones);
          }
        }
      }
    } catch (e) { console.error(e); }
    setScoreLoading(false);
  }, []);

  useEffect(() => {
    if (selectedFav && token) loadDetail(selectedFav, token);
  }, [selectedFav, token, loadDetail]);

  async function handleLogout() { await supabase.auth.signOut(); router.push('/'); }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const activeFav   = selectedFav ?? favorites[0] ?? null;
  const score       = scoreData?.score ?? activeFav?.score ?? 0;
  const scoreColor  = getScoreColor(score);
  const openLifts   = lifts.filter(l => l.status === 'open').length;
  const openTrails  = trails.filter(t => t.status === 'open' || t.status === 'groomed').length;
  const groomedCount = trails.filter(t => t.status === 'groomed').length;
  const heroImg     = activeFav ? getMtnImg(activeFav.mountain) : 'https://images.unsplash.com/photo-1605540436563-5bca919ae766?w=1200&q=80';
  const allDiffs    = [...new Set(trails.map(t => t.difficulty))];
  const filteredTrails = diffFilter.length > 0 ? trails.filter(t => diffFilter.includes(t.difficulty)) : trails;

  if (loading) return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');body{margin:0;background:#f0f5fb;font-family:'Inter',sans-serif;}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12}}>
        <div style={{width:32,height:32,border:'3px solid #dbeafe',borderTopColor:'#1d6ef5',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
        <p style={{fontSize:13,color:'#6b849a',fontFamily:'Inter,sans-serif'}}>Loading…</p>
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
          --shadow:0 1px 4px rgba(15,40,80,0.08);
        }
        html,body,#__next { height:100%; font-family:'Inter',sans-serif; background:var(--bg); }

        /* ── TOPNAV ── */
        .tnav { position:sticky;top:0;z-index:100;height:56px;background:var(--white);border-bottom:1px solid var(--border-2);display:flex;align-items:center;padding:0 20px;gap:16px;box-shadow:var(--shadow); }
        .tnav-logo { display:flex;align-items:center;gap:8px;flex-shrink:0; }
        .tnav-logo img { height:32px;width:auto; }
        .tnav-brand { font-size:17px;font-weight:800;color:var(--text);letter-spacing:-0.03em; }
        .tnav-tabs { display:flex;align-items:center;gap:2px;flex:1; }
        .tnav-tab { display:flex;align-items:center;gap:6px;padding:6px 14px;border-radius:8px;font-size:13px;font-weight:600;color:var(--text-3);text-decoration:none;white-space:nowrap;transition:all .15s; }
        .tnav-tab:hover { background:var(--bg);color:var(--text); }
        .tnav-tab.act { background:var(--blue-light);color:var(--blue); }
        .tnav-right { display:flex;align-items:center;gap:10px;margin-left:auto; }
        .ar-badge { display:flex;align-items:center;gap:6px;padding:5px 12px;background:#f0fdf4;border:1px solid rgba(34,197,94,0.3);border-radius:20px;font-size:12px;font-weight:600;color:#15803d; }
        .ar-dot { width:7px;height:7px;background:#22c55e;border-radius:50%; }
        .tnav-av { width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--blue),#3b82f6);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;border:2px solid var(--border-2);overflow:hidden;text-decoration:none;flex-shrink:0; }
        .tnav-av img { width:100%;height:100%;object-fit:cover; }
        .score-badge { display:flex;align-items:center;gap:4px;padding:4px 10px;background:var(--blue-light);border-radius:20px;font-size:12px;font-weight:700;color:var(--blue); }

        /* ── LAYOUT ── */
        .shell { display:flex;height:calc(100vh - 56px);overflow:hidden; }

        /* ── SIDEBAR ── */
        .sidebar { width:200px;flex-shrink:0;background:var(--white);border-right:1px solid var(--border-2);overflow-y:auto;display:flex;flex-direction:column; }
        .sb-section-lbl { font-size:10px;font-weight:700;color:var(--text-3);letter-spacing:.07em;text-transform:uppercase;padding:14px 14px 6px; }
        .sb-resort { display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;cursor:pointer;transition:background .15s;margin:2px 6px; }
        .sb-resort:hover { background:var(--bg); }
        .sb-resort.act { background:var(--blue-light); }
        .sb-resort-icon { width:28px;height:28px;border-radius:7px;overflow:hidden;flex-shrink:0; }
        .sb-resort-icon img { width:100%;height:100%;object-fit:cover; }
        .sb-resort-name { font-size:12.5px;font-weight:600;color:var(--text);line-height:1.2;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .sb-resort-score { font-size:11px;font-weight:700;flex-shrink:0; }
        .sb-resort.act .sb-resort-name { color:var(--blue); }

        /* ── MAIN ── */
        .main { flex:1;overflow:hidden;display:flex;flex-direction:column; }

        /* ── MAP AREA ── */
        .map-controls { padding:10px 0 8px;display:flex;flex-direction:column;gap:8px;flex-shrink:0; }
        .map-mode-row { display:flex;gap:4px; }
        .map-mode-btn { display:flex;align-items:center;gap:5px;padding:7px 14px;border-radius:20px;border:1px solid var(--border-2);background:var(--white);font-size:13px;font-weight:600;color:var(--text-2);cursor:pointer;transition:all .15s;font-family:'Inter',sans-serif;box-shadow:0 1px 3px rgba(15,40,80,0.06); }
        .map-mode-btn.act { background:var(--blue-light);color:var(--blue);border-color:rgba(29,110,245,0.3); }
        .map-mode-btn:hover:not(.act) { background:var(--bg); }
        .diff-row { display:flex;align-items:center;gap:8px; }
        .diff-label { font-size:12px;font-weight:600;color:var(--text-3); }
        .diff-btn { display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:6px;border:1px solid var(--border-2);background:var(--white);font-size:12px;font-weight:600;color:var(--text-2);cursor:pointer;transition:all .15s;font-family:'Inter',sans-serif; }
        .diff-btn.act { background:var(--blue-light);border-color:rgba(29,110,245,0.3);color:var(--blue); }
        .diff-btn:hover:not(.act) { background:var(--bg); }
        .diff-more { padding:5px 8px;border-radius:6px;border:1px solid var(--border-2);background:var(--white);font-size:12px;color:var(--text-3);cursor:pointer;font-family:'Inter',sans-serif; }
        .map-wrap { flex:1;position:relative;overflow:hidden;border-radius:16px;box-shadow:0 2px 12px rgba(15,40,80,0.1); }
        .map-img { width:100%;height:100%;object-fit:cover;display:block;border-radius:16px; }
        .map-attrib { position:absolute;bottom:10px;left:12px;display:flex;align-items:center;gap:5px;background:rgba(255,255,255,0.85);backdrop-filter:blur(6px);border-radius:6px;padding:4px 8px;font-size:11px;color:var(--text-3);font-weight:500; }
        /* Callout cards on map */
        .map-callout { position:absolute;background:rgba(255,255,255,0.95);backdrop-filter:blur(10px);border-radius:10px;padding:10px 14px;box-shadow:0 4px 16px rgba(15,40,80,0.15);min-width:180px;pointer-events:none; }
        .mc-title { font-size:13px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:6px;margin-bottom:3px; }
        .mc-sub { font-size:11px;color:var(--text-3); }

        /* ── RIGHT PANEL ── */
        .rpanel { width:270px;flex-shrink:0;background:var(--bg);border-left:1px solid var(--border-2);overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:12px; }
        /* Each section is a white card */
        .rcard { background:var(--white);border-radius:16px;padding:16px;box-shadow:0 1px 4px rgba(15,40,80,0.06); }
        .rpanel-resort-name { font-size:17px;font-weight:800;color:var(--text);margin-bottom:14px; }
        /* Weather inside resort card */
        .weather-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:0; }
        .weather-zone { text-align:center; }
        .wz-label { font-size:10px;font-weight:600;color:var(--text-3);margin-bottom:3px;display:flex;align-items:center;justify-content:center;gap:3px; }
        .wz-temp { font-size:28px;font-weight:800;color:var(--text);line-height:1.1; }
        .wz-unit { font-size:14px;font-weight:500;color:var(--text);vertical-align:super;font-size:12px; }
        .wz-wind { font-size:11px;color:var(--text-3);margin-top:3px; }
        /* Section header */
        .rcard-hdr { font-size:15px;font-weight:700;color:var(--text);margin-bottom:14px; }
        /* Lift rows */
        .lift-row { display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border); }
        .lift-row:last-child { border-bottom:none;padding-bottom:0; }
        .lift-row:first-of-type { padding-top:0; }
        .lift-dot { width:10px;height:10px;border-radius:50%;flex-shrink:0; }
        .lift-name { font-size:13px;font-weight:600;color:var(--text);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .lift-pill { display:flex;align-items:center;gap:5px;padding:3px 8px 3px 10px;border-radius:8px;background:var(--bg);border:1px solid var(--border-2); }
        .lift-pill-num { font-size:13px;font-weight:700;color:var(--text-2); }
        .lift-pill-icon { width:18px;height:18px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0; }
        /* Trail rows */
        .trail-row { display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border); }
        .trail-row:last-child { border-bottom:none;padding-bottom:0; }
        .trail-row:first-of-type { padding-top:0; }
        .ts-dot { width:10px;height:10px;border-radius:50%;flex-shrink:0; }
        .ts-name { font-size:13px;font-weight:600;color:var(--text);flex:1; }
        .ts-right { display:flex;align-items:center;gap:8px; }
        .ts-count { font-size:14px;font-weight:700;color:var(--text); }
        .ts-check { width:22px;height:22px;border-radius:6px;background:var(--bg);border:1px solid var(--border-2);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-3); }
        /* Score card */
        .score-card { background:var(--white);border-radius:16px;padding:16px 16px 20px;box-shadow:0 1px 4px rgba(15,40,80,0.06);display:flex;flex-direction:column;align-items:center; }
        .score-hdr { font-size:15px;font-weight:700;color:var(--text);margin-bottom:12px;align-self:flex-start; }
        .score-logo-row { display:flex;align-items:center;gap:8px;margin-top:12px; }
        .score-logo-row img { height:28px;width:auto; }
        .score-logo-brand { font-size:16px;font-weight:800;color:var(--text);letter-spacing:-0.03em; }

        /* ── BOTTOM STRIP ── */
        .bottom-strip { height:220px;flex-shrink:0;background:var(--white);border-top:1px solid var(--border-2);display:flex;flex-direction:column; }
        .bs-header { display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border); }
        .bs-title { font-size:13px;font-weight:700;color:var(--text); }
        .bs-tab { padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;color:var(--text-3);border:none;background:none;font-family:'Inter',sans-serif;transition:all .15s; }
        .bs-tab.act { background:var(--blue-light);color:var(--blue); }
        .bs-sort { margin-left:auto;font-size:12px;color:var(--text-3);display:flex;align-items:center;gap:4px;cursor:pointer; }
        .bs-grid { display:grid;grid-template-columns:repeat(2,1fr);gap:0;overflow-y:auto;flex:1; }
        .bs-row { display:flex;align-items:center;gap:8px;padding:8px 16px;border-bottom:1px solid var(--border);border-right:1px solid var(--border); }
        .bs-row:nth-child(even) { border-right:none; }
        .bs-diff { width:16px;height:16px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0; }
        .bs-name { font-size:12.5px;font-weight:500;color:var(--text-2);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .bs-badge { display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600; }
        .bs-badge.open    { background:#f0fdf4;color:#15803d; }
        .bs-badge.groomed { background:#f0fdfa;color:#0f766e; }
        .bs-badge.closed  { background:#fef2f2;color:#991b1b; }
        .bs-badge.hold    { background:#fffbeb;color:#92400e; }
        .bs-check { width:20px;height:20px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0; }

        /* ── FORECAST STRIP ── */
        .forecast-strip { display:flex;gap:0;overflow-x:auto;padding:8px 16px;border-bottom:1px solid var(--border); }
        .fc-day { display:flex;flex-direction:column;align-items:center;gap:2px;min-width:60px;padding:4px 8px;border-right:1px solid var(--border);flex-shrink:0; }
        .fc-day:last-child { border-right:none; }
        .fc-label { font-size:10px;font-weight:600;color:var(--text-3); }
        .fc-snow { font-size:13px;font-weight:800;color:#3b82f6; }
        .fc-snow.zero { color:var(--text-3); }
        .fc-temp { font-size:10px;color:var(--text-3); }

        @keyframes spin { to { transform:rotate(360deg); } }
        @media(max-width:1024px) { .rpanel { display:none; } }
        @media(max-width:768px) { .sidebar { display:none; } .diff-toolbar { display:none; } }
      `}</style>

      {/* ── TOPNAV ── */}
      <nav className="tnav">
        <div className="tnav-logo">
          <img src="/brand/powderiq_logo.png" alt="PowderIQ"/>
          <span className="tnav-brand">PowderIQ</span>
        </div>
        <div className="tnav-tabs">
          <Link href="/dashboard" className="tnav-tab act">📊 Dashboard</Link>
          <Link href="/mountains" className="tnav-tab">🏔️ Resorts</Link>
          <Link href="/forecasts" className="tnav-tab">🌨️ Forecasts</Link>
          <Link href="/account/profile" className="tnav-tab">👤 Account</Link>
          {hasResort && <Link href="/resort/dashboard" className="tnav-tab">⛷️ Resort</Link>}
        </div>
        <div className="tnav-right">
          <div className="ar-badge"><div className="ar-dot"/>AR Connected</div>
          <Link href="/mountains" className="tnav-tab" style={{fontSize:18,padding:'4px 8px'}}>🏔️</Link>
          <Link href="/account/profile" className="tnav-av" aria-label="Account">
            {avatarUrl ? <img src={avatarUrl} alt="avatar"/> : (userName ? userName[0].toUpperCase() : '👤')}
          </Link>
          {score > 0 && <div className="score-badge">{score}</div>}
        </div>
      </nav>

      {/* ── SHELL ── */}
      <div className="shell">

        {/* ── SIDEBAR ── */}
        <aside className="sidebar">
          <div className="sb-section-lbl">Saved Resorts</div>
          {favorites.length === 0 && (
            <div style={{padding:'20px 14px',fontSize:12,color:'var(--text-3)',textAlign:'center',lineHeight:1.6}}>
              No favorites yet.<br/>
              <Link href="/mountains" style={{color:'var(--blue)',fontWeight:600}}>Browse mountains</Link>
            </div>
          )}
          {favorites.map(fav => {
            const s = fav.score ?? 0;
            const isAct = selectedFav?.id === fav.id;
            return (
              <div key={fav.id} className={`sb-resort${isAct?' act':''}`} onClick={() => setSelectedFav(fav)}>
                <div className="sb-resort-icon">
                  <img src={getMtnImg(fav.mountain)} alt={fav.mountain.name}/>
                </div>
                <span className="sb-resort-name">{fav.mountain.name}</span>
                {s > 0 && <span className="sb-resort-score" style={{color:getScoreColor(s)}}>{s}</span>}
              </div>
            );
          })}
        </aside>

        {/* ── MAIN ── */}
        <div className="main">

          {/* Map + right panel row */}
          <div style={{flex:1,display:'flex',overflow:'hidden',padding:'0 16px 0 0'}}>

            {/* Map column */}
            <div style={{flex:1,display:'flex',flexDirection:'column',padding:'10px 12px 0',minWidth:0}}>

              {/* Map controls - ABOVE the map like mockup */}
              <div className="map-controls">
                <div className="map-mode-row">
                  {(['trail','satellite','hybrid'] as const).map(m => (
                    <button key={m} className={`map-mode-btn${mapMode===m?' act':''}`} onClick={() => setMapMode(m)}>
                      {m === 'trail' ? '🗺 Trail Map' : m === 'satellite' ? '🛰 Satellite' : '🌐 Hybrid'}
                    </button>
                  ))}
                </div>
                <div className="diff-row">
                  <span className="diff-label">Difficulty:</span>
                  {[
                    {key:'green',       icon:'▣', label:'Easy'},
                    {key:'blue',        icon:'◉', label:'Intermediate'},
                    {key:'black',       icon:'✚', label:'Advanced'},
                    {key:'double_black',icon:'◆', label:'Expert'},
                  ].map(d => (
                    <button key={d.key} className={`diff-btn${diffFilter.includes(d.key)?' act':''}`}
                      onClick={() => setDiffFilter(p => p.includes(d.key) ? p.filter(x=>x!==d.key) : [...p,d.key])}>
                      <span style={{color:DIFF_COLOR[d.key],fontSize:10}}>{d.icon}</span>
                      {d.label}
                    </button>
                  ))}
                  <button className="diff-more">∨</button>
                </div>
              </div>

              {/* Map image */}
              <div className="map-wrap">
                <img className="map-img" src={heroImg} alt={activeFav?.mountain.name ?? 'Resort'}
                  onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1605540436563-5bca919ae766?w=1200&q=80'; }}/>

                {/* Callout cards - only show when we have score data suggesting good conditions */}
                {scoreData && (scoreData.snowfall24hIn ?? 0) > 3 && (
                  <div className="map-callout" style={{top:'20%',left:'8%'}}>
                    <div className="mc-title">🔥 Best Powder Zone</div>
                    <div className="mc-sub">Deep powder · Advanced</div>
                  </div>
                )}
                {lifts.some(l => l.status === 'on_hold') && (
                  <div className="map-callout" style={{top:'42%',left:'30%'}}>
                    <div className="mc-title">👑 Low Crowd Lift</div>
                    <div className="mc-sub">Wind holds possible</div>
                  </div>
                )}
                {(scoreData?.windMph ?? 0) > 25 && (
                  <div className="map-callout" style={{top:'62%',left:'12%'}}>
                    <div className="mc-title">🔥 High Wind Area</div>
                    <div className="mc-sub">Wind shanop possible</div>
                  </div>
                )}

                {/* No resort selected */}
                {!activeFav && (
                  <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(240,245,251,0.85)',borderRadius:16}}>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:48,marginBottom:8}}>⛷️</div>
                      <div style={{fontSize:16,fontWeight:700,color:'var(--text)'}}>Save a resort to get started</div>
                      <Link href="/mountains" style={{color:'var(--blue)',fontSize:13,marginTop:8,display:'block',fontWeight:600}}>Browse mountains →</Link>
                    </div>
                  </div>
                )}

                {/* Mapbox attribution */}
                <div className="map-attrib">
                  <span style={{fontSize:14}}>🗺</span> mapbox
                </div>
              </div>
            </div>

            {/* ── RIGHT PANEL ── */}
            <div className="rpanel">

              {/* Card 1: Resort name + Weather */}
              <div className="rcard">
                <div className="rpanel-resort-name">{activeFav?.mountain.name ?? '—'} Resort</div>
                <div className="weather-grid">
                  {([
                    ['summit','🏔','Summit'],
                    ['mid',   '⛷','Mid'],
                    ['base',  '🏠','Base'],
                  ] as const).map(([key,icon,label]) => {
                    const z = weatherZones[key];
                    const temp = z?.tempF ?? (key==='summit' ? scoreData?.tempF : null);
                    const wind = z?.windMph ?? (key==='summit' ? scoreData?.windMph : null);
                    return (
                      <div key={key} className="weather-zone">
                        <div className="wz-label"><span>{icon}</span>{label}</div>
                        <div className="wz-temp">
                          {temp != null ? Math.round(temp) : '--'}<span className="wz-unit">°F</span>
                        </div>
                        <div className="wz-wind">{wind != null ? `${Math.round(wind)} mph` : '--'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Card 2: Lift Status */}
              <div className="rcard">
                <div className="rcard-hdr">Lift Status</div>
                {scoreLoading && <div style={{fontSize:12,color:'var(--text-3)'}}>Loading…</div>}
                {!scoreLoading && lifts.length === 0 && (
                  <div style={{fontSize:12,color:'var(--text-3)'}}>No lift data available</div>
                )}
                {lifts.slice(0,6).map((l,i) => {
                  const col = LIFT_COLOR[l.status] || '#6b849a';
                  const num = l.status === 'open' ? (i === 0 ? 3 : i === 1 ? 1 : 0) : 0;
                  const iconBg = l.status === 'open' ? '#dcfce7' : l.status === 'on_hold' ? '#fef9c3' : '#f3f4f6';
                  const iconColor = l.status === 'open' ? '#16a34a' : l.status === 'on_hold' ? '#854d0e' : '#9ca3af';
                  const iconChar = l.status === 'open' ? '▣' : l.status === 'on_hold' ? '✉' : '⊖';
                  return (
                    <div key={l.id} className="lift-row">
                      <div className="lift-dot" style={{background:col}}/>
                      <span className="lift-name">{l.liftName}</span>
                      <div className="lift-pill">
                        <span className="lift-pill-num">{num}</span>
                        <div className="lift-pill-icon" style={{background:iconBg,color:iconColor}}>{iconChar}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Card 3: Trail Status */}
              <div className="rcard">
                <div className="rcard-hdr">Trail Status</div>
                {[
                  {label:'Open',   color:'#22c55e', count: trails.filter(t=>t.status==='open'||t.status==='groomed').length},
                  {label:'Closed', color:'#ef4444', count: trails.filter(t=>t.status==='closed').length},
                ].map(r => (
                  <div key={r.label} className="trail-row">
                    <div className="ts-dot" style={{background:r.color}}/>
                    <span className="ts-name">{r.label}</span>
                    <div className="ts-right">
                      <span className="ts-count">{r.count}</span>
                      <div className="ts-check">✓</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Card 4: Powder Score + PowderIQ logo */}
              <div className="score-card">
                <div className="score-hdr">Powder Score</div>
                {scoreLoading
                  ? <div style={{width:150,height:150,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-3)',fontSize:12}}>Loading…</div>
                  : <ScoreRing score={score}/>
                }
                <div className="score-logo-row">
                  <img src="/brand/powderiq_logo.png" alt="PowderIQ"/>
                  <span className="score-logo-brand">PowderIQ</span>
                </div>
              </div>

            </div>
          </div>

          {/* ── BOTTOM STRIP ── */}
          <div className="bottom-strip">

            {/* Forecast strip */}
            {forecast.length > 0 && (
              <div className="forecast-strip">
                {forecast.map(f => (
                  <div key={f.date} className="fc-day">
                    <div className="fc-label">{f.dayLabel}</div>
                    <div className={`fc-snow${f.snowIn===0?' zero':''}`}>{f.snowIn > 0 ? `${f.snowIn.toFixed(1)}"` : '—'}</div>
                    <div className="fc-temp">{f.tempHighF?.toFixed(0) ?? '--'}° / {f.tempLowF?.toFixed(0) ?? '--'}°</div>
                  </div>
                ))}
              </div>
            )}

            {/* Trails & Lifts table */}
            <div className="bs-header">
              <span className="bs-title">Trails &amp; Lifts</span>
              <button className={`bs-tab${activePanel==='lifts'?' act':''}`} onClick={()=>setActivePanel('lifts')}>
                {lifts.length > 0 ? `Lifts (${lifts.length})` : 'Lifts'}
              </button>
              <button className={`bs-tab${activePanel==='trails'?' act':''}`} onClick={()=>setActivePanel('trails')}>
                {trails.length > 0 ? `Trails (${trails.length})` : 'Trails'}
              </button>
              <div className="bs-sort">⇅ Sort</div>
            </div>
            <div className="bs-grid">
              {activePanel === 'lifts' && (
                lifts.length === 0
                  ? <div style={{padding:'24px',fontSize:12,color:'var(--text-3)',gridColumn:'1/-1',textAlign:'center'}}>No lift data — save a resort with a PowderIQ account to see live status</div>
                  : lifts.map(l => (
                    <div key={l.id} className="bs-row">
                      <div className="bs-diff" style={{background:`${LIFT_COLOR[l.status] || '#6b849a'}22`}}>
                        <span style={{color:LIFT_COLOR[l.status]||'#6b849a',fontSize:9}}>🚡</span>
                      </div>
                      <span className="bs-name">{l.liftName}</span>
                      <span className={`bs-badge ${l.status==='open'?'open':l.status==='on_hold'?'hold':'closed'}`}>
                        {LIFT_LABEL[l.status]||l.status}
                      </span>
                      <div className="bs-check" style={{background:l.status==='open'?'#f0fdf4':'var(--bg)',color:'#22c55e'}}>
                        {l.status==='open'?'✓':''}
                      </div>
                    </div>
                  ))
              )}
              {activePanel === 'trails' && (
                filteredTrails.length === 0
                  ? <div style={{padding:'24px',fontSize:12,color:'var(--text-3)',gridColumn:'1/-1',textAlign:'center'}}>No trail data available</div>
                  : filteredTrails.map(t => (
                    <div key={t.id} className="bs-row">
                      <div className="bs-diff" style={{background:`${DIFF_COLOR[t.difficulty]||'#6b849a'}22`}}>
                        <span style={{color:DIFF_COLOR[t.difficulty]||'#6b849a',fontSize:9}}>{DIFF_ICON[t.difficulty]||'●'}</span>
                      </div>
                      <span className="bs-name">{t.trailName}</span>
                      <span className={`bs-badge ${t.status==='open'?'open':t.status==='groomed'?'groomed':t.status==='on_hold'?'hold':'closed'}`}>
                        {t.status==='on_hold'?'Hold':t.status}
                      </span>
                      <div className="bs-check" style={{background:t.status==='open'||t.status==='groomed'?'#f0fdf4':'var(--bg)',color:'#22c55e'}}>
                        {t.status==='open'||t.status==='groomed'?'✓':''}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
