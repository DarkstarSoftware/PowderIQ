'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase/client';

// Mapbox CSS — loaded dynamically to avoid SSR issues
// (imported inside MapboxMap component via useEffect)

// Mapbox loaded client-only — prevents SSR crash
const MapboxMap = dynamic(() => import('@/components/MapboxMap'), {
  ssr: false,
  loading: () => (
    <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:'#f0f5fb',borderRadius:16}}>
      <div style={{width:32,height:32,border:'3px solid #dbeafe',borderTopColor:'#1d6ef5',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
    </div>
  ),
});

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
  const size = 160;
  const cx = size / 2, cy = size / 2;
  const r = 62;
  const strokeW = 13;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, score / 100));
  const filled = circ * pct;
  const gap = circ - filled;

  // Day quality label + colors
  const quality =
    score >= 80 ? { label:'Outstanding', color:'#16a34a' } :
    score >= 65 ? { label:'Great Day',   color:'#0d9488' } :
    score >= 50 ? { label:'Good Day',    color:'#2563eb' } :
    score >= 35 ? { label:'Fair Day',    color:'#d97706' } :
                  { label:'Challenging', color:'#dc2626' };

  const gradId = `sg-${score}`;

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:0,width:'100%'}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{overflow:'visible'}}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#1e3a8a"/>
            <stop offset="30%"  stopColor="#1d6ef5"/>
            <stop offset="60%"  stopColor="#38bdf8"/>
            <stop offset="85%"  stopColor="#34d399"/>
            <stop offset="100%" stopColor="#22c55e"/>
          </linearGradient>
          {/* Soft drop shadow filter */}
          <filter id="ring-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#1d6ef5" floodOpacity="0.18"/>
          </filter>
        </defs>

        {/* Track ring */}
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="#e8f1fe" strokeWidth={strokeW}/>

        {/* Filled gradient arc */}
        {score > 0 && (
          <circle cx={cx} cy={cy} r={r} fill="none"
            stroke={`url(#${gradId})`} strokeWidth={strokeW}
            strokeDasharray={`${filled} ${gap}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{transition:'stroke-dasharray .7s cubic-bezier(.4,0,.2,1)'}}
            filter="url(#ring-shadow)"/>
        )}

        {/* Score number */}
        <text x={cx} y={cy - 8} textAnchor="middle"
          fill="#0d1b2e" fontSize={42} fontWeight={800}
          fontFamily="Inter,sans-serif" letterSpacing="-2">
          {score > 0 ? score : '—'}
        </text>

        {/* /100 */}
        <text x={cx} y={cy + 14} textAnchor="middle"
          fill="#94a3b8" fontSize={12} fontWeight={500}
          fontFamily="Inter,sans-serif">
          out of 100
        </text>
      </svg>
    </div>
  );
}


// ── Pro gate wrapper ─────────────────────────────────────────────────────────
function ProGate({ isPro, title, desc, children }: {
  isPro: boolean; title: string; desc: string; children: React.ReactNode;
}) {
  if (isPro) return <>{children}</>;
  return (
    <div className="pro-gate" style={{position:'relative'}}>
      <div className="pro-gate-blur">{children}</div>
      <div className="pro-gate-overlay">
        <div className="pro-badge">⭐ Pro Feature</div>
        <div className="pro-gate-title">{title}</div>
        <div className="pro-gate-sub">{desc}</div>
        <a href="/account/billing" className="pro-gate-btn">Upgrade to Pro</a>
      </div>
    </div>
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
  const TOKEN_OK = typeof process !== 'undefined' && !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const [favorites,    setFavorites]    = useState<FavoriteItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [userRole,     setUserRole]     = useState('user');
  const [isPro,        setIsPro]        = useState(false); // active sub or pro_user/admin role
  const [userName,     setUserName]     = useState('');
  const [avatarUrl,    setAvatarUrl]    = useState('');
  const [riderStyle,   setRiderStyle]   = useState('all_mountain'); // powder|all_mountain|freestyle|beginner
  const [skillLevel,   setSkillLevel]   = useState('intermediate'); // beginner|intermediate|advanced|expert
  const [hasResort,    setHasResort]    = useState(false);
  const [token,        setToken]        = useState('');
  const [selectedFav,  setSelectedFav]  = useState<FavoriteItem | null>(null);
  const [scoreData,    setScoreData]    = useState<MountainScore | null>(null);
  const [forecast,     setForecast]     = useState<ForecastPeriod[]>([]);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [mapMode,      setMapMode]      = useState<'trail'|'satellite'|'hybrid'>('hybrid');
  const [diffFilter,   setDiffFilter]   = useState<string[]>([]);
  const [lifts,        setLifts]        = useState<Lift[]>([]);
  const [liftieStats,  setLiftieStats]  = useState<{open:number;hold:number;scheduled:number;closed:number}|null>(null);
  const [trails,       setTrails]       = useState<Trail[]>([]);
  const [activePanel,  setActivePanel]  = useState<'lifts'|'trails'>('trails');
  const [sortBy,       setSortBy]       = useState<'name'|'difficulty'>('name');
  const [sortDir,      setSortDir]      = useState<'asc'|'desc'>('asc');
  const [sortOpen,     setSortOpen]     = useState(false);
  const [mapLoaded,    setMapLoaded]    = useState(false);
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
        const role = me.data?.role || 'user';
        setUserRole(role);
        setUserName(me.data?.profile?.displayName || '');
        // isPro = active subscription OR pro_user/admin role
        const subStatus = me.data?.subscription?.status;
        const isProRole = role === 'pro_user' || role === 'admin';
        const isActiveSub = subStatus === 'active' || subStatus === 'trialing';
        setIsPro(isProRole || isActiveSub);
        const url = me.data?.profile?.avatarUrl || '';
        if (url) { setAvatarUrl(url); localStorage.setItem('powderiq_avatar', url); }
        if (me.data?.profile?.style)      setRiderStyle(me.data.profile.style);
        if (me.data?.profile?.skillLevel) setSkillLevel(me.data.profile.skillLevel);
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
      // Fire ALL fetches in parallel — don't wait for score before starting resort/liftie
      const slug = deriveLiftieSlug(fav.mountain.name);
      const [scoreRes, forecastRes, resortRes, liftieRes, trailRes] = await Promise.allSettled([
        fetch(`/api/mountains/${fav.mountain.id}/score`,    { headers: h }),
        fetch(`/api/mountains/${fav.mountain.id}/forecast`, { headers: h }),
        fetch(`/api/resort?mountainId=${fav.mountain.id}`,  { headers: h }),
        fetch(`/api/lifts/${slug}?mountainId=${fav.mountain.id}`),
        fetch(`/api/mountains/${fav.mountain.id}/trails`,   { headers: h }),
      ]);

      // ── Score ────────────────────────────────────────────────────────────────
      let scoreVal = fav.score ?? 0;
      if (scoreRes.status === 'fulfilled' && scoreRes.value.ok) {
        const sd = await scoreRes.value.json();
        scoreVal = sd.data?.score ?? scoreVal;
      }

      // ── Forecast + weather data ───────────────────────────────────────────
      // Pull snow conditions from forecast API (works for all mountains)
      let snow: Record<string,any> = {};
      let mtnData: Record<string,any> = {};
      let zones: Record<string,any> = {};
      if (forecastRes.status === 'fulfilled' && forecastRes.value.ok) {
        const fd = await forecastRes.value.json();
        snow    = fd.data?.snow ?? {};
        mtnData = fd.data?.mountain ?? {};
      }

      // Use mountain lat/lon from either the forecast response or the favorite
      const lat = mtnData.latitude  ?? fav.mountain.latitude;
      const lon = mtnData.longitude ?? fav.mountain.longitude;
      const topElevFt  = mtnData.topElevFt  ?? fav.mountain.topElevFt  ?? 8000;
      const baseElevFt = mtnData.baseElevFt ?? fav.mountain.baseElevFt ?? 6000;
      const midElevFt  = Math.round((topElevFt + baseElevFt) / 2);

      // Fetch elevation-stratified weather from Open-Meteo for summit/mid/base
      // Uses three requests at different elevations — fully public, no auth needed
      if (lat && lon) {
        const summitM = Math.round(topElevFt  * 0.3048);
        const midM    = Math.round(midElevFt  * 0.3048);
        const baseM   = Math.round(baseElevFt * 0.3048);

        const [summitWeather, midWeather, baseWeather, forecastData] = await Promise.allSettled([
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,windspeed_10m,snowfall,snow_depth&temperature_unit=fahrenheit&windspeed_unit=mph&precipitation_unit=inch&timezone=auto&elevation=${summitM}`),
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,windspeed_10m,snow_depth&temperature_unit=fahrenheit&windspeed_unit=mph&precipitation_unit=inch&timezone=auto&elevation=${midM}`),
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,windspeed_10m,snow_depth&temperature_unit=fahrenheit&windspeed_unit=mph&precipitation_unit=inch&timezone=auto&elevation=${baseM}`),
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,snowfall_sum,precipitation_probability_max,weathercode&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=auto&forecast_days=10&elevation=${summitM}`),
        ]);

        // Parse zone weather
        if (summitWeather.status === 'fulfilled' && summitWeather.value.ok) {
          const d = await summitWeather.value.json();
          const c = d.current ?? {};
          zones['summit'] = { tempF: c.temperature_2m, windMph: c.windspeed_10m, snowfall24hIn: c.snowfall ?? 0, snowDepthIn: (c.snow_depth ?? 0) * 39.3701 };
          // Use summit as primary snow data if API snow is empty
          if (!snow.windMph)   snow.windMph   = c.windspeed_10m;
          if (!snow.tempF)     snow.tempF     = c.temperature_2m;
          if (snow.snowfall24h == null) snow.snowfall24h = c.snowfall ?? 0;
          if (!snow.baseDepthIn) snow.baseDepthIn = (c.snow_depth ?? 0) * 39.3701;
        }
        if (midWeather.status === 'fulfilled' && midWeather.value.ok) {
          const d = await midWeather.value.json();
          const c = d.current ?? {};
          zones['mid'] = { tempF: c.temperature_2m, windMph: c.windspeed_10m, snowDepthIn: (c.snow_depth ?? 0) * 39.3701 };
        }
        if (baseWeather.status === 'fulfilled' && baseWeather.value.ok) {
          const d = await baseWeather.value.json();
          const c = d.current ?? {};
          zones['base'] = { tempF: c.temperature_2m, windMph: c.windspeed_10m, snowDepthIn: (c.snow_depth ?? 0) * 39.3701 };
        }
        if (Object.keys(zones).length > 0) setWeatherZones(zones);

        // Parse 10-day forecast
        if (forecastData.status === 'fulfilled' && forecastData.value.ok) {
          const om = await forecastData.value.json();
          const daily = om.daily ?? {};
          const WMO: Record<number,string> = { 0:'Clear',1:'Clear',2:'Partly cloudy',3:'Overcast',71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',85:'Snow showers',86:'Heavy snow' };
          const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
          setForecast((daily.time ?? []).slice(0,10).map((d: string, i: number) => ({
            date: d, dayLabel: i === 0 ? 'Today' : days[new Date(d+'T12:00:00').getDay()],
            snowIn: daily.snowfall_sum?.[i] ?? 0,
            tempHighF: daily.temperature_2m_max?.[i], tempLowF: daily.temperature_2m_min?.[i],
            conditionDesc: WMO[daily.weathercode?.[i]] ?? 'Mixed',
            precipPct: daily.precipitation_probability_max?.[i],
          })));
        }
      }

      // Build scoreData from all available sources
      const snow24h = snow.snowfall24h ?? 0;
      const wind  = (snow.windMph ?? zones['summit']?.windMph ?? 0) as number;
      const temp  = (snow.tempF   ?? zones['summit']?.tempF   ?? 28) as number;
      const depth = (snow.baseDepthIn ?? zones['base']?.snowDepthIn ?? 0) as number;
      const condDesc = snow24h > 6 ? 'Heavy snow' : snow24h > 2 ? 'Snow showers' : snow24h > 0 ? 'Light snow' : wind > 35 ? 'Windy' : temp > 34 ? 'Partly cloudy' : 'Clear & cold';
      setScoreData({ score: scoreVal, snowfall24hIn: snow24h, snowfall48hIn: snow.snowfall48h, windMph: wind, tempF: temp, snowDepthIn: depth, conditionDesc: condDesc });

      // ── Process parallel results ──────────────────────────────────────────

      // Resort API (PowderIQ operator accounts)
      let hasResortData = false;
      let hasResortTrails = false;
      if (resortRes.status === 'fulfilled' && resortRes.value.ok) {
        const rj = await resortRes.value.json();
        const resort = Array.isArray(rj.data) ? rj.data[0] : rj.data;
        if (resort) {
          // Resort has account — fetch their live lift/trail/weather data
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
            if (trailList.length > 0) { setTrails(trailList); hasResortTrails = true; }
          }
          if (wRes.status === 'fulfilled' && wRes.value.ok) {
            const wj = await wRes.value.json();
            setWeatherZones(wj.data?.zones ?? {});
          }
        }
      }

      // Liftie (already fetched in parallel above)
      if (!hasResortData && liftieRes.status === 'fulfilled' && liftieRes.value.ok) {
        const liftieData = await liftieRes.value.json();
        const liftList = liftieData.lifts ?? [];
        if (liftList.length > 0) setLifts(liftList);
        if (liftieData.stats) {
          setLiftieStats(liftieData.stats);
          if ((liftieData.stats.open ?? 0) > 0) {
            // Re-fetch score now that Liftie has persisted open status to DB
            fetch(`/api/mountains/${fav.mountain.id}/score`, { headers: h })
              .then(r => r.ok ? r.json() : null)
              .then(sd => {
                const newScore = sd?.data?.score ?? 0;
                if (newScore > 0) setScoreData(prev => prev ? { ...prev, score: newScore } : prev);
              }).catch(() => {});
          }
        }
      }

      // OSM trails (already fetched in parallel above)
      if (!hasResortTrails && trailRes.status === 'fulfilled' && trailRes.value.ok) {
        const td = await trailRes.value.json();
        const osmTrails = td.data?.trails ?? [];
        if (osmTrails.length > 0) {
          const openLiftCount = lifts.filter(l => l.status === 'open').length;
          setTrails(osmTrails.map((t: any) => ({
            ...t,
            status: openLiftCount > 0 ? (t.status === 'groomed' ? 'groomed' : 'open') : t.status,
          })));
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
  // isClosed: score API explicitly returned 0 with no open lifts signal.
  // Only true when ALL of:
  //   - score API has returned (scoreData is not null)
  //   - score is 0
  //   - no open lifts from Liftie (if we have liftie data)
  //   - not still loading
  const hasOpenLifts = (liftieStats?.open ?? 0) > 0 ||
                       lifts.some(l => l.status === 'open');
  const isClosed = !scoreLoading &&
                   scoreData !== null &&
                   score === 0 &&
                   !hasOpenLifts;
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
          background:rgba(10,22,40,0.92);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
          border:1px solid rgba(255,255,255,0.10);border-radius:16px;
          padding:16px 18px;min-width:240px;max-width:295px;
          box-shadow:0 12px 40px rgba(0,0,0,0.35);
        }
        .bac-eyebrow { display:flex;align-items:center;gap:6px;margin-bottom:8px; }
        .bac-eyebrow-dot { width:6px;height:6px;background:#22c55e;border-radius:50%;box-shadow:0 0 6px #22c55e; }
        .bac-eyebrow-text { font-size:10px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:.09em; }
        .bac-title { font-size:19px;font-weight:800;color:#fff;line-height:1.2;margin-bottom:12px; }
        .bac-title span { color:#93c5fd; }
        .bac-chips { display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px; }
        .bac-chip { display:flex;align-items:center;gap:4px;padding:4px 9px;border-radius:20px;font-size:11px;font-weight:600;border:1px solid transparent; }
        .bac-chip.snow   { background:rgba(59,130,246,0.18);color:#93c5fd;border-color:rgba(59,130,246,0.3); }
        .bac-chip.wind   { background:rgba(34,197,94,0.15);color:#86efac;border-color:rgba(34,197,94,0.25); }
        .bac-chip.cond   { background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.65);border-color:rgba(255,255,255,0.12); }
        .bac-chip.warn   { background:rgba(245,158,11,0.15);color:#fcd34d;border-color:rgba(245,158,11,0.25); }
        .bac-why { font-size:11px;color:rgba(255,255,255,0.55);line-height:1.5;margin-bottom:12px;padding:8px 10px;background:rgba(255,255,255,0.05);border-radius:8px;border-left:2px solid rgba(147,197,253,0.4); }
        .bac-why strong { color:rgba(255,255,255,0.85);font-weight:600; }
        .bac-btns { display:flex;gap:7px; }
        .bac-btn-primary { flex:1;padding:8px 0;background:var(--blue);color:#fff;border:none;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;transition:opacity .15s; }
        .bac-btn-primary:hover { opacity:.9; }
        .bac-btn-secondary { flex:1;padding:8px 0;background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.85);border:1px solid rgba(255,255,255,0.18);border-radius:9px;font-size:12px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;transition:all .15s; }
        .bac-btn-secondary:hover { background:rgba(255,255,255,0.16); }

        /* Summit pin rendered via Mapbox Marker in MapboxMap.tsx */

        /* Mapbox attribution */
        .map-attrib { position:absolute;bottom:10px;left:14px;display:flex;align-items:center;gap:5px;background:rgba(255,255,255,0.8);backdrop-filter:blur(6px);border-radius:6px;padding:3px 8px;font-size:10px;color:var(--text-3); }

        /* ── BOTTOM SECTION ── */
        .bottom { flex-shrink:0;background:var(--bg);display:flex;flex-direction:column;gap:0;overflow:hidden; }

        /* Forecast strip — compact single row */
        .fc-strip { display:flex;align-items:stretch;background:var(--white);border-top:1px solid var(--border-2);border-bottom:1px solid var(--border-2);padding:0 14px;gap:0;overflow-x:auto;flex-shrink:0; }
        .fc-strip-lbl { font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.07em;display:flex;align-items:center;padding-right:14px;border-right:1px solid var(--border);margin-right:2px;white-space:nowrap;flex-shrink:0; }
        .fc-strip-day { display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 10px;border-right:1px solid var(--border);flex-shrink:0;min-width:62px; }
        .fc-strip-day:last-child { border-right:none; }
        .fc-strip-day.best { background:linear-gradient(180deg,#eff6ff 0%,#fff 100%); }
        .fc-strip-label { font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em; }
        .fc-strip-icon { font-size:15px;line-height:1; }
        .fc-strip-snow { font-size:11px;font-weight:800;color:#2563eb; }
        .fc-strip-snow.zero { color:var(--text-3);font-weight:500; }
        .fc-strip-temp { font-size:9px;color:var(--text-3);white-space:nowrap; }

        /* Runs + Lifts row */
        .bottom-panels { flex:1;display:flex;gap:10px;padding:10px 14px;overflow:hidden;min-height:0; }

        /* Top Runs card */
        .runs-card { flex:1;background:var(--white);border-radius:14px;border:1px solid var(--border-2);display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--shadow); }
        .runs-hdr { display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--border);flex-shrink:0; }
        .runs-hdr-title { font-size:13px;font-weight:700;color:var(--text);flex:1; }
        .runs-hdr-badge { font-size:10px;font-weight:600;color:var(--text-3);background:var(--bg);padding:2px 7px;border-radius:10px; }
        .runs-grid { display:grid;grid-template-columns:repeat(3,1fr);flex:1;overflow:hidden; }
        .run-col { padding:10px 12px;border-right:1px solid var(--border);display:flex;flex-direction:column;gap:0;overflow:hidden; }
        .run-col:last-child { border-right:none; }
        /* trail name + diff */
        .run-name-row { display:flex;align-items:center;gap:6px;margin-bottom:3px; }
        .run-diff-icon { width:18px;height:18px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;flex-shrink:0; }
        .run-name { font-size:12px;font-weight:700;color:var(--text);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        /* condition line */
        .run-condition { font-size:11px;color:var(--text-2);font-weight:500;padding-left:24px;margin-bottom:3px; }
        /* reason tag */
        .run-reason { display:flex;align-items:center;gap:4px;padding-left:24px;margin-bottom:6px; }
        .run-reason-tag { font-size:10px;font-weight:600;padding:2px 7px;border-radius:10px;white-space:nowrap; }
        .run-reason-tag.powder  { background:#eff6ff;color:#1d40af; }
        .run-reason-tag.groomed { background:#f0fdf4;color:#15803d; }
        .run-reason-tag.crowd   { background:#f0fdf4;color:#15803d; }
        .run-reason-tag.expert  { background:#fef2f2;color:#b91c1c; }
        .run-reason-tag.best    { background:#fffbeb;color:#92400e; }
        /* lift access row */
        .run-lift { display:flex;align-items:center;gap:5px;padding:5px 8px;background:var(--bg);border-radius:8px;margin-top:auto; }
        .run-lift-dot { width:7px;height:7px;border-radius:50%;flex-shrink:0; }
        .run-lift-name { font-size:10px;font-weight:600;color:var(--text-2);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .run-lift-time { font-size:10px;color:var(--text-3);white-space:nowrap; }

        /* Smart Lift Access card */
        .lifts-card { width:230px;flex-shrink:0;background:var(--white);border-radius:14px;border:1px solid var(--border-2);display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--shadow); }
        .lifts-hdr { display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--border);flex-shrink:0; }
        .lifts-hdr-title { font-size:13px;font-weight:700;color:var(--text);flex:1; }
        .lift-row { display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid var(--border); }
        .lift-row:last-child { border-bottom:none; }
        .lift-status-dot { width:8px;height:8px;border-radius:50%;flex-shrink:0; }
        .lift-row-name { font-size:11px;font-weight:600;color:var(--text);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .lift-row-tag { font-size:9px;font-weight:700;padding:2px 6px;border-radius:8px;white-space:nowrap;flex-shrink:0; }
        .lift-row-tag.best    { background:#eff6ff;color:#1d4ed8; }
        .lift-row-tag.busy    { background:#fffbeb;color:#92400e; }
        .lift-row-tag.avoid   { background:#fef2f2;color:#b91c1c; }
        .lift-row-tag.open    { background:#f0fdf4;color:#15803d; }
        .lift-row-sub { font-size:9px;color:var(--text-3);margin-top:1px; }

        /* ── RIGHT PANEL ── */
        .rpanel { width:262px;flex-shrink:0;background:var(--bg);border-left:1px solid var(--border-2);overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:10px; }
        .rp-card { background:var(--white);border-radius:14px;border:1px solid var(--border-2);padding:14px;box-shadow:var(--shadow); }
        .rp-card-hdr { font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px; }

        /* 1. Resort Summary */
        .rs-name { font-size:16px;font-weight:800;color:var(--text);line-height:1.2;margin-bottom:2px; }
        .rs-sub  { font-size:11px;color:var(--text-3);margin-bottom:12px; }
        .rs-grid { display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--border);padding-top:10px;gap:0; }
        .rs-zone { text-align:center;padding:0 4px; }
        .rs-zone:not(:last-child) { border-right:1px solid var(--border); }
        .rs-zone-lbl { font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px; }
        .rs-zone-temp { font-size:20px;font-weight:800;color:var(--text);line-height:1; }
        .rs-zone-unit { font-size:10px;color:var(--text-3);font-weight:400; }
        .rs-zone-detail { font-size:10px;color:var(--text-3);margin-top:2px; }
        .rs-snow-row { display:flex;align-items:center;gap:6px;margin-top:10px;padding:8px 10px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:8px; }
        .rs-snow-icon { font-size:16px; }
        .rs-snow-val { font-size:14px;font-weight:800;color:#1d40af; }
        .rs-snow-lbl { font-size:11px;color:#3b82f6;font-weight:500; }

        /* 2. Score card */
        .sc-card {
          background:var(--white);border-radius:18px;
          border:1px solid rgba(100,150,200,0.18);
          padding:20px 16px 16px;
          box-shadow:0 2px 12px rgba(15,40,80,0.07);
          display:flex;flex-direction:column;align-items:center;gap:0;
        }
        .sc-hdr { font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.09em;margin-bottom:4px;align-self:flex-start; }
        .sc-day-label {
          font-size:15px;font-weight:800;letter-spacing:-.02em;
          margin-top:2px;margin-bottom:6px;
        }
        .sc-explanation {
          font-size:11px;color:var(--text-3);text-align:center;
          line-height:1.6;margin-bottom:10px;
          max-width:215px;padding:0 4px;
        }
        .sc-divider { width:100%;height:1px;background:var(--border);margin:4px 0 10px; }
        .sc-drivers { display:flex;flex-wrap:wrap;gap:5px;justify-content:center;width:100%; }
        .sc-driver {
          display:flex;align-items:center;gap:4px;
          padding:4px 9px;border-radius:20px;
          font-size:10px;font-weight:600;border:1px solid transparent;
          white-space:nowrap;
        }
        .sc-driver.pos { background:#f0fdf4;color:#15803d;border-color:rgba(34,197,94,0.25); }
        .sc-driver.neg { background:#fef2f2;color:#991b1b;border-color:rgba(239,68,68,0.25); }
        .sc-driver.neu { background:var(--bg);color:var(--text-3);border-color:var(--border); }
        .sc-logo-row { display:flex;align-items:center;gap:6px;margin-top:12px;padding-top:10px;border-top:1px solid var(--border);align-self:stretch;justify-content:center; }
        .sc-logo-row img { height:20px;width:auto; }
        .sc-logo-brand { font-size:12px;font-weight:800;color:var(--text);letter-spacing:-.03em; }

        /* 3. Next 6 hours */
        .h6-card { background:var(--white);border-radius:14px;border:1px solid var(--border-2);padding:12px 14px;box-shadow:var(--shadow); }
        .h6-row { display:grid;grid-template-columns:repeat(4,1fr);gap:2px;margin-top:8px; }
        .h6-col { display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 2px;border-radius:8px; }
        .h6-col.best { background:var(--blue-light); }
        .h6-time { font-size:9px;font-weight:600;color:var(--text-3); }
        .h6-icon { font-size:18px;line-height:1; }
        .h6-temp { font-size:12px;font-weight:700;color:var(--text); }
        .h6-snow { font-size:9px;font-weight:700;color:#2563eb; }
        .h6-cond { font-size:9px;color:var(--text-3);text-align:center;line-height:1.3; }

        /* 4. Crowd insights */
        .ci-card { background:var(--white);border-radius:14px;border:1px solid var(--border-2);padding:12px 14px;box-shadow:var(--shadow); }
        .ci-row { display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border); }
        .ci-row:last-child { border-bottom:none;padding-bottom:0; }
        .ci-icon { font-size:18px;flex-shrink:0; }
        .ci-body { flex:1;min-width:0; }
        .ci-name { font-size:11px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .ci-desc { font-size:10px;color:var(--text-3);margin-top:1px; }
        .ci-pill { font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;white-space:nowrap;flex-shrink:0; }
        .ci-pill.green  { background:#f0fdf4;color:#16a34a; }
        .ci-pill.yellow { background:#fffbeb;color:#92400e; }
        .ci-pill.red    { background:#fef2f2;color:#b91c1c; }

        /* 5. Smart alerts */
        .sa-card { background:var(--white);border-radius:14px;border:1px solid var(--border-2);padding:12px 14px;box-shadow:var(--shadow); }
        .sa-alert { display:flex;align-items:flex-start;gap:8px;padding:7px 8px;border-radius:9px;margin-bottom:6px; }
        .sa-alert:last-child { margin-bottom:0; }
        .sa-alert.wind   { background:#fffbeb;border:1px solid rgba(245,158,11,0.25); }
        .sa-alert.powder { background:#eff6ff;border:1px solid rgba(59,130,246,0.25); }
        .sa-alert.tip    { background:#f0fdf4;border:1px solid rgba(34,197,94,0.2); }
        .sa-alert.info   { background:var(--bg);border:1px solid var(--border); }
        .sa-emoji { font-size:16px;flex-shrink:0;margin-top:1px; }
        .sa-body { flex:1;min-width:0; }
        .sa-title { font-size:11px;font-weight:700;color:var(--text);line-height:1.3; }
        .sa-sub   { font-size:10px;color:var(--text-3);margin-top:2px;line-height:1.4; }

        /* PowderIQ footer */
        .rp-footer { background:var(--white);border-radius:14px;border:1px solid var(--border-2);padding:10px 14px;box-shadow:var(--shadow);display:flex;align-items:center;gap:8px; }
        .rp-footer img { height:22px;width:auto; }
        .rp-footer-brand { font-size:13px;font-weight:800;color:var(--text);letter-spacing:-0.03em; }

        @keyframes spin { to { transform:rotate(360deg); } }
        @media(max-width:1200px) { .rpanel { display:none; } }
        @media(max-width:900px) { .sidebar { display:none; } }

        /* ── Pro gate overlay ── */
        .pro-gate { position:relative;overflow:hidden;border-radius:inherit; }
        .pro-gate-blur { filter:blur(3px);pointer-events:none;user-select:none;opacity:0.5; }
        .pro-gate-overlay {
          position:absolute;inset:0;display:flex;flex-direction:column;
          align-items:center;justify-content:center;gap:8px;
          background:rgba(240,245,251,0.85);backdrop-filter:blur(2px);
          border-radius:inherit;z-index:10;padding:16px;text-align:center;
        }
        .pro-badge { display:flex;align-items:center;gap:5px;padding:4px 10px;
          background:linear-gradient(135deg,#1d6ef5,#0d9488);
          color:#fff;border-radius:20px;font-size:10px;font-weight:700;
          letter-spacing:.06em;text-transform:uppercase;margin-bottom:2px; }
        .pro-gate-title { font-size:13px;font-weight:700;color:var(--text); }
        .pro-gate-sub { font-size:11px;color:var(--text-3);line-height:1.5;max-width:180px; }
        .pro-gate-btn { padding:7px 16px;background:var(--blue);color:#fff;
          border:none;border-radius:8px;font-size:12px;font-weight:700;
          cursor:pointer;font-family:Inter,sans-serif;margin-top:4px;
          text-decoration:none;display:inline-block; }
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
              <div key={fav.id} className={`sb-resort${isAct?' act':''}`}
                onClick={() => setSelectedFav(fav)}
                onMouseEnter={() => {
                  // Pre-warm OSM cache on hover so clicking is instant
                  if (fav.mountain.latitude && !isAct) {
                    const lat = fav.mountain.latitude, lon = fav.mountain.longitude ?? 0;
                    const k = `${lat.toFixed(4)},${lon.toFixed(4)}`;
                    // Fire a background pre-fetch of the trails cache
                    fetch(`/api/mountains/${fav.mountain.id}/trails`,
                      { headers: { Authorization: `Bearer ${token}` } })
                      .catch(() => {});
                  }
                }}>
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
            {activeFav?.mountain.latitude && TOKEN_OK ? (() => {
              const vft = (activeFav.mountain.topElevFt ?? 3000) - (activeFav.mountain.baseElevFt ?? 1000);
              const autoZoom = vft < 400 ? 14.5 : vft < 1000 ? 13.5 : vft < 2000 ? 13 : 12.5;
              const snow24 = scoreData?.snowfall24hIn ?? 0;
              return (
                <div style={{position:'relative',width:'100%',height:'100%'}}>
                  <MapboxMap
                    lat={activeFav.mountain.latitude}
                    lon={activeFav.mountain.longitude ?? 0}
                    mountainId={activeFav.mountain.id}
                    prefetchIds={favorites.filter(f=>f.id!==activeFav.id).map(f=>f.mountain.id).slice(0,4)}
                    prefetchCoords={favorites.filter(f=>f.id!==activeFav.id&&f.mountain.latitude).map(f=>[f.mountain.latitude!,f.mountain.longitude??0] as [number,number]).slice(0,4)}
                    zoom={autoZoom}
                    mode={isPro ? mapMode : 'trail'}
                    enable3D={isPro}
                    trails={trails}
                    diffFilter={diffFilter}
                    resortName={activeFav.mountain.name}
                    onLoad={() => setMapLoaded(true)}
                    bestZone={isPro && score > 0 ? {
                      lat: activeFav.mountain.latitude + (snow24 > 2 ? 0.008 : 0.003),
                      lon: activeFav.mountain.longitude ?? 0,
                      radiusKm: snow24 > 2 ? 1.5 : 1.0,
                      label: snow24 > 2 ? 'Powder Zone' : 'Groomed Zone',
                    } : null}
                    liftStatuses={isPro ? Object.fromEntries(lifts.map(l=>[l.liftName,l.status])) : undefined}
                  />
                  {/* Pro upgrade overlay for free users */}
                  {!isPro && (
                    <div style={{position:'absolute',bottom:14,left:14,right:14,
                      background:'rgba(13,27,46,0.82)',backdropFilter:'blur(12px)',
                      borderRadius:12,padding:'10px 14px',display:'flex',
                      alignItems:'center',gap:10,cursor:'pointer',
                      border:'1px solid rgba(255,255,255,0.1)'}}
                      onClick={() => window.location.href='/account/billing'}>
                      <span style={{fontSize:20}}>🏔️</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:700,color:'#fff',marginBottom:2}}>
                          Upgrade to Pro for 3D Maps
                        </div>
                        <div style={{fontSize:10,color:'rgba(255,255,255,0.55)'}}>
                          3D terrain · Best run highlights · Live lift status · Free camera
                        </div>
                      </div>
                      <div style={{background:'var(--blue)',color:'#fff',borderRadius:8,
                        padding:'6px 12px',fontSize:11,fontWeight:700,whiteSpace:'nowrap',flexShrink:0}}>
                        Go Pro →
                      </div>
                    </div>
                  )}
                </div>
              );
            })() : (
              <img className="map-img" src={heroImg} alt={activeFav?.mountain.name ?? 'Resort'}
                onError={e => { (e.target as HTMLImageElement).src='https://images.unsplash.com/photo-1605540436563-5bca919ae766?w=1200&q=80'; }}/>
            )}

            {/* Best Area insight card — Pro only */}
            {activeFav && isPro && (() => {
              const snow24  = scoreData?.snowfall24hIn ?? 0;
              const wind    = weatherZones['summit']?.windMph ?? scoreData?.windMph ?? 0;
              const temp    = scoreData?.tempF ?? 28;
              const base    = scoreData?.snowDepthIn ?? 0;

              // ── Determine best area name based on conditions + skill ──────────
              let areaName = 'Main Mountain';
              let areaHighlight = '';
              if (snow24 > 4 && (skillLevel === 'advanced' || skillLevel === 'expert')) {
                areaName = 'Summit & Trees'; areaHighlight = 'Powder';
              } else if (snow24 > 2 && groomedCount > 0) {
                areaName = 'Upper Groomed Runs'; areaHighlight = 'Fresh Corduroy';
              } else if (groomedCount > 0 && (skillLevel === 'beginner' || skillLevel === 'intermediate')) {
                areaName = 'Groomed Terrain'; areaHighlight = 'Groomed';
              } else if (wind > 25) {
                areaName = 'Lower Mountain'; areaHighlight = 'Sheltered';
              } else if (trails.find(t => t.status === 'groomed')) {
                const t = trails.find(t => t.status === 'groomed');
                areaName = t!.trailName; areaHighlight = 'Groomed';
              } else if (trails.find(t => t.status === 'open')) {
                const t = trails.find(t => t.status === 'open');
                areaName = t!.trailName; areaHighlight = '';
              }

              // ── Build chips from real data ────────────────────────────────────
              const chips: {label:string; cls:string}[] = [];
              if (snow24 > 0) chips.push({label:`❄ ${snow24.toFixed(1)}" in last 12h`, cls:'snow'});
              if (wind <= 10) chips.push({label:'💨 Calm winds', cls:'wind'});
              else if (wind <= 20) chips.push({label:`💨 Light wind ${Math.round(wind)} mph`, cls:'wind'});
              else chips.push({label:`⚠ Gusts ${Math.round(wind)} mph`, cls:'warn'});
              if (groomedCount > 0) chips.push({label:'✓ Groomed', cls:'cond'});
              if (temp >= 20 && temp <= 32) chips.push({label:`🌡 ${Math.round(temp)}°F ideal`, cls:'cond'});
              else if (temp > 36) chips.push({label:`🌡 ${Math.round(temp)}°F warm`, cls:'warn'});

              // ── Personalized "why" explanation ──────────────────────────────
              const styleLabel: Record<string,string> = {
                powder:'powder hound', all_mountain:'all-mountain rider',
                freestyle:'freestyle rider', beginner:'beginner'
              };
              const skillLabel: Record<string,string> = {
                beginner:'beginner', intermediate:'intermediate',
                advanced:'advanced', expert:'expert'
              };
              const me = styleLabel[riderStyle] ?? 'skier';
              const sk = skillLabel[skillLevel] ?? 'intermediate';

              let why = '';
              if (snow24 > 5 && (skillLevel === 'advanced' || skillLevel === 'expert')) {
                why = `As an <strong>${sk} ${me}</strong>, this is your window — untracked lines are opening right now.`;
              } else if (snow24 > 2 && riderStyle === 'powder') {
                why = `${snow24.toFixed(1)}" overnight — ideal for a <strong>${me}</strong>. Hit the trees early before it tracks out.`;
              } else if (groomedCount > 0 && (skillLevel === 'intermediate' || skillLevel === 'beginner')) {
                why = `Groomed and fast — the ideal terrain for an <strong>${sk} rider</strong> today.`;
              } else if (wind <= 10 && groomedCount > 0) {
                why = `Calm winds and groomed runs — great all-mountain day for <strong>${sk}s</strong>.`;
              } else if (wind > 25) {
                why = `Upper mountain is gusty today. <strong>${sk}s</strong> will find better conditions lower down.`;
              } else if (temp > 36) {
                why = `Spring conditions with ${Math.round(temp)}°F temps. <strong>${sk}s</strong> will want to ski early before slush.`;
              } else {
                why = `Solid conditions across the mountain — a good day for an <strong>${sk} ${me}</strong>.`;
              }

              return (
                <div className="best-area-card">
                  <div className="bac-eyebrow">
                    <div className="bac-eyebrow-dot"/>
                    <span className="bac-eyebrow-text">Best Area Right Now</span>
                  </div>
                  <div className="bac-title">{areaName}{areaHighlight && <span> · {areaHighlight}</span>}</div>
                  <div className="bac-chips">
                    {chips.map((c,i) => <span key={i} className={`bac-chip ${c.cls}`}>{c.label}</span>)}
                  </div>
                  <div className="bac-why" dangerouslySetInnerHTML={{__html: why}}/>
                  <div className="bac-btns">
                    <button className="bac-btn-primary" onClick={() => setActivePanel('trails')}>View Runs</button>
                    <button className="bac-btn-secondary" onClick={() => setMapMode('trail')}>Navigate on Map</button>
                  </div>
                </div>
              );
            })()}

            {/* Summit pin is now rendered as a Mapbox Marker inside MapboxMap */}

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

          {/* ── BOTTOM SECTION ── */}
          <div className="bottom">

            {/* Forecast strip — compact row */}
            <div className="fc-strip">
              <span className="fc-strip-lbl">📅 Forecast</span>
              {forecast.length === 0
                ? <div style={{padding:'8px 12px',fontSize:11,color:'var(--text-3)',display:'flex',alignItems:'center'}}>Select a resort</div>
                : (() => {
                  const maxSnow = Math.max(...forecast.map(f=>f.snowIn), 0.1);
                  return forecast.slice(0,10).map((f,i) => {
                    const icon = (f.snowIn??0)>3?'🌨️':(f.snowIn??0)>0?'🌦️':f.conditionDesc?.toLowerCase().includes('clear')?'☀️':f.conditionDesc?.toLowerCase().includes('cloud')?'⛅':'🌤️';
                    const isBest = f.snowIn === Math.max(...forecast.map(x=>x.snowIn));
                    return (
                      <div key={f.date} className={`fc-strip-day${isBest&&f.snowIn>0?' best':''}`}>
                        <span className="fc-strip-label">{f.dayLabel?.slice(0,3)}</span>
                        <span className="fc-strip-icon">{icon}</span>
                        <span className={`fc-strip-snow${f.snowIn===0?' zero':''}`}>{f.snowIn>0?`${f.snowIn.toFixed(1)}"`:'—'}</span>
                        <span className="fc-strip-temp">{f.tempHighF?.toFixed(0)??'--'}°/{f.tempLowF?.toFixed(0)??'--'}°</span>
                      </div>
                    );
                  });
                })()
              }
            </div>

            {/* Runs + Lifts panels */}
            <div className="bottom-panels">

              {/* Top Runs Right Now — hidden when resort is closed */}
              {!isClosed && (
              <ProGate isPro={isPro} title="Top Runs Personalization" desc="Smart trail ranking based on your skill level, riding style, and live conditions.">
              <div className="runs-card">
                <div className="runs-hdr">
                  <span style={{fontSize:16}}>⛷️</span>
                  <span className="runs-hdr-title">Top Runs Right Now</span>
                  {isClosed
                    ? <span style={{fontSize:10,fontWeight:600,background:'#fef2f2',color:'#b91c1c',padding:'2px 8px',borderRadius:10}}>Season Closed</span>
                    : trails.filter(t=>t.status==='open'||t.status==='groomed').length > 0 &&
                      <span className="runs-hdr-badge">{trails.filter(t=>t.status==='open'||t.status==='groomed').length} open</span>
                  }
                </div>
                <div className="runs-grid">
                  {(() => {
                    const DCLS: Record<string,{bg:string,col:string,icon:string}> = {
                      green:        {bg:'#dcfce7',col:'#16a34a',icon:'■'},
                      blue:         {bg:'#dbeafe',col:'#2563eb',icon:'●'},
                      black:        {bg:'#e5e7eb',col:'#111827',icon:'◆'},
                      double_black: {bg:'#d1d5db',col:'#030712',icon:'◆◆'},
                      terrain_park: {bg:'#ffedd5',col:'#ea580c',icon:'▲'},
                      backcountry:  {bg:'#fef9c3',col:'#854d0e',icon:'⬡'},
                    };
                    const snow24 = scoreData?.snowfall24hIn ?? 0;
                    const wind   = scoreData?.windMph ?? (weatherZones['summit']?.windMph ?? 0);
                    const dow    = new Date().getDay();
                    const isWeekend = dow === 0 || dow === 6;

                    // Personalized smart ranking based on rider profile + real conditions
                    type RunCard = {trail:typeof trails[0]; reason:string; reasonCls:string; condition:string; liftName?:string; liftColor?:string; accessTime:string};
                    const scored: RunCard[] = trails
                      .filter(t => t.status==='open'||t.status==='groomed')
                      .map(t => {
                        let rank = 0;
                        let reason = 'Good conditions'; let reasonCls = 'best';
                        let condition = t.status==='groomed' ? 'Groomed · Soft snow' : 'Open · Packed powder';

                        // ── Profile-based difficulty preference ──────────────
                        const prefDiffs: Record<string,string[]> = {
                          beginner:     ['green'],
                          intermediate: ['green','blue'],
                          advanced:     ['blue','black'],
                          expert:       ['black','double_black'],
                        };
                        const preferred = prefDiffs[skillLevel] ?? ['blue'];
                        if (preferred.includes(t.difficulty)) rank += 20;
                        else if (t.difficulty === 'green' && skillLevel === 'advanced') rank -= 5; // too easy

                        // ── Riding style boost ──────────────────────────────
                        if (riderStyle === 'powder' && snow24 > 2) {
                          if (t.difficulty === 'black' || t.difficulty === 'double_black') rank += 15;
                          reason = snow24 > 5 ? `${snow24.toFixed(1)}" fresh powder` : 'Powder conditions'; reasonCls = 'powder';
                        } else if (riderStyle === 'freestyle' && t.difficulty === 'terrain_park') {
                          rank += 25; reason = 'Park terrain'; reasonCls = 'best';
                        } else if (riderStyle === 'beginner' || skillLevel === 'beginner') {
                          if (t.status === 'groomed' && t.difficulty === 'green') { rank += 20; reason = 'Ideal for beginners'; reasonCls = 'groomed'; }
                        }

                        // ── Conditions boost ────────────────────────────────
                        if (snow24 > 5 && reason === 'Good conditions') { reason = `${snow24.toFixed(1)}" fresh powder`; reasonCls = 'powder'; rank += 25; }
                        else if (snow24 > 2 && reason === 'Good conditions') { reason = 'Light powder dusting'; reasonCls = 'powder'; rank += 15; }
                        else if (t.status === 'groomed' && reason === 'Good conditions') { reason = 'Groomed & fast'; reasonCls = 'groomed'; rank += 12; }

                        // Weekday crowd bonus
                        if (!isWeekend && t.status === 'open') { rank += 8; if (reason === 'Good conditions') { reason = 'Low traffic now'; reasonCls = 'crowd'; } }

                        // Snow depth
                        if ((t.snowDepthIn ?? 0) > 0) condition = `${t.status==='groomed'?'Groomed · ':'Open · '}${t.snowDepthIn}" base`;

                        // Difficulty-specific labels
                        if ((t.difficulty === 'double_black'||t.difficulty === 'black') && snow24 > 3 && (skillLevel==='advanced'||skillLevel==='expert')) {
                          reason = 'Best advanced terrain now'; reasonCls = 'expert'; rank += 20;
                        } else if ((t.difficulty==='green'||t.difficulty==='blue') && t.status==='groomed' && skillLevel==='intermediate') {
                          reason = 'Best for intermediates'; reasonCls = 'groomed';
                        }

                        // Wind penalty
                        if (wind > 25 && (t.difficulty==='double_black'||t.difficulty==='black')) rank -= 12;

                        const openLift = lifts.find(l => l.status === 'open');
                        return { trail:t, reason, reasonCls, condition, liftName:openLift?.liftName, liftColor:'#22c55e', accessTime: openLift?.waitMinutes ? `~${openLift.waitMinutes} min` : '~10 min', rank } as any;
                      })
                      .sort((a:any,b:any) => b.rank - a.rank)
                      .slice(0,3);

                    if (isClosed) return (
                      <div style={{gridColumn:'1/-1',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:8,padding:'20px',color:'var(--text-3)'}}>
                        <span style={{fontSize:32}}>🏔️</span>
                        <span style={{fontSize:13,fontWeight:600,color:'var(--text-2)'}}>Resort Closed for the Season</span>
                        <span style={{fontSize:11,textAlign:'center',maxWidth:220}}>Check back when the season opens in November.</span>
                      </div>
                    );
                    if (scored.length === 0) return (
                      <div style={{gridColumn:'1/-1',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:8,padding:'20px',color:'var(--text-3)'}}>
                        <span style={{fontSize:32}}>⛷️</span>
                        <span style={{fontSize:12}}>{activeFav ? 'No trail data available' : 'Select a resort to see top runs'}</span>
                      </div>
                    );

                    return scored.map((rc: RunCard, i: number) => {
                      const dc = DCLS[rc.trail.difficulty] ?? DCLS.blue;
                      return (
                        <div key={rc.trail.id} className="run-col">
                          <div className="run-name-row">
                            <div className="run-diff-icon" style={{background:dc.bg,color:dc.col}}>{dc.icon}</div>
                            <span className="run-name">{rc.trail.trailName}</span>
                          </div>
                          <div className="run-condition">{rc.condition}</div>
                          <div className="run-reason">
                            <span className={`run-reason-tag ${rc.reasonCls}`}>{rc.reason}</span>
                          </div>
                          {rc.liftName && (
                            <div className="run-lift">
                              <div className="run-lift-dot" style={{background:rc.liftColor}}/>
                              <span className="run-lift-name">{rc.liftName}</span>
                              <span className="run-lift-time">{rc.accessTime}</span>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
              </ProGate>
              )}

              {/* Smart Lift Access */}
              <div className="lifts-card">
                <div className="lifts-hdr">
                  <span style={{fontSize:15}}>🚡</span>
                  <span className="lifts-hdr-title">Lift Access</span>
                  {liftieStats && <span style={{fontSize:10,fontWeight:600,color:'var(--green)'}}>{liftieStats.open} open</span>}
                </div>
                {(() => {
                  const wind = weatherZones['summit']?.windMph ?? scoreData?.windMph ?? 0;
                  const dow = new Date().getDay();
                  const isWeekend = dow === 0 || dow === 6;

                  type LiftRow = { lift: typeof lifts[0]; tag: string; tagCls: string; sub: string };
                  const rows: LiftRow[] = [];

                  // Best lift: open gondola or highest-capacity
                  const gondola = lifts.find(l => l.status==='open' && (l.liftType==='gondola'||l.liftName.toLowerCase().includes('gondola')));
                  const bestOpen = gondola ?? lifts.find(l => l.status==='open');
                  if (bestOpen) rows.push({
                    lift: bestOpen,
                    tag: 'Best access', tagCls: 'best',
                    sub: gondola ? 'Gondola · Low exposure' : 'Open · Low crowd',
                  });

                  // Second open lift with different story
                  const secondOpen = lifts.filter(l=>l.status==='open' && l.id !== bestOpen?.id)[0];
                  if (secondOpen) {
                    const isBusy = isWeekend;
                    rows.push({
                      lift: secondOpen,
                      tag: isBusy ? 'Moderate wait' : 'Quick access',
                      tagCls: isBusy ? 'busy' : 'open',
                      sub: isBusy ? 'Weekend · Expect queues' : 'Weekday · Short lines',
                    });
                  }

                  // Wind hold lift
                  const holdLift = lifts.find(l => l.status==='on_hold');
                  if (holdLift) rows.push({
                    lift: holdLift,
                    tag: 'Wind hold', tagCls: 'avoid',
                    sub: `${Math.round(wind)} mph — on hold`,
                  });

                  // Scheduled lift
                  const schedLift = lifts.find(l => l.status==='scheduled');
                  if (schedLift && rows.length < 4) rows.push({
                    lift: schedLift,
                    tag: 'Opening soon', tagCls: 'best',
                    sub: 'Scheduled — check app',
                  });

                  // Third open lift
                  const thirdOpen = lifts.filter(l=>l.status==='open').slice(2,3)[0];
                  if (thirdOpen && rows.length < 4) rows.push({
                    lift: thirdOpen,
                    tag: wind > 20 ? 'Sheltered' : 'Open',
                    tagCls: 'open',
                    sub: wind > 20 ? 'Lower wind exposure' : 'Good access',
                  });

                  if (rows.length === 0) return (
                    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:8,padding:'16px',color:'var(--text-3)'}}>
                      <span style={{fontSize:28}}>🚡</span>
                      <span style={{fontSize:11}}>{activeFav ? 'No lift data' : 'Select a resort'}</span>
                    </div>
                  );

                  return rows.slice(0,4).map((r, i) => (
                    <div key={r.lift.id} className="lift-row">
                      <div className="lift-status-dot" style={{background:LIFT_COLOR[r.lift.status]||'#6b7280'}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div className="lift-row-name">{r.lift.liftName}</div>
                        <div className="lift-row-sub">{r.sub}</div>
                      </div>
                      <span className={`lift-row-tag ${r.tagCls}`}>{r.tag}</span>
                    </div>
                  ));
                })()}
              </div>

            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="rpanel">

          {/* ── 1. Resort Summary ── */}
          <div className="rp-card">
            <div className="rs-name">{activeFav?.mountain.name ?? '—'}</div>
            <div className="rs-sub">{activeFav?.mountain.state ? `${activeFav.mountain.state} · Resort` : 'Resort'}</div>
            <div className="rs-grid">
              {([['summit','🏔','Summit'],['mid','⛷','Mid'],['base','🏠','Base']] as const).map(([key,icon,label]) => {
                const z = weatherZones[key];
                const temp = z?.tempF ?? (key==='summit' ? scoreData?.tempF : null);
                const wind = z?.windMph ?? (key==='summit' ? scoreData?.windMph : null);
                const snow = z?.snowfall24hIn ?? (key==='summit' ? scoreData?.snowfall24hIn : null);
                return (
                  <div key={key} className="rs-zone">
                    <div className="rs-zone-lbl">{icon} {label}</div>
                    <div className="rs-zone-temp">{temp != null ? Math.round(temp) : '--'}<span className="rs-zone-unit">°F</span></div>
                    <div className="rs-zone-detail">{wind != null ? `${Math.round(wind)} mph wind` : '--'}</div>
                  </div>
                );
              })}
            </div>
            {(scoreData?.snowfall24hIn ?? 0) > 0 && (
              <div className="rs-snow-row">
                <span className="rs-snow-icon">❄️</span>
                <span className="rs-snow-val">{scoreData!.snowfall24hIn!.toFixed(1)}"</span>
                <span className="rs-snow-lbl">fresh snow in last 24h</span>
              </div>
            )}
            {(scoreData?.snowfall24hIn ?? 0) === 0 && scoreData?.snowDepthIn != null && (
              <div className="rs-snow-row" style={{background:'linear-gradient(135deg,#f0fdf4,#dcfce7)',border:'1px solid rgba(34,197,94,0.15)'}}>
                <span className="rs-snow-icon">🏔️</span>
                <span className="rs-snow-val" style={{color:'#15803d'}}>{scoreData.snowDepthIn.toFixed(0)}"</span>
                <span className="rs-snow-lbl" style={{color:'#16a34a'}}>base depth · groomed</span>
              </div>
            )}
          </div>

          {/* ── 2. PowderIQ Score ── */}
          <div className="sc-card">
            <div className="sc-hdr">PowderIQ Score</div>

            {scoreLoading ? (
              <div style={{height:160,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <div style={{width:32,height:32,border:'3px solid #dbeafe',borderTopColor:'var(--blue)',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
              </div>
            ) : (() => {
              // Day quality config
              const quality = score>=80
                ? { label:'Outstanding Day', emoji:'🔥', color:'#16a34a', bg:'#f0fdf4', border:'rgba(34,197,94,0.2)' }
                : score>=65
                ? { label:'Great Day',       emoji:'✓',  color:'#0d9488', bg:'#f0fdfa', border:'rgba(13,148,136,0.2)' }
                : score>=50
                ? { label:'Good Day',        emoji:'',   color:'#2563eb', bg:'#eff6ff', border:'rgba(37,99,235,0.2)' }
                : score>=35
                ? { label:'Fair Day',        emoji:'',   color:'#d97706', bg:'#fffbeb', border:'rgba(217,119,6,0.2)' }
                : { label:'Challenging',     emoji:'',   color:'#dc2626', bg:'#fef2f2', border:'rgba(220,38,38,0.2)' };

              // Smart explanation from real data
              const snow24 = scoreData?.snowfall24hIn ?? 0;
              const wind   = scoreData?.windMph ?? 0;
              const temp   = scoreData?.tempF ?? 28;
              const depth  = scoreData?.snowDepthIn ?? 0;

              let explanation = '';
              if (!activeFav) {
                explanation = 'Select a resort to see your personalized powder score.';
              } else if (score === 0) {
                explanation = 'This resort appears to be closed for the season.';
              } else if (snow24 > 5 && wind <= 15) {
                explanation = `${snow24.toFixed(1)}" of fresh snow overnight with calm winds — prime conditions across the mountain.`;
              } else if (snow24 > 2 && wind <= 20) {
                explanation = `Fresh snow and light winds are boosting conditions. Great time to find untracked terrain.`;
              } else if (snow24 > 0 && wind > 25) {
                explanation = `New snow is offset by strong winds at ${Math.round(wind)} mph. Watch for wind holds on upper lifts.`;
              } else if (snow24 === 0 && groomedCount > 0 && wind <= 15) {
                explanation = `No new snow, but groomed runs and calm winds make for solid all-mountain conditions.`;
              } else if (temp > 36) {
                explanation = `Warm temps at ${Math.round(temp)}°F will soften snow by midday. Ski early for the best conditions.`;
              } else if (wind > 30) {
                explanation = `High winds at ${Math.round(wind)} mph are the main challenge today. Stick to sheltered lower terrain.`;
              } else if (depth > 40) {
                explanation = `Strong base of ${Math.round(depth)}" with solid coverage. A reliable day on the mountain.`;
              } else {
                explanation = scoreData?.conditionDesc ?? 'Computing current conditions for this resort.';
              }

              return (
                <>
                  <ScoreRing score={score}/>

                  {/* Day quality label pill */}
                  <div style={{
                    display:'flex',alignItems:'center',gap:5,
                    padding:'5px 14px',borderRadius:20,marginBottom:8,marginTop:2,
                    background:quality.bg,border:`1px solid ${quality.border}`,
                  }}>
                    <span style={{fontSize:13,fontWeight:800,color:quality.color,letterSpacing:'-.01em'}}>
                      {quality.label}{quality.emoji ? ` ${quality.emoji}` : ''}
                    </span>
                  </div>

                  {/* Explanation */}
                  <p className="sc-explanation">{explanation}</p>

                  {/* Driver chips */}
                  {scoreData && (
                    <>
                      <div className="sc-divider"/>
                      <div className="sc-drivers">
                        {snow24 > 2    && <span className="sc-driver pos">❄ {snow24.toFixed(1)}" snow</span>}
                        {snow24 === 0 && groomedCount > 0 && <span className="sc-driver pos">🎿 Groomed</span>}
                        {wind <= 10   && <span className="sc-driver pos">💨 Calm winds</span>}
                        {wind > 10 && wind <= 20 && <span className="sc-driver neu">💨 {Math.round(wind)} mph</span>}
                        {wind > 25    && <span className="sc-driver neg">⚠ {Math.round(wind)} mph wind</span>}
                        {temp >= 20 && temp <= 32 && <span className="sc-driver pos">🌡 {Math.round(temp)}°F</span>}
                        {temp > 36    && <span className="sc-driver neg">🌡 {Math.round(temp)}°F warm</span>}
                        {depth > 0    && <span className="sc-driver neu">📏 {Math.round(depth)}" base</span>}
                        {openLifts > 0 && <span className="sc-driver neu">🚡 {openLifts} open</span>}
                      </div>
                    </>
                  )}

                  {/* PowderIQ branding */}
                  <div className="sc-logo-row">
                    <img src="/brand/powderiq_logo.png" alt="PowderIQ"/>
                    <span className="sc-logo-brand">PowderIQ</span>
                  </div>
                </>
              );
            })()}
          </div>

          {/* ── 3. Next 6 Hours — Pro only ── */}
          {forecast.length > 0 && isPro && (() => {
            const f = forecast[0];
            const f1 = forecast[1];
            // Build 4 time slots from today's data
            const hi = f?.tempHighF ?? 35;
            const lo = f?.tempLowF  ?? 22;
            const mid = (hi + lo) / 2;
            const hasSnow = (f?.snowIn ?? 0) > 0;
            const slots = [
              { time:'Now',   temp: hi,                 icon: hasSnow?'🌨️':'☀️', snow: hasSnow?(f!.snowIn*0.15).toFixed(1):null, cond: hasSnow?'Snowing':'Clear' },
              { time:'3h',    temp: Math.round(mid+1),  icon: hasSnow?'🌦️':'⛅',  snow: null, cond: hasSnow?'Flurries':'Partly cloudy' },
              { time:'6h',    temp: Math.round(mid-1),  icon: hasSnow?'🌨️':'🌤️',  snow: hasSnow?(f!.snowIn*0.1).toFixed(1):null, cond: hasSnow?'Snow':'Clearing' },
              { time:'12h',   temp: lo,                 icon: f1 && (f1.snowIn??0)>0?'🌨️':'🌤️', snow: f1&&(f1.snowIn??0)>0?(f1.snowIn*0.2).toFixed(1):null, cond: f1&&(f1.snowIn??0)>0?'Snow likely':'Clear' },
            ];
            const bestIdx = slots.findIndex(s => s.snow != null) ?? -1;
            return (
              <div className="h6-card">
                <div className="rp-card-hdr">Next 6 Hours</div>
                <div className="h6-row">
                  {slots.map((s,i) => (
                    <div key={s.time} className={`h6-col${i===bestIdx?' best':''}`}>
                      <span className="h6-time">{s.time}</span>
                      <span className="h6-icon">{s.icon}</span>
                      <span className="h6-temp">{Math.round(s.temp)}°</span>
                      {s.snow && <span className="h6-snow">{s.snow}"</span>}
                      <span className="h6-cond">{s.cond}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── 4. Crowd Insights — Pro only ── */}
          {isPro && (trails.length > 0 || lifts.length > 0) && (() => {
            const wind = weatherZones['summit']?.windMph ?? scoreData?.windMph ?? 0;
            // Curated insight rows — max 3, each tells a story
            const rows: {icon:string; name:string; desc:string; pill:string; cls:'green'|'yellow'|'red'}[] = [];

            // Low crowd: first open non-groomed trail (raw powder seekers go there, fewer intermediates)
            const rawOpen = trails.find(t => t.status==='open' && t.difficulty !== 'green');
            if (rawOpen) rows.push({
              icon: rawOpen.difficulty==='black'||rawOpen.difficulty==='double_black' ? '💎' : '🔵',
              name: rawOpen.trailName,
              desc: 'Open · Lower crowds expected',
              pill: 'Low crowd', cls: 'green',
            });

            // Moderate: groomed trail
            const groomed = trails.find(t => t.status==='groomed');
            if (groomed) rows.push({
              icon: groomed.difficulty==='green' ? '🟩' : '🔵',
              name: groomed.trailName,
              desc: 'Groomed · Moderate traffic',
              pill: 'Moderate', cls: 'yellow',
            });

            // Wind hold lift
            const holdLift = lifts.find(l => l.status==='on_hold');
            if (holdLift) rows.push({
              icon: '⚠️',
              name: holdLift.liftName,
              desc: 'Wind hold — conditions changing',
              pill: 'Avoid', cls: 'red',
            });

            // High wind = summit avoid
            if (wind > 28 && rows.length < 3) rows.push({
              icon: '🌬️',
              name: 'Summit Zone',
              desc: `${Math.round(wind)} mph winds — upper lifts at risk`,
              pill: 'High risk', cls: 'red',
            });

            // Groomed green = beginner congestion on weekends
            const greenGroomed = trails.find(t => t.status==='groomed' && t.difficulty==='green');
            if (greenGroomed && rows.length < 3) rows.push({
              icon: '🟩',
              name: greenGroomed.trailName,
              desc: 'Beginner area — expect congestion',
              pill: 'Busy', cls: 'yellow',
            });

            if (rows.length === 0) return null;
            return (
              <div className="ci-card">
                <div className="rp-card-hdr">Crowd Insights</div>
                {rows.slice(0,3).map((r,i) => (
                  <div key={i} className="ci-row">
                    <span className="ci-icon">{r.icon}</span>
                    <div className="ci-body">
                      <div className="ci-name">{r.name}</div>
                      <div className="ci-desc">{r.desc}</div>
                    </div>
                    <span className={`ci-pill ${r.cls}`}>{r.pill}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── 5. Smart Alerts — Pro only ── */}
          {isPro && activeFav && (() => {
            const wind      = weatherZones['summit']?.windMph ?? scoreData?.windMph ?? 0;
            const snow24h   = scoreData?.snowfall24hIn ?? 0;
            const snow48h   = scoreData?.snowfall48hIn ?? 0;
            const temp      = scoreData?.tempF ?? 28;
            const hasHold   = lifts.some(l => l.status === 'on_hold');
            const alerts: {type:'wind'|'powder'|'tip'|'info'; emoji:string; title:string; sub:string}[] = [];

            // Wind hold risk
            if (wind > 25 || hasHold) alerts.push({
              type:'wind', emoji:'💨',
              title: hasHold ? 'Wind Hold Active' : 'Wind Hold Risk',
              sub: hasHold
                ? `${lifts.filter(l=>l.status==='on_hold').length} lift(s) on hold — check before heading up`
                : `Summit gusts at ${Math.round(wind)} mph — upper lifts may close`,
            });

            // Powder window
            if (snow24h > 4) alerts.push({
              type:'powder', emoji:'❄️',
              title: 'Powder Window Open',
              sub: `${snow24h.toFixed(1)}" fresh — hit the trees and off-piste runs early`,
            });
            else if (snow48h > 3 && snow24h === 0) alerts.push({
              type:'powder', emoji:'🌨️',
              title: 'Powder Setting Up',
              sub: `${snow48h.toFixed(1)}" over 48h — off-piste may still have untracked snow`,
            });

            // Best time tip
            const groomedOpen = trails.filter(t => t.status==='groomed');
            if (groomedOpen.length > 0 && wind <= 15) alerts.push({
              type:'tip', emoji:'🎿',
              title: 'Best Time: Early Morning',
              sub: `${groomedCount} groomed runs — corduroy is freshest before 10 AM`,
            });

            // Warm weather warning
            if (temp > 36) alerts.push({
              type:'info', emoji:'🌡️',
              title: 'Warm Conditions',
              sub: `${Math.round(temp)}°F — spring skiing, expect soft snow by midday`,
            });

            // All clear
            if (alerts.length === 0 && score > 50) alerts.push({
              type:'tip', emoji:'✅',
              title: 'All Clear',
              sub: 'No significant hazards. Good conditions across the mountain.',
            });

            if (alerts.length === 0) return null;
            return (
              <div className="sa-card">
                <div className="rp-card-hdr">Smart Alerts</div>
                {alerts.slice(0,3).map((a,i) => (
                  <div key={i} className={`sa-alert ${a.type}`}>
                    <span className="sa-emoji">{a.emoji}</span>
                    <div className="sa-body">
                      <div className="sa-title">{a.title}</div>
                      <div className="sa-sub">{a.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Upgrade nudge for free users */}
          {!isPro && (
            <div style={{background:'linear-gradient(135deg,#1d6ef5,#0d9488)',borderRadius:14,
              padding:'16px',display:'flex',flexDirection:'column',gap:8}}>
              <div style={{fontSize:12,fontWeight:800,color:'#fff'}}>⭐ Upgrade to PowderIQ Pro</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.8)',lineHeight:1.5}}>
                Unlock 3D trail maps, personalized run recommendations, crowd insights, smart alerts, and more.
              </div>
              <a href="/account/billing" style={{padding:'8px 0',background:'rgba(255,255,255,0.2)',
                color:'#fff',borderRadius:8,fontSize:12,fontWeight:700,
                textAlign:'center',textDecoration:'none',border:'1px solid rgba(255,255,255,0.3)'}}>
                See Pro Plans →
              </a>
            </div>
          )}

          {/* PowderIQ footer */}
          <div className="rp-footer">
            <img src="/brand/powderiq_logo.png" alt="PowderIQ"/>
            <span className="rp-footer-brand">PowderIQ</span>
          </div>

        </div>
      </div>
    </>
  );
}
