'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import ScoreBadge from '@/components/ScoreBadge';

interface Mountain { id: string; name: string; state: string; imageUrl?: string; slug?: string }
interface FavoriteItem { id: string; mountain: Mountain; score?: number }

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

function getFallbackImage(name: string): string {
  return MOUNTAIN_IMAGES[name] ?? 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=70';
}

const SCORE_LABEL: Record<number, string> = {};
function getScoreLabel(score: number): string {
  if (score >= 90) return 'Powder Star';
  if (score >= 80) return 'Great';
  if (score >= 65) return 'Good';
  if (score >= 50) return 'Decent';
  return 'Low';
}
function getScoreColor(score: number): string {
  if (score >= 85) return '#1d6ef5';
  if (score >= 70) return '#22c55e';
  if (score >= 55) return '#f59e0b';
  return '#94a3b8';
}

const MOCK_FORECAST = [
  { day: 'Tue', icon: '🌨', snow: 8  },
  { day: 'Wed', icon: '🌨', snow: 12 },
  { day: 'Thu', icon: '⛅', snow: 3  },
  { day: 'Fri', icon: '☀️', snow: 0  },
  { day: 'Sat', icon: '🌨', snow: 5  },
  { day: 'Sun', icon: '⛅', snow: 2  },
];
const MOCK_HISTORY = [14, 22, 8, 30, 18, 26, 12, 28, 20, 16, 24, 10];
const MOCK_HISTORY_LABELS = ['Gnorm','Tue','Mercredi','Alt actliller','7P us','Augy','Toroe','Pan 230','Strgs','Mur Litier'];

