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


// ── Liftie helpers ────────────────────────────────────────────────────────────

const LIFTIE_SLUGS: Record<string, string> = {
  // Colorado
  'vail': 'vail', 'vail mountain': 'vail',
  'beaver creek': 'beavercreek',
  'breckenridge': 'breck',
  'keystone': 'keystone',
  'arapahoe basin': 'abasin',
  'copper mountain': 'copper',
  'steamboat': 'steamboat', 'steamboat springs': 'steamboat', 'steamboat ski resort': 'steamboat',
  'winter park': 'winterpark', 'winter park resort': 'winterpark',
  'loveland': 'loveland', 'loveland ski area': 'loveland',
  'crested butte': 'crestedbutte', 'crested butte mountain resort': 'crestedbutte',
  'telluride': 'telluride',
  'aspen mountain': 'aspen',
  'aspen highlands': 'highlands',
  'snowmass': 'snowmass', 'aspen snowmass': 'snowmass',
  'buttermilk': 'buttermilk',
  'purgatory': 'purgatory', 'purgatory resort': 'purgatory',
  'wolf creek': 'wolfcreek', 'wolf creek ski area': 'wolfcreek',
  'monarch': 'monarch', 'monarch mountain': 'monarch',
  'eldora': 'eldora', 'eldora mountain resort': 'eldora',
  // Utah
  'alta': 'alta',
  'snowbird': 'snowbird',
  'park city': 'parkcity', 'park city mountain': 'parkcity', 'park city mountain resort': 'parkcity',
  'deer valley': 'deervalley', 'deer valley resort': 'deervalley',
  'solitude': 'solitude', 'solitude mountain resort': 'solitude',
  'brighton': 'brighton', 'brighton resort': 'brighton',
  'sundance': 'sundance', 'sundance mountain resort': 'sundance',
  // Wyoming
  'jackson hole': 'jacksonhole', 'jackson hole mountain resort': 'jacksonhole',
  'grand targhee': 'grandtarghee', 'grand targhee resort': 'grandtarghee',
  // Montana
  'big sky': 'bigsky', 'big sky resort': 'bigsky',
  'moonlight basin': 'moonlightbasin',
  'whitefish': 'whitefish', 'whitefish mountain resort': 'whitefish',
  // California
  'mammoth mountain': 'mammoth', 'mammoth': 'mammoth',
  'heavenly': 'heavenly', 'heavenly mountain resort': 'heavenly',
  'northstar': 'northstar', 'northstar california': 'northstar',
  'kirkwood': 'kirkwood', 'kirkwood mountain resort': 'kirkwood',
  'palisades tahoe': 'squaw', 'squaw valley': 'squaw',
  'sugar bowl': 'sugarbowl', 'sugar bowl resort': 'sugarbowl',
  'boreal': 'boreal', 'boreal mountain resort': 'boreal',
  'sierra at tahoe': 'sierra', 'sierra-at-tahoe': 'sierra',
  'mt. rose': 'mtrose', 'mount rose': 'mtrose',
  // Oregon / Washington
  'mt. bachelor': 'mtbachelor', 'mount bachelor': 'mtbachelor',
  'mount hood meadows': 'meadows',
  'timberline': 'timberline', 'timberline lodge': 'timberline',
  'stevens pass': 'stevens',
  'crystal mountain': 'crystalmountain',
  'snoqualmie': 'snoqualmie', 'snoqualmie pass': 'snoqualmie',
  'mission ridge': 'missionridge',
  // Idaho
  'sun valley': 'sunvalley', 'sun valley resort': 'sunvalley',
  'bogus basin': 'bogusbasin',
  'brundage': 'brundage', 'brundage mountain': 'brundage',
  // New Mexico
  'taos ski valley': 'taos', 'taos': 'taos',
  'ski santa fe': 'santafe',
  'ski apache': 'skiapache',
  // Vermont
  'stowe': 'stowe', 'stowe mountain resort': 'stowe',
  'killington': 'killington', 'killington resort': 'killington',
  'sugarbush': 'sugarbush', 'sugarbush resort': 'sugarbush',
  'okemo': 'okemo', 'okemo mountain resort': 'okemo',
  'mount snow': 'mountsnow',
  'stratton': 'stratton', 'stratton mountain': 'stratton',
  'mad river glen': 'madriverglen',
  'jay peak': 'jaypeak', 'jay peak resort': 'jaypeak',
  'magic mountain': 'magic',
  // New Hampshire
  'loon mountain': 'loon', 'loon mountain resort': 'loon',
  'cannon mountain': 'cannon',
  'waterville valley': 'waterville',
  'bretton woods': 'brettonwoods',
  'attitash': 'attitash',
  // Maine
  'sunday river': 'sundayriver', 'sunday river resort': 'sundayriver',
  'sugarloaf': 'sugarloaf', 'sugarloaf mountain': 'sugarloaf',
  // New York
  'whiteface': 'whiteface', 'whiteface mountain': 'whiteface',
  'hunter mountain': 'hunter',
  'windham mountain': 'windham',
  'gore mountain': 'gore',
  'belleayre': 'belleayre',
  // Michigan
  'pine knob': 'pineknob',
  'boyne mountain': 'boynemountain',
  'boyne highlands': 'boynehighlands',
  'nubs nob': 'nubsnob',
  'shanty creek': 'shantycreek',
  'mount brighton': 'mountbrighton',
  'snow snake': 'snowsnake',
  'caberfae peaks': 'caberfae',
  'whitecap mountain': 'whitecap',
  'indianhead': 'indianhead',
  'crystal mountain': 'crystalmountainmi',
  // Canada
  'whistler blackcomb': 'whistler', 'whistler': 'whistler',
  'mont tremblant': 'tremblant', 'mont-tremblant': 'tremblant',
  'sun peaks': 'sunpeaks', 'sun peaks resort': 'sunpeaks',
  'big white': 'bigwhite', 'big white ski resort': 'bigwhite',
  'revelstoke': 'revelstoke', 'revelstoke mountain resort': 'revelstoke',
  'fernie': 'fernie', 'fernie alpine resort': 'fernie',
  'lake louise': 'lakelouise', 'ski lake louise': 'lakelouise',
  'banff sunshine': 'sunshine', 'sunshine village': 'sunshine',
  'kicking horse': 'kickinghorse',
  'red mountain': 'redmountain', 'red mountain resort': 'redmountain',
};

