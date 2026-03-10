'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import ScoreBadge from '@/components/ScoreBadge';

interface Mountain { id: string; name: string; state: string }
interface ScoreData { score: number; breakdown: Record<string, number>; explanation: string }
interface CompareResult { mountain: Mountain; scoreData: ScoreData }

const LABELS: Record<string, string> = {
  snowfall24h: '24h Snowfall', snowfall7d: '7-Day Snowfall',
  baseDepth: 'Base Depth', wind: 'Wind',
  tempStability: 'Temp Stability', crowd: 'Crowd Factor',
};

export default function ComparePage() {
  const router = useRouter();
  const [mountains,  setMountains]  = useState<Mountain[]>([]);
  const [selected,   setSelected]   = useState<string[]>([]);
  const [results,    setResults]    = useState<CompareResult[]>([]);
  const [isPro,      setIsPro]      = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [pageLoad,   setPageLoad]   = useState(true);
  const [token,      setToken]      = useState('');
  const [userName,   setUserName]   = useState('');
  const [userRole,   setUserRole]   = useState('user');
  const [hasResort,  setHasResort]  = useState(false);
  const [search,     setSearch]     = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push('/auth/login'); return; }
      const tok = data.session.access_token;
      setToken(tok);

      const [meRes, mRes, resortRes] = await Promise.all([
        fetch('/api/me',     { headers: { Authorization: `Bearer ${tok}` } }),
        fetch('/api/mountains'),
        fetch('/api/resort', { headers: { Authorization: `Bearer ${tok}` } }),
      ]);

      if (meRes.ok) {
        const me = await meRes.json();
        const role = me.data?.role || 'user';
        setUserRole(role);
        setUserName(me.data?.profile?.displayName || '');
        setIsPro(role === 'pro_user' || role === 'admin');
      }
      if (resortRes.ok) {
        const rd = await resortRes.json();
        setHasResort((rd.data?.length ?? 0) > 0);
      }
      if (mRes.ok) setMountains((await mRes.json()).data || []);
      setPageLoad(false);
    })();
  }, [router]);

  async function runCompare() {
    if (selected.length < 2) return;
    setLoading(true);
    const res = await fetch('/api/compare', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mountainIds: selected }),
    });
    if (res.ok) setResults((await res.json()).data || []);
    setLoading(false);
  }

  function toggle(id: string) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  }

  async function handleLogout() { await supabase.auth.signOut(); router.push('/'); }

  const filteredMtns = mountains.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.state.toLowerCase().includes(search.toLowerCase())
  );

  const NAV = (
    <nav className="topnav-tabs" aria-label="Main navigation">
      <Link href="/dashboard" className="topnav-tab"><span>📊</span>Dashboard</Link>
      <Link href="/mountains" className="topnav-tab"><span>🏔️</span>Resorts</Link>
      <Link href="/forecasts" className="topnav-tab"><span>📅</span>Forecasts</Link>
      {(userRole==='pro_user'||userRole==='admin') && <Link href="/compare" className="topnav-tab active" aria-current="page"><span>📈</span>Analytics</Link>}
      {(userRole==='pro_user'||userRole==='admin') && <Link href="/alerts" className="topnav-tab"><span>🔔</span>Alerts</Link>}
      {hasResort && <Link href="/resort/dashboard" className="topnav-tab"><span>🎿</span>Resort</Link>}
      {userRole==='admin' && <Link href="/admin" className="topnav-tab"><span>⚙️</span>Admin</Link>}
    </nav>
  );

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
          --shadow:0 2px 12px rgba(15,40,80,0.08);
        }
        body { font-family:'Inter',system-ui,sans-serif; background:var(--bg); color:var(--text); -webkit-font-smoothing:antialiased; }
        a:focus-visible,button:focus-visible { outline:3px solid var(--blue); outline-offset:2px; border-radius:6px; }
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
        .topnav-signout:hover { background:var(--bg); }
        .page-body { background:var(--bg); min-height:calc(100vh - 60px); }
        .page-inner { max-width:1000px; margin:0 auto; padding:28px 24px 64px; }
        .page-title { font-size:26px; font-weight:900; color:var(--text); letter-spacing:-0.03em; margin-bottom:4px; }
        .page-sub { font-size:14px; color:var(--text-3); margin-bottom:24px; }
        .card { background:var(--white); border:1px solid var(--border-2); border-radius:16px; padding:20px; box-shadow:var(--shadow); margin-bottom:20px; }
        .card-title { font-size:14px; font-weight:700; color:var(--text); margin-bottom:14px; }
        .search-wrap { position:relative; max-width:320px; margin-bottom:14px; }
        .search-icon { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-3); font-size:13px; pointer-events:none; }
        .search-input { width:100%; background:var(--bg); border:1px solid var(--border-2); border-radius:10px; padding:9px 14px 9px 36px; font-size:13px; font-family:'Inter',sans-serif; color:var(--text); outline:none; }
        .search-input:focus { border-color:var(--blue); }
        .mtn-pills { display:flex; flex-wrap:wrap; gap:7px; margin-bottom:14px; }
        .mtn-pill { padding:7px 14px; border-radius:100px; border:1px solid var(--border-2); font-size:13px; font-weight:600; color:var(--text-3); background:var(--bg); cursor:pointer; transition:background .15s,border-color .15s,color .15s; font-family:'Inter',sans-serif; }
        .mtn-pill:hover { border-color:var(--blue); color:var(--blue); background:var(--blue-light); }
        .mtn-pill.selected { background:var(--blue); color:#fff; border-color:var(--blue); }
        .mtn-pill.disabled { opacity:0.4; cursor:not-allowed; }
        .hint { font-size:12px; color:var(--text-3); margin-bottom:14px; }
        .compare-btn { background:var(--blue); color:#fff; border:none; border-radius:10px; padding:10px 24px; font-size:14px; font-weight:700; font-family:'Inter',sans-serif; cursor:pointer; transition:filter .15s; }
        .compare-btn:hover { filter:brightness(1.1); }
        .compare-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .results-table { width:100%; border-collapse:collapse; }
        .results-table th { text-align:center; font-size:13px; font-weight:800; color:var(--text); padding:10px 14px; min-width:120px; }
        .results-table th.metric-col { text-align:left; font-size:12px; font-weight:600; color:var(--text-3); min-width:140px; }
        .results-table td { text-align:center; padding:10px 14px; font-size:13px; font-weight:600; color:var(--text-2); border-top:1px solid var(--border); }
        .results-table td.metric-col { text-align:left; color:var(--text-3); font-size:12px; }
        .upgrade-card { text-align:center; padding:60px 24px; }
        .upgrade-icon { font-size:52px; margin-bottom:16px; }
        .upgrade-title { font-size:22px; font-weight:900; color:var(--text); margin-bottom:8px; }
        .upgrade-sub { font-size:14px; color:var(--text-3); margin-bottom:24px; }
        .upgrade-btn { display:inline-block; padding:12px 28px; border-radius:10px; font-size:14px; font-weight:700; color:#fff; background:var(--blue); text-decoration:none; }
        @media(max-width:700px){ .topnav-tabs{display:none;} }
      `}</style>

      <div style={{minHeight:'100vh',background:'var(--bg)'}}>
        <header className="topnav" role="banner">
          <Link href="/" className="topnav-logo">
            <div className="topnav-logo-icon">❄️</div>
            <span className="topnav-brand">PowderIQ</span>
          </Link>
          {NAV}
          <div className="topnav-right">
            <Link href="/account" className="topnav-icon-btn">⚙️</Link>
            <div className="topnav-avatar">{userName ? userName[0].toUpperCase() : '👤'}</div>
            <button className="topnav-signout" onClick={handleLogout}>Sign out</button>
          </div>
        </header>

        <main className="page-body">
          <div className="page-inner">
            <h1 className="page-title">📈 Analytics</h1>
            <p className="page-sub">Compare powder scores and metrics across up to 4 resorts side-by-side.</p>

            {pageLoad ? (
              <div style={{textAlign:'center',padding:'60px 0',color:'var(--text-3)'}}>Loading…</div>
            ) : !isPro ? (
              <div className="card upgrade-card">
                <div className="upgrade-icon">📊</div>
                <div className="upgrade-title">Pro Feature</div>
                <div className="upgrade-sub">Mountain comparison is available on the Pro plan. Upgrade to compare resorts side-by-side.</div>
                <Link href="/account" className="upgrade-btn">Upgrade to Pro</Link>
              </div>
            ) : (
              <>
                <div className="card">
                  <div className="card-title">Select Resorts to Compare</div>
                  <div className="search-wrap">
                    <span className="search-icon">🔍</span>
                    <input
                      type="search"
                      placeholder="Filter mountains…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="search-input"
                    />
                  </div>
                  <p className="hint">
                    {selected.length === 0
                      ? 'Select 2–4 mountains below'
                      : `${selected.length} selected — ${selected.length >= 2 ? 'ready to compare!' : 'select at least 1 more'}`}
                  </p>
                  <div className="mtn-pills" role="group" aria-label="Select mountains">
                    {filteredMtns.map(m => {
                      const isSel = selected.includes(m.id);
                      const isDisabled = !isSel && selected.length >= 4;
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggle(m.id)}
                          disabled={isDisabled}
                          className={`mtn-pill${isSel?' selected':''}${isDisabled?' disabled':''}`}
                          aria-pressed={isSel}
                        >
                          {isSel && '✓ '}{m.name}
                          <span style={{fontWeight:400,opacity:0.7,marginLeft:4,fontSize:11}}>{m.state}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={runCompare}
                    disabled={selected.length < 2 || loading}
                    className="compare-btn"
                  >
                    {loading ? 'Comparing…' : `Compare ${selected.length > 0 ? `(${selected.length})` : ''}`}
                  </button>
                </div>

                {results.length > 0 && (
                  <div className="card">
                    <div className="card-title">Comparison Results</div>
                    <div style={{overflowX:'auto'}}>
                      <table className="results-table" aria-label="Mountain comparison results">
                        <thead>
                          <tr>
                            <th className="metric-col" scope="col">Metric</th>
                            {results.map(r => (
                              <th key={r.mountain.id} scope="col">{r.mountain.name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="metric-col">Overall Score</td>
                            {results.map(r => (
                              <td key={r.mountain.id}>
                                <ScoreBadge score={r.scoreData.score} />
                              </td>
                            ))}
                          </tr>
                          {Object.entries(LABELS).map(([key, label]) => (
                            <tr key={key}>
                              <td className="metric-col">{label}</td>
                              {results.map(r => (
                                <td key={r.mountain.id}>{r.scoreData.breakdown[key] ?? '—'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