export default function DashboardPage() {
  const router = useRouter();
  const [favorites, setFavorites]   = useState<FavoriteItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [userRole, setUserRole]     = useState<string>('user');
  const [userName, setUserName]     = useState<string>('');
  const [hasResort, setHasResort]   = useState<boolean>(false);
  const [activeTab, setActiveTab]   = useState<'dashboard'|'resorts'|'forecasts'|'analytics'|'alerts'>('dashboard');
  const [selectedFav, setSelectedFav] = useState<FavoriteItem | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push('/auth/login'); return; }
      const token = data.session.access_token;

      const [meRes, favRes, resortRes] = await Promise.all([
        fetch('/api/me',       { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/favorites',{ headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/resort',   { headers: { Authorization: `Bearer ${token}` } }),
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
        const withScores = await Promise.all(
          items.map(async (f) => {
            try {
              const sRes = await fetch(`/api/mountains/${f.mountain.id}/score`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (sRes.ok) { const s = await sRes.json(); return { ...f, score: s.data?.score }; }
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

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  const activeFav = selectedFav ?? favorites[0] ?? null;
  const heroImg = activeFav ? (activeFav.mountain.imageUrl || getFallbackImage(activeFav.mountain.name)) : 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=70';
  const score = activeFav?.score ?? 82;
  const scoreColor = getScoreColor(score);
  const scoreLabel = getScoreLabel(score);

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

        /* LAYOUT */
        .app-shell { display:flex; flex-direction:column; height:100vh; overflow:hidden; }

        /* TOP NAV */
        .topnav {
          background:var(--white); border-bottom:1px solid var(--border-2);
          height:60px; display:flex; align-items:center; padding:0 20px;
          gap:16px; flex-shrink:0; z-index:40;
          box-shadow:0 1px 4px rgba(15,40,80,0.06);
        }
        .topnav-logo { display:flex; align-items:center; gap:8px; text-decoration:none; flex-shrink:0; }
        .topnav-logo-icon { width:32px; height:32px; border-radius:9px; background:linear-gradient(135deg,var(--blue),var(--blue-mid)); display:flex; align-items:center; justify-content:center; font-size:17px; box-shadow:0 2px 6px rgba(29,110,245,0.3); }
        .topnav-brand { font-size:17px; font-weight:800; color:var(--text); letter-spacing:-0.03em; }
        .topnav-tabs { display:flex; gap:2px; margin-left:8px; flex:1; }
        .topnav-tab { padding:7px 14px; border-radius:8px; font-size:13px; font-weight:600; color:var(--text-3); cursor:pointer; border:none; background:transparent; font-family:'Inter',sans-serif; display:flex; align-items:center; gap:6px; text-decoration:none; transition:background .15s,color .15s; }
        .topnav-tab:hover { background:var(--blue-light); color:var(--text); }
        .topnav-tab.active { background:var(--blue-light); color:var(--blue); border-bottom:2px solid var(--blue); border-radius:8px 8px 0 0; }
        .topnav-right { display:flex; align-items:center; gap:8px; margin-left:auto; }
        .topnav-icon-btn { width:34px; height:34px; border-radius:9px; background:var(--bg); border:1px solid var(--border-2); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:15px; transition:background .15s; }
        .topnav-icon-btn:hover { background:var(--blue-light); }
        .topnav-avatar { width:34px; height:34px; border-radius:50%; background:linear-gradient(135deg,var(--blue),var(--blue-mid)); display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700; color:#fff; cursor:pointer; border:2px solid var(--border-2); }
        .topnav-signout { font-size:13px; font-weight:600; color:var(--text-3); background:none; border:none; cursor:pointer; font-family:'Inter',sans-serif; padding:6px 12px; border-radius:8px; transition:background .15s,color .15s; }
        .topnav-signout:hover { background:var(--bg); color:var(--text); }

        /* BODY */
        .app-body { display:flex; flex:1; overflow:hidden; }

        /* SIDEBAR */
        .sidebar { width:200px; background:var(--white); border-right:1px solid var(--border-2); display:flex; flex-direction:column; overflow-y:auto; flex-shrink:0; }
        .sidebar-section { padding:14px 10px 4px; }
        .sidebar-nav-item { display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:9px; font-size:13px; font-weight:600; color:var(--text-3); cursor:pointer; text-decoration:none; transition:background .15s,color .15s; border:none; background:transparent; font-family:'Inter',sans-serif; width:100%; }
        .sidebar-nav-item:hover { background:var(--bg); color:var(--text); }
        .sidebar-nav-item.active { background:var(--blue-light); color:var(--blue); }
        .sidebar-nav-icon { font-size:15px; width:20px; text-align:center; }
        .sidebar-divider { height:1px; background:var(--border); margin:8px 10px; }
        .sidebar-label { font-size:10px; font-weight:700; color:var(--text-3); letter-spacing:0.06em; text-transform:uppercase; padding:10px 10px 4px; }
        .sidebar-resort-item { display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:9px; cursor:pointer; transition:background .15s; }
        .sidebar-resort-item:hover { background:var(--bg); }
        .sidebar-resort-item.active { background:var(--blue-light); }
        .sidebar-resort-thumb { width:26px; height:26px; border-radius:7px; object-fit:cover; background:var(--bg-2); flex-shrink:0; }
        .sidebar-resort-name { font-size:12px; font-weight:600; color:var(--text-2); flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .sidebar-resort-score { font-size:11px; font-weight:700; color:var(--blue); }
        .sidebar-bottom { margin-top:auto; padding:10px; border-top:1px solid var(--border); }
        .sidebar-bottom-row { display:flex; justify-content:space-between; font-size:11px; color:var(--text-3); padding:2px 0; }

        /* MAIN CONTENT */
        .main-content { flex:1; overflow-y:auto; background:var(--bg); }
        .main-inner { max-width:1100px; margin:0 auto; padding:20px 24px 40px; }

        /* HERO CARD */
        .hero-card { border-radius:18px; overflow:hidden; position:relative; margin-bottom:18px; box-shadow:var(--shadow-lg); }
        .hero-img { width:100%; height:200px; object-fit:cover; display:block; }
        .hero-img-overlay { position:absolute; inset:0; background:linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 100%); }
        .hero-label { position:absolute; bottom:14px; left:16px; }
        .hero-resort-name { font-size:22px; font-weight:900; color:#fff; letter-spacing:-0.02em; text-shadow:0 2px 8px rgba(0,0,0,0.4); }
        .hero-updated { position:absolute; top:12px; right:12px; background:rgba(255,255,255,0.18); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.25); border-radius:100px; padding:4px 10px; font-size:11px; font-weight:600; color:#fff; }

        /* CONTENT GRID */
        .content-grid { display:grid; grid-template-columns:1fr 280px; gap:16px; }
        @media(max-width:900px){ .content-grid{grid-template-columns:1fr;} }

        /* SCORE CARD */
        .card { background:var(--white); border:1px solid var(--border-2); border-radius:16px; padding:18px; box-shadow:var(--shadow); }
        .card-title { font-size:13px; font-weight:700; color:var(--text-2); margin-bottom:14px; display:flex; align-items:center; gap:6px; }
        .score-row { display:flex; align-items:flex-start; gap:16px; }
        .score-big { font-size:60px; font-weight:900; line-height:1; letter-spacing:-0.04em; }
        .score-label { font-size:18px; font-weight:700; margin-top:6px; }
        .score-sublabel { font-size:12px; color:var(--text-3); margin-top:3px; }
        .metrics-row { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:14px; }
        .metric-box { background:var(--bg); border-radius:10px; padding:10px 8px; text-align:center; border:1px solid var(--border); }
        .metric-val { font-size:14px; font-weight:700; color:var(--text); }
        .metric-key { font-size:10px; color:var(--text-3); margin-top:2px; }

        /* FORECAST CARD */
        .forecast-strip { display:flex; gap:8px; margin-top:14px; }
        .fc-day { flex:1; background:var(--bg); border-radius:10px; padding:10px 6px; text-align:center; border:1px solid var(--border); }
        .fc-day-name { font-size:11px; font-weight:600; color:var(--text-3); margin-bottom:5px; }
        .fc-icon { font-size:20px; }
        .fc-snow { font-size:13px; font-weight:800; color:var(--text); margin-top:4px; }
        .fc-snow span { font-size:10px; font-weight:500; color:var(--text-3); }

        /* FORECAST SIDEBAR */
        .fc-sidebar-row { display:flex; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); }
        .fc-sidebar-row:last-child { border-bottom:none; padding-bottom:0; }
        .fc-sidebar-day { font-size:13px; font-weight:600; color:var(--text-2); width:36px; }
        .fc-sidebar-icon { font-size:18px; margin:0 10px; }
        .fc-sidebar-desc { font-size:11px; color:var(--text-3); flex:1; }
        .fc-sidebar-snow { font-size:17px; font-weight:900; color:var(--text); }
        .fc-sidebar-unit { font-size:11px; color:var(--text-3); font-weight:500; }

        /* SNOW HISTORY CHART */
        .chart-area { background:var(--bg); border-radius:10px; padding:14px 10px 8px; margin-top:14px; }
        .chart-bars { display:flex; align-items:flex-end; gap:4px; height:80px; }
        .chart-bar-col { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; height:100%; justify-content:flex-end; }
        .chart-bar { width:100%; border-radius:3px 3px 0 0; background:linear-gradient(180deg,var(--blue) 0%,#93c5fd 100%); min-height:4px; }
        .chart-bar-label { font-size:8px; color:var(--text-3); white-space:nowrap; }

        /* FAVORITES GRID */
        .fav-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:14px; }
        .fav-card { background:var(--white); border:1px solid var(--border-2); border-radius:16px; overflow:hidden; text-decoration:none; color:inherit; box-shadow:var(--shadow); transition:transform .2s,box-shadow .2s,border-color .2s; display:flex; flex-direction:column; }
        .fav-card:hover { transform:translateY(-3px); box-shadow:var(--shadow-lg); border-color:rgba(29,110,245,0.3); }
        .fav-img { width:100%; height:140px; object-fit:cover; display:block; }
        .fav-img-placeholder { width:100%; height:140px; background:linear-gradient(135deg,#bfdbfe,#93c5fd); display:flex; align-items:center; justify-content:center; font-size:32px; }
        .fav-body { padding:13px; flex:1; display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .fav-name { font-size:14px; font-weight:800; color:var(--text); }
        .fav-state { font-size:12px; color:var(--text-3); margin-top:2px; }

        /* UPGRADE BANNER */
        .upgrade-banner { background:linear-gradient(135deg,var(--blue-light) 0%,#dbeafe 100%); border:1px solid rgba(29,110,245,0.2); border-radius:16px; padding:18px 20px; display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:18px; flex-wrap:wrap; }
        .upgrade-title { font-size:14px; font-weight:700; color:var(--text); }
        .upgrade-sub { font-size:13px; color:var(--text-2); margin-top:2px; }
        .upgrade-btn { padding:9px 20px; border-radius:10px; font-size:13px; font-weight:700; color:#fff; background:var(--blue); text-decoration:none; white-space:nowrap; box-shadow:0 2px 8px rgba(29,110,245,0.3); transition:filter .15s; }
        .upgrade-btn:hover { filter:brightness(1.1); }

        /* EMPTY STATE */
        .empty-state { text-align:center; padding:60px 20px; }
        .empty-icon { font-size:48px; margin-bottom:14px; }
        .empty-title { font-size:18px; font-weight:700; color:var(--text-2); margin-bottom:6px; }
        .empty-sub { font-size:14px; color:var(--text-3); margin-bottom:20px; }
        .empty-btn { display:inline-block; padding:11px 24px; border-radius:10px; font-size:14px; font-weight:700; color:#fff; background:var(--blue); text-decoration:none; box-shadow:0 2px 8px rgba(29,110,245,0.3); }

        /* SKELETON */
        .skeleton { background:linear-gradient(90deg,#e8f0f8 25%,#d4e4f0 50%,#e8f0f8 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:10px; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

        /* SECTION HEADING */
        .section-heading { font-size:20px; font-weight:800; color:var(--text); letter-spacing:-0.02em; margin-bottom:16px; }

        @media(max-width:700px){
          .sidebar{display:none;}
          .topnav-tabs{display:none;}
          .metrics-row{grid-template-columns:repeat(2,1fr);}
          .forecast-strip{flex-wrap:wrap;}
        }
      `}</style>

      <div className="app-shell">

        {/* TOP NAV */}
        <header className="topnav" role="banner">
          <Link href="/" className="topnav-logo" aria-label="PowderIQ home">
            <div className="topnav-logo-icon" aria-hidden="true">❄️</div>
            <span className="topnav-brand">PowderIQ</span>
          </Link>

          <nav className="topnav-tabs" aria-label="Main navigation">
            {[
              { key:'dashboard', label:'Dashboard', icon:'📊' },
              { key:'resorts',   label:'Resorts',   icon:'🏔️' },
              { key:'forecasts', label:'Forecasts', icon:'📅' },
              { key:'alerts',    label:'Alerts',    icon:'🔔' },
            ].map(t => (
              <button key={t.key} onClick={()=>setActiveTab(t.key as any)}
                className={`topnav-tab${activeTab===t.key?' active':''}`}
                aria-current={activeTab===t.key?'page':undefined}>
                <span aria-hidden="true">{t.icon}</span>{t.label}
              </button>
            ))}
            {hasResort && (
              <Link href="/resort/dashboard" className="topnav-tab">
                <span aria-hidden="true">🎿</span>Resort
              </Link>
            )}
            {userRole === 'admin' && (
              <Link href="/admin" className="topnav-tab">
                <span aria-hidden="true">⚙️</span>Admin
              </Link>
            )}
          </nav>

          <div className="topnav-right">
            <Link href="/account" className="topnav-icon-btn" aria-label="Account settings">⚙️</Link>
            <div className="topnav-icon-btn" aria-label="Notifications" role="button">🔔</div>
            <div className="topnav-avatar" aria-label="User menu" role="button">
              {userName ? userName[0].toUpperCase() : '👤'}
            </div>
            <button className="topnav-signout" onClick={handleLogout} aria-label="Sign out">
              Sign out
            </button>
          </div>
        </header>

        <div className="app-body">

          {/* SIDEBAR */}
          <aside className="sidebar" aria-label="Sidebar navigation">
            <div className="sidebar-section">
              {[
                { key:'dashboard', label:'Dashboard', icon:'📊' },
                { key:'resorts',   label:'Resorts',   icon:'🏔️' },
                { key:'forecasts', label:'Forecasts', icon:'📅' },
                { key:'analytics', label:'Analytics', icon:'📈' },
                { key:'alerts',    label:'Alerts',    icon:'🔔' },
              ].map(item => (
                <button key={item.key} onClick={()=>setActiveTab(item.key as any)}
                  className={`sidebar-nav-item${activeTab===item.key?' active':''}`}
                  aria-current={activeTab===item.key?'page':undefined}>
                  <span className="sidebar-nav-icon" aria-hidden="true">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>

            <div className="sidebar-divider" />

            {favorites.length > 0 && (
              <>
                <div className="sidebar-label">Saved Resorts</div>
                {favorites.map(f => (
                  <div key={f.id}
                    className={`sidebar-resort-item${activeFav?.id===f.id?' active':''}`}
                    onClick={()=>setSelectedFav(f)}
                    role="button" tabIndex={0}
                    aria-label={`Select ${f.mountain.name}`}
                    onKeyDown={e=>e.key==='Enter'&&setSelectedFav(f)}
                  >
                    <img
                      src={f.mountain.imageUrl || getFallbackImage(f.mountain.name)}
                      alt="" aria-hidden="true"
                      className="sidebar-resort-thumb"
                      onError={e=>{(e.target as HTMLImageElement).src='https://images.unsplash.com/photo-1519681393784-d120267933ba?w=80&q=50'}}
                    />
                    <span className="sidebar-resort-name">{f.mountain.name}</span>
                    {f.score !== undefined && <span className="sidebar-resort-score">{f.score}</span>}
                  </div>
                ))}
              </>
            )}

            <div className="sidebar-bottom">
              <div className="sidebar-bottom-row"><span>MBTs</span><span>Resorts</span></div>
              <div className="sidebar-bottom-row"><span>Gay</span><span>New index</span></div>
              <div className="sidebar-bottom-row"><span>A Affcred</span><span>1a #1 Divers</span></div>
            </div>
          </aside>

          {/* MAIN */}
          <main className="main-content" id="main-content">
            <div className="main-inner">

              {loading ? (
                <div aria-label="Loading dashboard" aria-busy="true">
                  <div className="skeleton" style={{height:200,marginBottom:16}} />
                  <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:16}}>
                    <div className="skeleton" style={{height:200}} />
                    <div className="skeleton" style={{height:200}} />
                  </div>
                </div>
              ) : (
                <>
                  {/* PRO UPGRADE BANNER */}
                  {userRole === 'user' && (
                    <div className="upgrade-banner" role="complementary" aria-label="Upgrade prompt">
                      <div>
                        <div className="upgrade-title">📊 Upgrade to Pro</div>
                        <div className="upgrade-sub">Unlock Compare, Alerts, and personalized scoring weights.</div>
                      </div>
                      <Link href="/account" className="upgrade-btn">Upgrade Now</Link>
                    </div>
                  )}

                  <h1 className="section-heading">
                    {userName ? `Welcome back, ${userName}` : 'Dashboard'}
                  </h1>

                  {favorites.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon" aria-hidden="true">⭐</div>
                      <div className="empty-title">No favorites yet</div>
                      <div className="empty-sub">Add mountains to track your powder windows.</div>
                      <Link href="/mountains" className="empty-btn">Browse Mountains</Link>
                    </div>
                  ) : (
                    <>
                      {/* HERO IMAGE */}
                      <div className="hero-card" aria-label={`${activeFav?.mountain.name ?? 'Resort'} hero image`}>
                        <img src={heroImg} alt={activeFav?.mountain.name ?? ''} className="hero-img" />
                        <div className="hero-img-overlay" aria-hidden="true" />
                        <div className="hero-label">
                          <div className="hero-resort-name">{activeFav?.mountain.name} Resort</div>
                        </div>
                        <div className="hero-updated" aria-label="Last updated">✓ All data updated 24 h ×</div>
                      </div>

                      <div className="content-grid">
                        {/* LEFT COLUMN */}
                        <div style={{display:'flex',flexDirection:'column',gap:16}}>

                          {/* SCORE CARD */}
                          <div className="card" aria-label={`${activeFav?.mountain.name} score card`}>
                            <div className="card-title">
                              <span aria-hidden="true">🏔️</span>
                              Resort for {activeFav?.mountain.name}
                            </div>
                            <div className="score-row">
                              <div>
                                <div className="score-big" style={{color:scoreColor}}>{score}</div>
                                <div className="score-label" style={{color:scoreColor}}>{scoreLabel}</div>
                                <div className="score-sublabel">{activeFav?.mountain.state}</div>
                              </div>
                            </div>
                            <div className="metrics-row">
                              {[
                                {val:'28 in', key:'Conditions'},
                                {val:'7 mph', key:'Wind'},
                                {val:'30° F', key:'Temp'},
                                {val:'30 in', key:'Base Depth'},
                              ].map(m=>(
                                <div key={m.key} className="metric-box">
                                  <div className="metric-val">{m.val}</div>
                                  <div className="metric-key">{m.key}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* 6-DAY FORECAST STRIP */}
                          <div className="card" aria-label="6-day snow forecast">
                            <div className="card-title"><span aria-hidden="true">📅</span>6-Day Snow Forecast</div>
                            <div className="forecast-strip">
                              {MOCK_FORECAST.map(d=>(
                                <div key={d.day} className="fc-day">
                                  <div className="fc-day-name">{d.day}</div>
                                  <div className="fc-icon" aria-hidden="true">{d.icon}</div>
                                  <div className="fc-snow">{d.snow}<span>in</span></div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* SNOW HISTORY */}
                          <div className="card" aria-label="Snow history chart">
                            <div className="card-title"><span aria-hidden="true">📊</span>Snow History</div>
                            <div className="chart-area">
                              <div className="chart-bars">
                                {MOCK_HISTORY.map((h,i)=>(
                                  <div key={i} className="chart-bar-col">
                                    <div className="chart-bar" style={{height:`${(h/30)*100}%`}} aria-label={`${h} inches`} />
                                  </div>
                                ))}
                              </div>
                              <div style={{display:'flex',gap:4,marginTop:4}}>
                                {['Gnorm','Tue','Wed','Thu','Fri','Sat','Sun','Mon','Tue','Wed','Thu','Fri'].map((l,i)=>(
                                  <div key={i} className="chart-bar-col">
                                    <span className="chart-bar-label">{l}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* ALL FAVORITES GRID */}
                          <div>
                            <div className="card-title" style={{marginBottom:12}}><span aria-hidden="true">⭐</span>Your Saved Mountains</div>
                            <div className="fav-grid" role="list">
                              {favorites.map(f => (
                                <Link key={f.id} href={`/mountains/${f.mountain.id}`}
                                  className="fav-card" role="listitem"
                                  aria-label={`${f.mountain.name}, ${f.mountain.state}${f.score!==undefined?`, score ${f.score}`:''}`}>
                                  {(f.mountain.imageUrl || getFallbackImage(f.mountain.name)) ? (
                                    <img
                                      src={f.mountain.imageUrl || getFallbackImage(f.mountain.name)}
                                      alt={f.mountain.name}
                                      className="fav-img"
                                      loading="lazy"
                                      onError={e=>{(e.target as HTMLImageElement).src='https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&q=60'}}
                                    />
                                  ) : (
                                    <div className="fav-img-placeholder" aria-hidden="true">🏔️</div>
                                  )}
                                  <div className="fav-body">
                                    <div>
                                      <div className="fav-name">{f.mountain.name}</div>
                                      <div className="fav-state">{f.mountain.state}</div>
                                    </div>
                                    {f.score !== undefined && <ScoreBadge score={f.score} />}
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </div>

                        </div>

                        {/* RIGHT COLUMN — 6-day sidebar forecast */}
                        <div style={{display:'flex',flexDirection:'column',gap:16}}>
                          <div className="card" aria-label="Detailed 6-day forecast">
                            <div className="card-title"><span aria-hidden="true">❄️</span>6-Day Snow Forecast</div>
                            {MOCK_FORECAST.map(d=>(
                              <div key={d.day} className="fc-sidebar-row">
                                <span className="fc-sidebar-day">{d.day}</span>
                                <span className="fc-sidebar-icon" aria-hidden="true">{d.icon}</span>
                                <span className="fc-sidebar-desc">
                                  {d.snow>0?`${d.snow>8?'More':'Some'} snow likely`:'Clear skies'}
                                </span>
                                <span className="fc-sidebar-snow">{d.snow}</span>
                                <span className="fc-sidebar-unit">in</span>
                              </div>
                            ))}
                          </div>

                          {/* QUICK LINKS */}
                          <div className="card">
                            <div className="card-title"><span aria-hidden="true">🔗</span>Quick Links</div>
                            <div style={{display:'flex',flexDirection:'column',gap:6}}>
                              <Link href="/mountains" style={{display:'flex',alignItems:'center',gap:8,padding:'9px 10px',borderRadius:9,background:'var(--bg)',textDecoration:'none',fontSize:13,fontWeight:600,color:'var(--text-2)',border:'1px solid var(--border)',transition:'background .15s'}}
                                onMouseOver={e=>(e.currentTarget.style.background='var(--blue-light)')}
                                onMouseOut={e=>(e.currentTarget.style.background='var(--bg)')}>
                                <span>🏔️</span> Browse All Mountains
                              </Link>
                              {(userRole==='pro_user'||userRole==='admin') && (
                                <>
                                  <Link href="/compare" style={{display:'flex',alignItems:'center',gap:8,padding:'9px 10px',borderRadius:9,background:'var(--bg)',textDecoration:'none',fontSize:13,fontWeight:600,color:'var(--text-2)',border:'1px solid var(--border)',transition:'background .15s'}}
                                    onMouseOver={e=>(e.currentTarget.style.background='var(--blue-light)')}
                                    onMouseOut={e=>(e.currentTarget.style.background='var(--bg)')}>
                                    <span>📊</span> Compare Resorts
                                  </Link>
                                  <Link href="/alerts" style={{display:'flex',alignItems:'center',gap:8,padding:'9px 10px',borderRadius:9,background:'var(--bg)',textDecoration:'none',fontSize:13,fontWeight:600,color:'var(--text-2)',border:'1px solid var(--border)',transition:'background .15s'}}
                                    onMouseOver={e=>(e.currentTarget.style.background='var(--blue-light)')}
                                    onMouseOut={e=>(e.currentTarget.style.background='var(--bg)')}>
                                    <span>🔔</span> Powder Alerts
                                  </Link>
                                </>
                              )}
                              {hasResort && (
                                <Link href="/resort/dashboard" style={{display:'flex',alignItems:'center',gap:8,padding:'9px 10px',borderRadius:9,background:'var(--blue-light)',textDecoration:'none',fontSize:13,fontWeight:600,color:'var(--blue)',border:'1px solid rgba(29,110,245,0.2)',transition:'background .15s'}}>
                                  <span>🎿</span> Resort Dashboard
                                </Link>
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
