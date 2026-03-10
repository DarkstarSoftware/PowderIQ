'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import ScoreBadge from '@/components/ScoreBadge';

interface Mountain {
  id: string; name: string; state: string; country: string;
  baseElevFt: number; topElevFt: number; totalTrails: number;
  imageUrl?: string;
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

export default function MountainsPage() {
  const router = useRouter();
  const [mountains,  setMountains]  = useState<Mountain[]>([]);
  const [scores,     setScores]     = useState<Record<string, number>>({});
  const [favorites,  setFavorites]  = useState<Set<string>>(new Set());
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(true);
  const [token,      setToken]      = useState('');
  const [userName,   setUserName]   = useState('');
  const [userRole,   setUserRole]   = useState('user');
  const [hasResort,  setHasResort]  = useState(false);
  const [filter,     setFilter]     = useState<'all'|'favorites'>('all');
  const [toggling,   setToggling]   = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push('/auth/login'); return; }
      const tok = data.session.access_token;
      setToken(tok);

      const [meRes, mRes, fRes, resortRes] = await Promise.all([
        fetch('/api/me',        { headers: { Authorization: `Bearer ${tok}` } }),
        fetch('/api/mountains'),
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
      if (mRes.ok) setMountains((await mRes.json()).data || []);
      if (fRes.ok) {
        const fData = await fRes.json();
        setFavorites(new Set((fData.data || []).map((f: { mountain: Mountain }) => f.mountain.id)));
      }
      setLoading(false);
    })();
  }, [router]);

  async function toggleFavorite(mountainId: string) {
    if (!token || toggling.has(mountainId)) return;
    setToggling(prev => new Set(prev).add(mountainId));
    const isFav = favorites.has(mountainId);
    if (isFav) {
      await fetch('/api/favorites', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mountainId }),
      });
      setFavorites(prev => { const s = new Set(prev); s.delete(mountainId); return s; });
    } else {
      await fetch('/api/favorites', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mountainId }),
      });
      setFavorites(prev => new Set(prev).add(mountainId));
      if (!scores[mountainId]) {
        const sRes = await fetch(`/api/mountains/${mountainId}/score`, { headers: { Authorization: `Bearer ${token}` } });
        if (sRes.ok) {
          const s = await sRes.json();
          setScores(prev => ({ ...prev, [mountainId]: s.data?.score }));
        }
      }
    }
    setToggling(prev => { const s = new Set(prev); s.delete(mountainId); return s; });
  }

  async function handleLogout() { await supabase.auth.signOut(); router.push('/'); }

  const filtered = mountains.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
                        m.state.toLowerCase().includes(search.toLowerCase());
    return matchSearch && (filter === 'all' || favorites.has(m.id));
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        :root {
          --blue:#1d6ef5; --blue-light:#e8f1fe; --blue-mid:#3b82f6;
          --text:#0d1b2e; --text-2:#3d5166; --text-3:#6b849a;
          --border:rgba(100,150,200,0.15); --border-2:rgba(100,150,200,0.25);
          --bg:#f0f5fb; --white:#ffffff;
          --shadow:0 2px 12px rgba(15,40,80,0.08); --shadow-lg:0 8px 32px rgba(15,40,80,0.14);
        }
        body { font-family:'Inter',system-ui,sans-serif; background:var(--bg); color:var(--text); -webkit-font-smoothing:antialiased; }
        a:focus-visible, button:focus-visible { outline:3px solid var(--blue); outline-offset:2px; border-radius:6px; }
        .topnav { background:var(--white); border-bottom:1px solid var(--border-2); height:60px; display:flex; align-items:center; padding:0 20px; gap:12px; position:sticky; top:0; z-index:40; box-shadow:0 1px 4px rgba(15,40,80,0.06); }
        .topnav-logo { display:flex; align-items:center; gap:8px; text-decoration:none; flex-shrink:0; }
        .topnav-logo-icon { width:32px; height:32px; border-radius:9px; background:linear-gradient(135deg,var(--blue),var(--blue-mid)); display:flex; align-items:center; justify-content:center; font-size:17px; }
        .topnav-brand { font-size:17px; font-weight:800; color:var(--text); letter-spacing:-0.03em; }
        .topnav-tabs { display:flex; gap:2px; margin-left:8px; flex:1; overflow-x:auto; }
        .topnav-tab { padding:7px 14px; border-radius:8px 8px 0 0; font-size:13px; font-weight:600; color:var(--text-3); border:none; border-bottom:2px solid transparent; background:transparent; font-family:'Inter',sans-serif; display:flex; align-items:center; gap:5px; text-decoration:none; transition:color .15s,border-color .15s,background .15s; white-space:nowrap; }
        .topnav-tab:hover { background:var(--blue-light); color:var(--text); }
        .topnav-tab.active { color:var(--blue); border-bottom-color:var(--blue); background:var(--blue-light); }
        .topnav-right { display:flex; align-items:center; gap:8px; margin-left:auto; flex-shrink:0; }
        .topnav-icon-btn { width:34px; height:34px; border-radius:9px; background:var(--bg); border:1px solid var(--border-2); display:flex; align-items:center; justify-content:center; font-size:15px; text-decoration:none; }
        .topnav-avatar { width:34px; height:34px; border-radius:50%; background:linear-gradient(135deg,var(--blue),var(--blue-mid)); display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; color:#fff; border:2px solid var(--border-2); }
        .topnav-signout { font-size:13px; font-weight:600; color:var(--text-3); background:none; border:none; cursor:pointer; font-family:'Inter',sans-serif; padding:6px 12px; border-radius:8px; }
        .topnav-signout:hover { background:var(--bg); color:var(--text); }
        .page-body { background:var(--bg); min-height:calc(100vh - 60px); }
        .page-inner { max-width:1180px; margin:0 auto; padding:28px 24px 64px; }
        .page-title { font-size:26px; font-weight:900; color:var(--text); letter-spacing:-0.03em; margin-bottom:4px; }
        .page-sub { font-size:14px; color:var(--text-3); margin-bottom:22px; }
        .controls { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:24px; }
        .search-wrap { position:relative; flex:1; min-width:200px; max-width:380px; }
        .search-icon { position:absolute; left:13px; top:50%; transform:translateY(-50%); color:var(--text-3); font-size:14px; pointer-events:none; }
        .search-input { width:100%; background:var(--white); border:1px solid var(--border-2); border-radius:12px; padding:10px 14px 10px 38px; font-size:14px; font-family:'Inter',sans-serif; color:var(--text); outline:none; transition:border-color .15s; }
        .search-input:focus { border-color:var(--blue); }
        .filter-tabs { display:flex; gap:4px; background:var(--white); border:1px solid var(--border-2); border-radius:10px; padding:3px; }
        .filter-tab { padding:6px 16px; border-radius:8px; font-size:13px; font-weight:600; color:var(--text-3); background:transparent; border:none; cursor:pointer; font-family:'Inter',sans-serif; transition:background .15s,color .15s; }
        .filter-tab.active { background:var(--blue); color:#fff; }
        .mtn-count { font-size:13px; color:var(--text-3); font-weight:500; }
        .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px; }
        .mtn-card { background:var(--white); border:1px solid var(--border-2); border-radius:16px; overflow:hidden; box-shadow:var(--shadow); transition:transform .2s,box-shadow .2s,border-color .2s; display:flex; flex-direction:column; }
        .mtn-card:hover { transform:translateY(-3px); box-shadow:var(--shadow-lg); border-color:rgba(29,110,245,0.25); }
        .mtn-card.is-fav { border-color:rgba(250,204,21,0.5); }
        .mtn-img-wrap { position:relative; height:150px; overflow:hidden; background:var(--bg); }
        .mtn-img { width:100%; height:100%; object-fit:cover; display:block; transition:transform .3s; }
        .mtn-card:hover .mtn-img { transform:scale(1.05); }
        .mtn-body { padding:14px; display:flex; flex-direction:column; gap:6px; flex:1; }
        .mtn-row { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
        .mtn-name-link { font-size:15px; font-weight:800; color:var(--text); text-decoration:none; letter-spacing:-0.01em; transition:color .15s; }
        .mtn-name-link:hover { color:var(--blue); }
        .mtn-location { font-size:12px; color:var(--text-3); margin-top:1px; }
        .mtn-actions { display:flex; align-items:center; gap:6px; flex-shrink:0; }
        .fav-btn { width:32px; height:32px; border-radius:8px; border:1px solid var(--border-2); background:var(--bg); font-size:16px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:background .15s,border-color .15s,transform .15s; }
        .fav-btn:hover { transform:scale(1.15); }
        .fav-btn.active { background:#fef9c3; border-color:#fde047; }
        .fav-btn.busy { opacity:0.5; pointer-events:none; }
        .mtn-stat-pills { display:flex; gap:5px; flex-wrap:wrap; margin-top:4px; }
        .stat-pill { background:var(--bg); border:1px solid var(--border); border-radius:6px; padding:3px 8px; font-size:11px; font-weight:600; color:var(--text-2); }
        .skeleton { background:linear-gradient(90deg,#e8f0f8 25%,#d4e4f0 50%,#e8f0f8 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:10px; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .empty-state { text-align:center; padding:80px 20px; grid-column:1/-1; }
        .empty-icon { font-size:44px; margin-bottom:12px; }
        .empty-title { font-size:18px; font-weight:700; color:var(--text-2); margin-bottom:6px; }
        .empty-sub { font-size:14px; color:var(--text-3); }
        @media(max-width:700px){ .topnav-tabs{display:none;} }
      `}</style>

      <div style={{minHeight:'100vh',background:'var(--bg)'}}>
        <header className="topnav" role="banner">
          <Link href="/" className="topnav-logo" aria-label="PowderIQ home">
            <div className="topnav-logo-icon" aria-hidden="true">❄️</div>
            <span className="topnav-brand">PowderIQ</span>
          </Link>
          <nav className="topnav-tabs" aria-label="Main navigation">
            <Link href="/dashboard" className="topnav-tab"><span>📊</span>Dashboard</Link>
            <Link href="/mountains" className="topnav-tab active" aria-current="page"><span>🏔️</span>Resorts</Link>
            <Link href="/forecasts" className="topnav-tab"><span>📅</span>Forecasts</Link>
            {(userRole==='pro_user'||userRole==='admin') && <Link href="/compare" className="topnav-tab"><span>📈</span>Analytics</Link>}
            {(userRole==='pro_user'||userRole==='admin') && <Link href="/alerts" className="topnav-tab"><span>🔔</span>Alerts</Link>}
            {hasResort && <Link href="/resort/dashboard" className="topnav-tab"><span>🎿</span>Resort</Link>}
            {userRole==='admin' && <Link href="/admin" className="topnav-tab"><span>⚙️</span>Admin</Link>}
          </nav>
          <div className="topnav-right">
            <Link href="/account" className="topnav-icon-btn" aria-label="Account">⚙️</Link>
            <div className="topnav-avatar">{userName ? userName[0].toUpperCase() : '👤'}</div>
            <button className="topnav-signout" onClick={handleLogout}>Sign out</button>
          </div>
        </header>

        <main className="page-body">
          <div className="page-inner">
            <h1 className="page-title">🏔️ Resorts</h1>
            <p className="page-sub">Browse all mountains — star your favorites to track conditions on the dashboard.</p>

            <div className="controls">
              <div className="search-wrap">
                <span className="search-icon">🔍</span>
                <input
                  type="search"
                  placeholder="Search by name or state…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="search-input"
                  aria-label="Search mountains"
                />
              </div>
              <div className="filter-tabs" role="group" aria-label="View filter">
                <button className={`filter-tab${filter==='all'?' active':''}`} onClick={() => setFilter('all')} aria-pressed={filter==='all'}>All</button>
                <button className={`filter-tab${filter==='favorites'?' active':''}`} onClick={() => setFilter('favorites')} aria-pressed={filter==='favorites'}>⭐ Favorites ({favorites.size})</button>
              </div>
              {!loading && <span className="mtn-count">{filtered.length} resort{filtered.length !== 1 ? 's' : ''}</span>}
            </div>

            {loading ? (
              <div className="grid">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="mtn-card" aria-hidden="true">
                    <div className="skeleton" style={{height:150,borderRadius:'16px 16px 0 0'}} />
                    <div style={{padding:14,display:'flex',flexDirection:'column',gap:8}}>
                      <div className="skeleton" style={{height:18,width:'60%'}} />
                      <div className="skeleton" style={{height:12,width:'40%'}} />
                      <div className="skeleton" style={{height:22,width:'80%',marginTop:4}} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid" role="list" aria-label="Mountains">
                {filtered.map(m => (
                  <article key={m.id} className={`mtn-card${favorites.has(m.id)?' is-fav':''}`} role="listitem">
                    <Link href={`/mountains/${m.id}`} tabIndex={-1} aria-hidden="true">
                      <div className="mtn-img-wrap">
                        <img
                          src={getMtnImg(m)} alt="" className="mtn-img" loading="lazy"
                          onError={e => { (e.target as HTMLImageElement).src = FALLBACK; }}
                        />
                      </div>
                    </Link>
                    <div className="mtn-body">
                      <div className="mtn-row">
                        <div>
                          <Link href={`/mountains/${m.id}`} className="mtn-name-link">{m.name}</Link>
                          <div className="mtn-location">{m.state}, {m.country}</div>
                        </div>
                        <div className="mtn-actions">
                          {scores[m.id] !== undefined && <ScoreBadge score={scores[m.id]} size="sm" />}
                          <button
                            onClick={() => toggleFavorite(m.id)}
                            className={`fav-btn${favorites.has(m.id)?' active':''}${toggling.has(m.id)?' busy':''}`}
                            aria-label={favorites.has(m.id) ? `Remove ${m.name} from favorites` : `Add ${m.name} to favorites`}
                            aria-pressed={favorites.has(m.id)}
                          >
                            {toggling.has(m.id) ? '…' : favorites.has(m.id) ? '⭐' : '☆'}
                          </button>
                        </div>
                      </div>
                      <div className="mtn-stat-pills">
                        <span className="stat-pill">⛰ {m.baseElevFt.toLocaleString()}–{m.topElevFt.toLocaleString()} ft</span>
                        <span className="stat-pill">🎿 {m.totalTrails} trails</span>
                      </div>
                    </div>
                  </article>
                ))}
                {filtered.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-icon">{filter==='favorites' ? '⭐' : '🔍'}</div>
                    <div className="empty-title">
                      {filter==='favorites' ? 'No favorites yet' : `No results for "${search}"`}
                    </div>
                    <div className="empty-sub">
                      {filter==='favorites'
                        ? 'Star any mountain to add it to your favorites.'
                        : 'Try a different mountain name or state.'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