function deriveLiftieSlug(name: string): string {
  const lower = name.toLowerCase().trim();
  if (LIFTIE_SLUGS[lower]) return LIFTIE_SLUGS[lower];
  // Strip common suffixes and try the lookup again
  const stripped = lower
    .replace(/\s*(ski resort|mountain resort|ski area|resort|mountain|ski|mtn\.?|springs|peak|peaks|valley|village)\s*/g, ' ')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
  if (LIFTIE_SLUGS[stripped]) return LIFTIE_SLUGS[stripped];
  return stripped;
}

function inferLiftType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('gondola') || n.includes('cable car')) return 'gondola';
  if (n.includes('tram') || n.includes('aerial')) return 'tram';
  if (n.includes('carpet') || n.includes('conveyor') || n.includes('t-bar')) return 'surface';
  return 'chairlift';
}

function mapLiftieStatus(s: string): 'open' | 'on_hold' | 'closed' | 'scheduled' {
  switch (s?.toLowerCase()) {
    case 'open':      return 'open';
    case 'hold':
    case 'on_hold':   return 'on_hold';
    case 'scheduled': return 'scheduled';
    default:          return 'closed';
  }
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
  const [liftieStats,  setLiftieStats]  = useState<{open:number;hold:number;scheduled:number;closed:number}|null>(null);
  const [trails,       setTrails]       = useState<Trail[]>([]);
  const [activePanel,  setActivePanel]  = useState<'lifts'|'trails'>('trails');
  const [sortBy,       setSortBy]       = useState<'name'|'difficulty'>('name');
  const [sortDir,      setSortDir]      = useState<'asc'|'desc'>('asc');
  const [sortOpen,     setSortOpen]     = useState(false);
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
    setScoreData(null); setForecast([]); setLifts([]); setTrails([]); setWeatherZones({}); setLiftieStats(null);
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

      // Try resort API first (resorts with PowderIQ accounts have full data)
      const resortRes = await fetch(`/api/resort?mountainId=${fav.mountain.id}`, { headers: h });
      let hasResortData = false;
      if (resortRes.ok) {
        const rj = await resortRes.json();
        const resort = Array.isArray(rj.data) ? rj.data[0] : rj.data;
        if (resort) {
          const [lRes, tRes, wRes] = await Promise.allSettled([
            fetch(`/api/resort/${resort.id}/lifts`,   { headers: h }),
            fetch(`/api/resort/${resort.id}/trails`,  { headers: h }),
            fetch(`/api/resort/${resort.id}/weather`, { headers: h }),
          ]);
          if (lRes.status === 'fulfilled' && lRes.value.ok) {
            const lj = await lRes.value.json();
            const liftList = lj.data?.lifts ?? [];
            if (liftList.length > 0) { setLifts(liftList); hasResortData = true; }
          }
          if (tRes.status === 'fulfilled' && tRes.value.ok) {
            const tj = await tRes.value.json();
            const trailList = tj.data?.trails ?? [];
            if (trailList.length > 0) setTrails(trailList);
          }
          if (wRes.status === 'fulfilled' && wRes.value.ok) {
            const wj = await wRes.value.json();
            setWeatherZones(wj.data?.zones ?? {});
          }
        }
      }

      // Fallback: fetch live lift status from Liftie.info (covers ~400 resorts, no auth needed)
      if (!hasResortData) {
        try {
          const slug = deriveLiftieSlug(fav.mountain.name);
          const liftieRes = await fetch(`/api/lifts/${slug}`);
          if (liftieRes.ok) {
            const liftieData = await liftieRes.json();
            const liftList = liftieData.lifts ?? [];
            if (liftList.length > 0) setLifts(liftList);
            if (liftieData.stats) setLiftieStats(liftieData.stats);
          }
        } catch (e) {
          console.warn('[Liftie] fetch failed:', e);
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

  const DIFF_ORDER: Record<string,number> = { green:0, blue:1, black:2, double_black:3, terrain_park:4, backcountry:5 };

  const sortedTrails = [...filteredTrails].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'name') cmp = a.trailName.localeCompare(b.trailName);
    else cmp = (DIFF_ORDER[a.difficulty] ?? 9) - (DIFF_ORDER[b.difficulty] ?? 9);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const sortedLifts = [...lifts].sort((a, b) => {
    const cmp = a.liftName.localeCompare(b.liftName);
    return sortDir === 'asc' ? cmp : -cmp;
  });

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
          --blue:#1d6ef5; --blue-light:#e8f1fe; --blue-dark:#1558d6;
          --text:#0d1b2e; --text-2:#3d5166; --text-3:#6b849a;
          --border:rgba(100,150,200,0.15); --border-2:rgba(100,150,200,0.25);
          --bg:#f0f5fb; --white:#ffffff;
          --green:#22c55e; --green-bg:#f0fdf4;
          --amber:#f59e0b; --amber-bg:#fffbeb;
          --red:#ef4444; --red-bg:#fef2f2;
          --shadow:0 1px 4px rgba(15,40,80,0.08);
          --shadow-md:0 4px 16px rgba(15,40,80,0.10);
        }
        html,body,#__next { height:100%; font-family:'Inter',sans-serif; background:var(--bg); color:var(--text); }

        /* ── TOPNAV ── */
        .tnav { position:sticky;top:0;z-index:100;height:52px;background:var(--white);border-bottom:1px solid var(--border-2);display:flex;align-items:center;padding:0 20px;gap:16px;box-shadow:var(--shadow); }
        .tnav-logo { display:flex;align-items:center;gap:8px;flex-shrink:0; }
        .tnav-logo img { height:30px;width:auto; }
        .tnav-brand { font-size:16px;font-weight:800;color:var(--text);letter-spacing:-0.03em; }
        .tnav-tabs { display:flex;align-items:center;gap:2px;flex:1; }
        .tnav-tab { display:flex;align-items:center;gap:6px;padding:6px 13px;border-radius:8px;font-size:13px;font-weight:600;color:var(--text-3);text-decoration:none;white-space:nowrap;transition:all .15s; }
        .tnav-tab:hover { background:var(--bg);color:var(--text); }
        .tnav-tab.act { background:var(--blue-light);color:var(--blue); }
        .tnav-right { display:flex;align-items:center;gap:8px;margin-left:auto; }
        .api-badge { display:flex;align-items:center;gap:5px;padding:4px 10px;background:var(--green-bg);border:1px solid rgba(34,197,94,0.3);border-radius:20px;font-size:11px;font-weight:600;color:#15803d; }
        .api-dot { width:6px;height:6px;background:var(--green);border-radius:50%; }
        .tnav-av { width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--blue),#3b82f6);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;border:2px solid var(--border-2);overflow:hidden;text-decoration:none;flex-shrink:0; }
        .tnav-av img { width:100%;height:100%;object-fit:cover; }

        /* ── SHELL ── */
        .shell { display:flex;height:calc(100vh - 52px);overflow:hidden; }

        /* ── LEFT SIDEBAR ── */
        .sidebar { width:190px;flex-shrink:0;background:var(--white);border-right:1px solid var(--border-2);overflow-y:auto;display:flex;flex-direction:column; }
        .sb-lbl { font-size:10px;font-weight:700;color:var(--text-3);letter-spacing:.08em;text-transform:uppercase;padding:14px 14px 6px; }
        .sb-resort { display:flex;align-items:center;gap:9px;padding:7px 9px;border-radius:10px;cursor:pointer;transition:background .15s;margin:2px 5px; }
        .sb-resort:hover { background:var(--bg); }
        .sb-resort.act { background:var(--blue-light); }
        .sb-thumb { width:26px;height:26px;border-radius:6px;overflow:hidden;flex-shrink:0;background:var(--bg); }
        .sb-thumb img { width:100%;height:100%;object-fit:cover; }
        .sb-name { font-size:12px;font-weight:600;color:var(--text);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .sb-resort.act .sb-name { color:var(--blue); }
        .sb-score { font-size:11px;font-weight:700;flex-shrink:0; }

        /* ── MAIN CONTENT ── */
        .main { flex:1;overflow:hidden;display:flex;flex-direction:column;min-width:0; }

        /* ── MAP CONTROLS BAR ── */
        .map-ctrl-bar { display:flex;align-items:center;gap:8px;padding:10px 14px 8px;flex-shrink:0; }
        .mode-group { display:flex;background:var(--white);border:1px solid var(--border-2);border-radius:20px;padding:3px;gap:0;box-shadow:var(--shadow); }
        .mode-btn { display:flex;align-items:center;gap:5px;padding:5px 13px;border-radius:16px;border:none;background:transparent;font-size:12px;font-weight:600;color:var(--text-3);cursor:pointer;font-family:Inter,sans-serif;transition:all .15s;white-space:nowrap; }
        .mode-btn.act { background:var(--white);color:var(--text);box-shadow:0 1px 4px rgba(15,40,80,0.1);border:1px solid var(--border-2); }
        .diff-group { display:flex;align-items:center;gap:5px;background:var(--white);border:1px solid var(--border-2);border-radius:20px;padding:5px 12px;box-shadow:var(--shadow); }
        .diff-sep { width:1px;height:12px;background:var(--border-2); }
        .diff-lbl { font-size:11px;font-weight:600;color:var(--text-3); }
        .diff-chip { display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:12px;border:none;background:transparent;font-size:11px;font-weight:600;color:var(--text-2);cursor:pointer;font-family:Inter,sans-serif;transition:all .15s; }
        .diff-chip.act { background:var(--blue-light);color:var(--blue); }
        .diff-chip:hover:not(.act) { background:var(--bg); }

        /* ── MAP AREA ── */
        .map-area { flex:1;position:relative;overflow:hidden;margin:0 14px 0;border-radius:16px;box-shadow:var(--shadow-md);min-height:0; }
        .map-img { width:100%;height:100%;object-fit:cover;display:block;border-radius:16px; }

        /* "Best Area" insight card on the map */
        .best-area-card {
          position:absolute;top:16px;left:16px;z-index:10;
          background:rgba(13,27,46,0.88);backdrop-filter:blur(12px);
          border:1px solid rgba(255,255,255,0.12);border-radius:14px;
          padding:14px 16px;min-width:220px;max-width:280px;
          box-shadow:0 8px 32px rgba(0,0,0,0.3);
        }
        .bac-label { font-size:10px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px; }
        .bac-title { font-size:18px;font-weight:800;color:#fff;margin-bottom:8px; }
        .bac-row { display:flex;align-items:center;gap:7px;font-size:12px;color:rgba(255,255,255,0.7);margin-bottom:4px; }
        .bac-row:last-of-type { margin-bottom:10px; }
        .bac-icon { width:18px;height:18px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0; }
        .bac-btns { display:flex;gap:7px;margin-top:2px; }
        .bac-btn-primary { flex:1;padding:7px 0;background:var(--blue);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;text-align:center; }
        .bac-btn-secondary { flex:1;padding:7px 0;background:rgba(255,255,255,0.12);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;text-align:center; }

        /* zone label pins on map */
        .map-pin { position:absolute;background:rgba(255,255,255,0.92);backdrop-filter:blur(6px);border-radius:8px;padding:4px 9px;font-size:11px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:4px;box-shadow:0 2px 8px rgba(15,40,80,0.15);pointer-events:none;border:1px solid var(--border-2); }

        /* Mapbox attribution */
        .map-attrib { position:absolute;bottom:10px;left:14px;display:flex;align-items:center;gap:5px;background:rgba(255,255,255,0.8);backdrop-filter:blur(6px);border-radius:6px;padding:3px 8px;font-size:10px;color:var(--text-3); }

        /* ── BOTTOM SECTION ── */
        .bottom { height:210px;flex-shrink:0;background:var(--bg);display:flex;gap:10px;padding:10px 14px;overflow:hidden; }

        /* Top Runs card */
        .top-runs-card { flex:1;background:var(--white);border-radius:14px;border:1px solid var(--border-2);overflow:hidden;display:flex;flex-direction:column;box-shadow:var(--shadow); }
        .trc-hdr { display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--border);flex-shrink:0; }
        .trc-title { font-size:13px;font-weight:700;color:var(--text);flex:1; }
        .trc-tabs { display:flex;gap:3px; }
        .trc-tab { padding:3px 9px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;border:none;background:none;font-family:Inter,sans-serif;color:var(--text-3);transition:all .15s; }
        .trc-tab.act { background:var(--blue-light);color:var(--blue); }
        .trc-dots { color:var(--text-3);font-size:16px;letter-spacing:2px;cursor:pointer; }
        .trc-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:0;flex:1;overflow:hidden; }
        .trc-col { padding:10px 12px;border-right:1px solid var(--border);display:flex;flex-direction:column;gap:6px; }
        .trc-col:last-child { border-right:none; }
        .trc-run { display:flex;flex-direction:column;gap:2px; }
        .trc-run-hdr { display:flex;align-items:center;gap:6px; }
        .trc-diff { width:18px;height:18px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;flex-shrink:0; }
        .trc-run-name { font-size:12px;font-weight:700;color:var(--text);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .trc-zone-badge { font-size:10px;font-weight:600;color:var(--text-3);background:var(--bg);padding:1px 6px;border-radius:4px;white-space:nowrap; }
        .trc-run-sub { font-size:11px;color:var(--text-3);padding-left:24px; }
        .trc-lift { display:flex;align-items:center;gap:5px;margin-top:4px;padding:4px 8px;background:var(--bg);border-radius:7px; }
        .trc-lift-dot { width:7px;height:7px;border-radius:50%;flex-shrink:0; }
        .trc-lift-name { font-size:11px;font-weight:500;color:var(--text-2);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .trc-lift-wait { font-size:10px;color:var(--text-3);white-space:nowrap; }
        .trc-lift-eye { font-size:11px;color:var(--text-3); }

        /* Forecast mini card */
        .fc-card { width:220px;flex-shrink:0;background:var(--white);border-radius:14px;border:1px solid var(--border-2);overflow:hidden;display:flex;flex-direction:column;box-shadow:var(--shadow); }
        .fc-hdr { display:flex;align-items:center;gap:6px;padding:10px 12px 6px;border-bottom:1px solid var(--border);flex-shrink:0; }
        .fc-hdr-title { font-size:12px;font-weight:700;color:var(--text); }
        .fc-scroll { flex:1;overflow-y:auto;padding:4px 0; }
        .fc-row { display:flex;align-items:center;gap:8px;padding:5px 12px; }
        .fc-day { font-size:11px;font-weight:600;color:var(--text-3);width:28px;flex-shrink:0; }
        .fc-icon { font-size:14px;flex-shrink:0; }
        .fc-bar-wrap { flex:1;height:6px;background:var(--bg);border-radius:3px;overflow:hidden; }
        .fc-bar { height:100%;background:#93c5fd;border-radius:3px;transition:width .4s ease; }
        .fc-snow-val { font-size:11px;font-weight:700;color:var(--blue);width:28px;text-align:right;flex-shrink:0; }
        .fc-temp { font-size:10px;color:var(--text-3);width:44px;text-align:right;flex-shrink:0;white-space:nowrap; }

        /* ── RIGHT PANEL ── */
        .rpanel { width:255px;flex-shrink:0;background:var(--bg);border-left:1px solid var(--border-2);overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:10px; }

        /* Resort header card */
        .rcard { background:var(--white);border-radius:14px;border:1px solid var(--border-2);padding:14px;box-shadow:var(--shadow); }
        .rc-resort-name { font-size:15px;font-weight:800;color:var(--text);line-height:1.2; }
        .rc-resort-sub { font-size:11px;color:var(--text-3);margin-top:2px;margin-bottom:12px; }
        .rc-weather-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:0; }
        .rc-zone { text-align:center; }
        .rc-zone-lbl { font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;display:flex;align-items:center;justify-content:center;gap:2px; }
        .rc-zone-temp { font-size:22px;font-weight:800;color:var(--text);line-height:1; }
        .rc-zone-unit { font-size:11px;color:var(--text-3);font-weight:400; }
        .rc-zone-wind { font-size:10px;color:var(--text-3);margin-top:2px; }

        /* Score card */
        .score-card { background:var(--white);border-radius:14px;border:1px solid var(--border-2);padding:14px;box-shadow:var(--shadow);display:flex;flex-direction:column;align-items:center; }
        .score-hdr { font-size:13px;font-weight:700;color:var(--text);align-self:flex-start;margin-bottom:10px; }
        .score-label { font-size:12px;font-weight:600;margin-top:4px; }
        .score-sub { font-size:11px;color:var(--text-3);margin-top:2px;text-align:center; }
        .score-meta { display:flex;gap:10px;margin-top:8px;width:100%; }
        .score-meta-item { flex:1;text-align:center;background:var(--bg);border-radius:8px;padding:5px; }
        .score-meta-val { font-size:13px;font-weight:800;color:var(--text); }
        .score-meta-lbl { font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em; }

        /* Next hours card */
        .hours-card { background:var(--white);border-radius:14px;border:1px solid var(--border-2);padding:12px;box-shadow:var(--shadow); }
        .hours-hdr { font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px; }
        .hours-row { display:grid;grid-template-columns:repeat(4,1fr);gap:4px; }
        .hour-col { display:flex;flex-direction:column;align-items:center;gap:2px; }
        .hour-time { font-size:9px;font-weight:600;color:var(--text-3); }
        .hour-icon { font-size:16px; }
        .hour-temp { font-size:11px;font-weight:700;color:var(--text); }
        .hour-snow { font-size:9px;color:#3b82f6;font-weight:600; }

        /* Crowd insights card */
        .crowd-card { background:var(--white);border-radius:14px;border:1px solid var(--border-2);padding:12px;box-shadow:var(--shadow); }
        .crowd-hdr { font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px; }
        .crowd-row { display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid var(--border); }
        .crowd-row:last-child { border-bottom:none;padding-bottom:0; }
        .crowd-diff { width:16px;height:16px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:900;flex-shrink:0;margin-top:1px; }
        .crowd-name { font-size:11px;font-weight:600;color:var(--text);flex:1; }
        .crowd-badge { font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;white-space:nowrap; }
        .crowd-badge.low    { background:#f0fdf4;color:#16a34a; }
        .crowd-badge.mod    { background:#fffbeb;color:#92400e; }
        .crowd-badge.high   { background:#fef2f2;color:#991b1b; }
        .crowd-badge.avoid  { background:#fef2f2;color:#991b1b;border:1px solid rgba(239,68,68,0.3); }
        .crowd-sub { font-size:10px;color:var(--text-3);margin-top:1px; }

        /* PowderIQ logo footer */
        .rcard-footer { background:var(--white);border-radius:14px;border:1px solid var(--border-2);padding:10px 14px;box-shadow:var(--shadow);display:flex;align-items:center;gap:8px; }
        .rcard-footer img { height:22px;width:auto; }
        .rcard-footer-brand { font-size:13px;font-weight:800;color:var(--text);letter-spacing:-0.03em; }

        @keyframes spin { to { transform:rotate(360deg); } }
        @media(max-width:1200px) { .rpanel { display:none; } }
        @media(max-width:900px) { .sidebar { display:none; } }
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
          {hasResort && <Link href="/resort/dashboard" className="tnav-tab">⛷️ Resort</Link>}
        </div>
        <div className="tnav-right">
          <div className="api-badge"><div className="api-dot"/>API Connected</div>
          <Link href="/account/profile" className="tnav-av" aria-label="Account">
            {avatarUrl ? <img src={avatarUrl} alt="avatar"/> : (userName ? userName[0].toUpperCase() : '👤')}
          </Link>
        </div>
      </nav>

      {/* ── SHELL ── */}
      <div className="shell">

        {/* ── LEFT SIDEBAR ── */}
        <aside className="sidebar">
          <div className="sb-lbl">Saved Resorts</div>
          {favorites.length === 0 && (
            <div style={{padding:'16px 14px',fontSize:12,color:'var(--text-3)',lineHeight:1.6}}>
              No favorites yet.<br/>
              <Link href="/mountains" style={{color:'var(--blue)',fontWeight:600}}>Browse resorts →</Link>
            </div>
          )}
          {favorites.map(fav => {
            const s = fav.score ?? 0;
            const isAct = selectedFav?.id === fav.id;
            return (
              <div key={fav.id} className={`sb-resort${isAct?' act':''}`} onClick={() => setSelectedFav(fav)}>
                <div className="sb-thumb"><img src={getMtnImg(fav.mountain)} alt={fav.mountain.name}/></div>
                <span className="sb-name">{fav.mountain.name}</span>
                {s > 0 && <span className="sb-score" style={{color:getScoreColor(s)}}>{s}</span>}
              </div>
            );
          })}
        </aside>

        {/* ── MAIN ── */}
        <div className="main">

          {/* Map controls bar */}
          <div className="map-ctrl-bar">
            <div className="mode-group">
              {(['trail','satellite','hybrid'] as const).map(m => (
                <button key={m} className={`mode-btn${mapMode===m?' act':''}`} onClick={() => setMapMode(m)}>
                  {m==='trail' ? '🗺 Trail Map' : m==='satellite' ? '🛰 Satellite' : '🌐 Hybrid'}
                </button>
              ))}
            </div>
            <div className="diff-group">
              <span className="diff-lbl">Difficulty:</span>
              <div className="diff-sep"/>
              {[
                {key:'green',       icon:<div style={{width:11,height:11,borderRadius:2,background:'#16a34a',flexShrink:0}}/>,       label:'Easy'},
                {key:'blue',        icon:<div style={{width:11,height:11,borderRadius:'50%',background:'#2563eb',flexShrink:0}}/>,    label:'Intermediate'},
                {key:'black',       icon:<svg width={11} height={11} viewBox="0 0 11 11"><rect x={5.5} y={0} width={7.5} height={7.5} rx={1} transform="rotate(45 5.5 0)" fill="#111827"/></svg>, label:'Advanced'},
                {key:'double_black',icon:<svg width={18} height={11} viewBox="0 0 18 11"><rect x={5.5} y={0} width={7.5} height={7.5} rx={1} transform="rotate(45 5.5 0)" fill="#111827"/><rect x={12} y={0} width={7.5} height={7.5} rx={1} transform="rotate(45 12 0)" fill="#111827"/></svg>, label:'Expert'},
              ].map(d => (
                <button key={d.key} className={`diff-chip${diffFilter.includes(d.key)?' act':''}`}
                  onClick={() => setDiffFilter(p => p.includes(d.key) ? p.filter(x=>x!==d.key) : [...p,d.key])}>
                  {d.icon}{d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Map */}
          <div className="map-area">
            <img className="map-img" src={heroImg} alt={activeFav?.mountain.name ?? 'Resort'}
              onError={e => { (e.target as HTMLImageElement).src='https://images.unsplash.com/photo-1605540436563-5bca919ae766?w=1200&q=80'; }}/>

            {/* Best Area insight card */}
            {activeFav && (
              <div className="best-area-card">
                <div className="bac-label">🔥 Best Area Right Now</div>
                <div className="bac-title">
                  {(() => {
                    const summit = weatherZones['summit'];
                    if (summit && (scoreData?.snowfall24hIn ?? 0) > 3) return 'Summit Zone';
                    if (groomedCount > 0) return 'Groomed Runs';
                    return activeFav.mountain.name;
                  })()}
                </div>
                {(scoreData?.snowfall24hIn ?? 0) > 0 && (
                  <div className="bac-row">
                    <div className="bac-icon" style={{background:'rgba(59,130,246,0.2)'}}>❄</div>
                    <span>{scoreData!.snowfall24hIn!.toFixed(1)}" in last 12 hours</span>
                  </div>
                )}
                {(scoreData?.windMph ?? 0) <= 15 && (
                  <div className="bac-row">
                    <div className="bac-icon" style={{background:'rgba(34,197,94,0.2)'}}>✓</div>
                    <span>Low wind, {groomedCount > 0 ? 'groomed' : 'good visibility'}</span>
                  </div>
                )}
                {openLifts > 0 && (
                  <div className="bac-row">
                    <div className="bac-icon" style={{background:'rgba(29,110,245,0.2)'}}>✓</div>
                    <span>Ideal for {(scoreData?.tempF ?? 28) > 34 ? 'groomers' : 'all levels'}</span>
                  </div>
                )}
                <div className="bac-btns">
                  <button className="bac-btn-primary" onClick={() => setActivePanel('trails')}>View Runs</button>
                  <button className="bac-btn-secondary">Navigate on Map</button>
                </div>
              </div>
            )}

            {/* Zone pins — only show if we have data */}
            {activeFav && weatherZones['summit'] && (
              <div className="map-pin" style={{top:'22%',right:'18%'}}>
                ⛰️ {activeFav.mountain.name.split(' ')[0]} Peak
              </div>
            )}

            {!activeFav && (
              <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(240,245,251,0.85)',borderRadius:16}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:44,marginBottom:8}}>⛷️</div>
                  <div style={{fontSize:16,fontWeight:700,color:'var(--text)'}}>Save a resort to get started</div>
                  <Link href="/mountains" style={{color:'var(--blue)',fontSize:13,marginTop:8,display:'block',fontWeight:600}}>Browse resorts →</Link>
                </div>
              </div>
            )}

            <div className="map-attrib">🗺 mapbox</div>
          </div>

          {/* Bottom section */}
          <div className="bottom">

            {/* Top Runs Right Now */}
            <div className="top-runs-card">
              <div className="trc-hdr">
                <span style={{fontSize:15}}>⛷️</span>
                <span className="trc-title">Top Runs Right Now</span>
                <div className="trc-tabs">
                  <button className={`trc-tab${activePanel==='trails'?' act':''}`} onClick={()=>setActivePanel('trails')}>Trails</button>
                  <button className={`trc-tab${activePanel==='lifts'?' act':''}`} onClick={()=>setActivePanel('lifts')}>Lifts</button>
                </div>
                <span className="trc-dots">···</span>
              </div>
              <div className="trc-grid">
                {activePanel === 'trails' && (() => {
                  // Smart ranking: groomed > open, easiest conditions, pick top 3 for 3 columns
                  const ranked = [...trails]
                    .filter(t => t.status==='open'||t.status==='groomed')
                    .sort((a,b) => {
                      const aScore = (a.status==='groomed'?2:1) + (a.snowDepthIn??0)*0.01;
                      const bScore = (b.status==='groomed'?2:1) + (b.snowDepthIn??0)*0.01;
                      return bScore - aScore;
                    })
                    .slice(0,3);

                  if (ranked.length === 0) return (
                    <div style={{gridColumn:'1/-1',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',fontSize:12,color:'var(--text-3)',flexDirection:'column',gap:6}}>
                      <span style={{fontSize:28}}>⛷️</span>
                      {activeFav ? 'No trail data available for this resort' : 'Select a resort to see top runs'}
                    </div>
                  );

                  const diffCls: Record<string,{bg:string,color:string,icon:string}> = {
                    green:        {bg:'#dcfce7',color:'#16a34a',icon:'■'},
                    blue:         {bg:'#dbeafe',color:'#2563eb',icon:'●'},
                    black:        {bg:'#e5e7eb',color:'#111827',icon:'◆'},
                    double_black: {bg:'#d1d5db',color:'#030712',icon:'◆◆'},
                    terrain_park: {bg:'#ffedd5',color:'#ea580c',icon:'▲'},
                    backcountry:  {bg:'#fef9c3',color:'#854d0e',icon:'⬡'},
                  };

                  // Best lift for each trail (first open lift)
                  const openLift = lifts.find(l => l.status==='open');

                  return ranked.map((t, i) => {
                    const dc = diffCls[t.difficulty] ?? diffCls.blue;
                    const zones = ['Summit','Midmtn','Base'];
                    return (
                      <div key={t.id} className="trc-col">
                        <div className="trc-run">
                          <div className="trc-run-hdr">
                            <div className="trc-diff" style={{background:dc.bg,color:dc.color}}>{dc.icon}</div>
                            <span className="trc-run-name">{t.trailName}</span>
                            <span className="trc-zone-badge">{zones[i%3]}</span>
                          </div>
                          <div className="trc-run-sub">
                            {t.status==='groomed'?'Groomed · ':'Open · '}
                            {t.snowDepthIn ? `${t.snowDepthIn}" depth` : t.status==='groomed' ? 'Soft powder' : 'Good conditions'}
                          </div>
                        </div>
                        {openLift && (
                          <div className="trc-lift">
                            <div className="trc-lift-dot" style={{background:'#22c55e'}}/>
                            <span className="trc-lift-name">{openLift.liftName}</span>
                            <span className="trc-lift-wait">{openLift.waitMinutes ? `~${openLift.waitMinutes} min` : '~10 min'}</span>
                            <span className="trc-lift-eye">👁</span>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}

                {activePanel === 'lifts' && (() => {
                  const openOnes = lifts.filter(l=>l.status==='open').slice(0,3);
                  const holdOnes = lifts.filter(l=>l.status==='on_hold').slice(0,1);
                  const schedOnes = lifts.filter(l=>l.status==='scheduled').slice(0,1);
                  const display = [...openOnes,...holdOnes,...schedOnes].slice(0,3);

                  if (display.length === 0) return (
                    <div style={{gridColumn:'1/-1',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',fontSize:12,color:'var(--text-3)',flexDirection:'column',gap:6}}>
                      <span style={{fontSize:28}}>🚡</span>
                      {activeFav ? 'No lift data available' : 'Select a resort to see lifts'}
                    </div>
                  );

                  return display.map((l,i) => (
                    <div key={l.id} className="trc-col">
                      <div className="trc-run">
                        <div className="trc-run-hdr">
                          <div className="trc-diff" style={{background:`${LIFT_COLOR[l.status]||'#6b7280'}22`,color:LIFT_COLOR[l.status]||'#6b7280'}}>🚡</div>
                          <span className="trc-run-name">{l.liftName}</span>
                          <span className="trc-zone-badge" style={{color:LIFT_COLOR[l.status]||'#6b7280',background:`${LIFT_COLOR[l.status]||'#6b7280'}15`}}>
                            {LIFT_LABEL[l.status]}
                          </span>
                        </div>
                        <div className="trc-run-sub">
                          {l.liftType ?? 'Chairlift'}{l.waitMinutes ? ` · ~${l.waitMinutes} min wait` : ''}
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* 7-day forecast mini card */}
            <div className="fc-card">
              <div className="fc-hdr">
                <span style={{fontSize:14}}>📅</span>
                <span className="fc-hdr-title">Next 7 Days</span>
              </div>
              <div className="fc-scroll">
                {forecast.length === 0
                  ? <div style={{padding:'12px',fontSize:11,color:'var(--text-3)',textAlign:'center'}}>Select a resort</div>
                  : (() => {
                    const maxSnow = Math.max(...forecast.map(f=>f.snowIn), 0.1);
                    return forecast.map(f => {
                      const icon = f.conditionDesc?.toLowerCase().includes('snow') ? '🌨️'
                        : (f.snowIn??0) > 0 ? '🌦️'
                        : f.conditionDesc?.toLowerCase().includes('clear') ? '☀️'
                        : f.conditionDesc?.toLowerCase().includes('cloud') ? '⛅'
                        : '🌤️';
                      return (
                        <div key={f.date} className="fc-row">
                          <span className="fc-day">{f.dayLabel?.slice(0,3)}</span>
                          <span className="fc-icon">{icon}</span>
                          <div className="fc-bar-wrap">
                            <div className="fc-bar" style={{width:`${(f.snowIn/maxSnow)*100}%`,background:f.snowIn>3?'#3b82f6':'#93c5fd'}}/>
                          </div>
                          <span className="fc-snow-val" style={{color:f.snowIn>0?'#2563eb':'var(--text-3)'}}>
                            {f.snowIn > 0 ? `${f.snowIn.toFixed(1)}"` : '—'}
                          </span>
                          <span className="fc-temp">{f.tempHighF?.toFixed(0)?? '--'}°/{f.tempLowF?.toFixed(0)??'--'}°</span>
                        </div>
                      );
                    });
                  })()
                }
              </div>
            </div>

          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="rpanel">

          {/* Resort name + weather */}
          <div className="rcard">
            <div className="rc-resort-name">{activeFav?.mountain.name ?? '—'}</div>
            <div className="rc-resort-sub">Resort</div>
            <div className="rc-weather-grid">
              {([['summit','🏔','Summit'],['mid','⛷','Mid'],['base','🏠','Base']] as const).map(([key,icon,label]) => {
                const z = weatherZones[key];
                const temp = z?.tempF ?? (key==='summit' ? scoreData?.tempF : null);
                const wind = z?.windMph ?? (key==='summit' ? scoreData?.windMph : null);
                return (
                  <div key={key} className="rc-zone">
                    <div className="rc-zone-lbl"><span>{icon}</span>{label}</div>
                    <div className="rc-zone-temp">{temp != null ? Math.round(temp) : '--'}<span className="rc-zone-unit">°F</span></div>
                    <div className="rc-zone-wind">{wind != null ? `${Math.round(wind)} mph` : '--'}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Powder Score */}
          <div className="score-card">
            <div className="score-hdr">Powder Score</div>
            {scoreLoading
              ? <div style={{width:130,height:130,display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:28,height:28,border:'3px solid #dbeafe',borderTopColor:'var(--blue)',borderRadius:'50%',animation:'spin .7s linear infinite'}}/></div>
              : <ScoreRing score={score}/>
            }
            <div className="score-label" style={{color:getScoreColor(score)}}>
              {score>=80?'Outstanding':score>=65?'Great Day':score>=50?'Good':score>=35?'Fair':'Challenging'}
            </div>
            <div className="score-sub">{scoreData?.conditionDesc ?? (activeFav ? 'Loading conditions…' : 'Select a resort')}</div>
            {scoreData && (
              <div className="score-meta">
                <div className="score-meta-item">
                  <div className="score-meta-val" style={{color:'#3b82f6'}}>{scoreData.snowfall24hIn?.toFixed(1) ?? '0'}"</div>
                  <div className="score-meta-lbl">24h Snow</div>
                </div>
                <div className="score-meta-item">
                  <div className="score-meta-val">{scoreData.snowDepthIn?.toFixed(0) ?? '—'}"</div>
                  <div className="score-meta-lbl">Base</div>
                </div>
                <div className="score-meta-item">
                  <div className="score-meta-val">{scoreData.windMph?.toFixed(0) ?? '—'}</div>
                  <div className="score-meta-lbl">Wind mph</div>
                </div>
              </div>
            )}
          </div>

          {/* Next 6 Hours */}
          {forecast.length > 0 && (
            <div className="hours-card">
              <div className="hours-hdr">Next 6 Hours</div>
              <div className="hours-row">
                {['8 AM','12 PM','3 PM','6 PM'].map((t,i) => {
                  const f = forecast[0];
                  const icons = ['☀️','⛅','🌨️','🌤️'];
                  const temps = [
                    f?.tempHighF ?? 35,
                    ((f?.tempHighF??35) + (f?.tempLowF??25)) / 2,
                    (f?.tempLowF??25) + 3,
                    f?.tempLowF ?? 25,
                  ];
                  return (
                    <div key={t} className="hour-col">
                      <span className="hour-time">{t}</span>
                      <span className="hour-icon">{icons[i]}</span>
                      <span className="hour-temp">{Math.round(temps[i])}°</span>
                      {i===2 && (f?.snowIn??0)>0 && <span className="hour-snow">{(f!.snowIn*0.3).toFixed(1)}"</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Crowd Insights */}
          {(trails.length > 0 || lifts.length > 0) && (
            <div className="crowd-card">
              <div className="crowd-hdr">Crowd Insights</div>
              {(() => {
                // Build crowd insight rows from real data
                const insights: {diff:string;name:string;level:'low'|'mod'|'high'|'avoid';sub:string}[] = [];

                // Lifts on hold = high traffic/wind
                lifts.filter(l=>l.status==='on_hold').slice(0,1).forEach(l => {
                  insights.push({diff:'black',name:l.liftName,level:'avoid',sub:'Wind hold — check conditions'});
                });

                // Groomed trails = moderate crowd expected
                trails.filter(t=>t.status==='groomed').slice(0,2).forEach(t => {
                  const dc: Record<string,string> = {green:'#dcfce7',blue:'#dbeafe',black:'#e5e7eb',double_black:'#d1d5db',terrain_park:'#ffedd5',backcountry:'#fef9c3'};
                  insights.push({diff:t.difficulty,name:t.trailName,level:'mod',sub:'Groomed · Moderate traffic'});
                });

                // Open trails with no grooming = lower crowds
                trails.filter(t=>t.status==='open').slice(0,2).forEach(t => {
                  insights.push({diff:t.difficulty,name:t.trailName,level:'low',sub:'Open · Lower crowds'});
                });

                // Wind warning if summit wind high
                if ((weatherZones['summit']?.windMph ?? scoreData?.windMph ?? 0) > 25) {
                  insights.unshift({diff:'black',name:'Summit Area',level:'avoid',sub:'High wind — avoid upper runs'});
                }

                if (insights.length === 0) return (
                  <div style={{fontSize:11,color:'var(--text-3)',textAlign:'center',padding:'8px 0'}}>No crowd data available</div>
                );

                const diffCls: Record<string,{bg:string,color:string,icon:string}> = {
                  green:{bg:'#dcfce7',color:'#16a34a',icon:'■'},
                  blue:{bg:'#dbeafe',color:'#2563eb',icon:'●'},
                  black:{bg:'#e5e7eb',color:'#111827',icon:'◆'},
                  double_black:{bg:'#d1d5db',color:'#030712',icon:'◆◆'},
                  terrain_park:{bg:'#ffedd5',color:'#ea580c',icon:'▲'},
                  backcountry:{bg:'#fef9c3',color:'#854d0e',icon:'⬡'},
                };

                return insights.slice(0,4).map((ins,i) => {
                  const dc = diffCls[ins.diff] ?? diffCls.blue;
                  return (
                    <div key={i} className="crowd-row">
                      <div className="crowd-diff" style={{background:dc.bg,color:dc.color}}>{dc.icon}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div className="crowd-name">{ins.name}</div>
                        <div className="crowd-sub">{ins.sub}</div>
                      </div>
                      <div className={`crowd-badge ${ins.level}`}>
                        {ins.level==='low'?'Low 🟢':ins.level==='mod'?'Moderate 🟡':ins.level==='avoid'?'Avoid: High':'High 🔴'}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* PowderIQ footer */}
          <div className="rcard-footer">
            <img src="/brand/powderiq_logo.png" alt="PowderIQ"/>
            <span className="rcard-footer-brand">PowderIQ</span>
          </div>

        </div>
      </div>
    </>
  );
}
