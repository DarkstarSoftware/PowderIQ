'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

interface Alert {
  id: string; threshold: number; active: boolean;
  mountain: { id: string; name: string; state: string };
}
interface Mountain { id: string; name: string; state: string }

export default function AlertsPage() {
  const router = useRouter();
  const [alerts,         setAlerts]         = useState<Alert[]>([]);
  const [mountains,      setMountains]      = useState<Mountain[]>([]);
  const [isPro,          setIsPro]          = useState(false);
  const [token,          setToken]          = useState('');
  const [userName,       setUserName]       = useState('');
  const [userRole,       setUserRole]       = useState('user');
  const [hasResort,      setHasResort]      = useState(false);
  const [selectedMtn,    setSelectedMtn]    = useState('');
  const [threshold,      setThreshold]      = useState(70);
  const [saving,         setSaving]         = useState(false);
  const [pageLoading,    setPageLoading]    = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push('/auth/login'); return; }
      const tok = data.session.access_token;
      setToken(tok);

      const [meRes, aRes, mRes, resortRes] = await Promise.all([
        fetch('/api/me',        { headers: { Authorization: `Bearer ${tok}` } }),
        fetch('/api/alerts',    { headers: { Authorization: `Bearer ${tok}` } }),
        fetch('/api/mountains'),
        fetch('/api/resort',    { headers: { Authorization: `Bearer ${tok}` } }),
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
      if (aRes.ok) setAlerts((await aRes.json()).data || []);
      if (mRes.ok) setMountains((await mRes.json()).data || []);
      setPageLoading(false);
    })();
  }, [router]);

  async function createAlert(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMtn) return;
    setSaving(true);
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mountainId: selectedMtn, threshold }),
    });
    if (res.ok) {
      const data = await res.json();
      setAlerts(prev => {
        const exists = prev.find(a => a.id === data.data.id);
        return exists ? prev.map(a => a.id === data.data.id ? data.data : a) : [...prev, data.data];
      });
      setSelectedMtn('');
    }
    setSaving(false);
  }

  async function deleteAlert(id: string) {
    await fetch('/api/alerts', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId: id }),
    });
    setAlerts(prev => prev.filter(a => a.id !== id));
  }

  async function handleLogout() { await supabase.auth.signOut(); router.push('/'); }

  const NAV = (
    <nav className="topnav-tabs" aria-label="Main navigation">
      <Link href="/dashboard" className="topnav-tab"><span>📊</span>Dashboard</Link>
      <Link href="/mountains" className="topnav-tab"><span>🏔️</span>Resorts</Link>
      <Link href="/forecasts" className="topnav-tab"><span>📅</span>Forecasts</Link>
      {(userRole==='pro_user'||userRole==='admin') && <Link href="/compare" className="topnav-tab"><span>📈</span>Analytics</Link>}
      {(userRole==='pro_user'||userRole==='admin') && <Link href="/alerts" className="topnav-tab active" aria-current="page"><span>🔔</span>Alerts</Link>}
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
        .page-inner { max-width:700px; margin:0 auto; padding:28px 24px 64px; }
        .page-title { font-size:26px; font-weight:900; color:var(--text); letter-spacing:-0.03em; margin-bottom:4px; }
        .page-sub { font-size:14px; color:var(--text-3); margin-bottom:24px; }
        .card { background:var(--white); border:1px solid var(--border-2); border-radius:16px; padding:20px; box-shadow:var(--shadow); margin-bottom:20px; }
        .card-title { font-size:14px; font-weight:700; color:var(--text); margin-bottom:16px; }
        label { display:block; font-size:13px; font-weight:600; color:var(--text-2); margin-bottom:6px; }
        .field { margin-bottom:16px; }
        select, .range-wrap { width:100%; background:var(--bg); border:1px solid var(--border-2); border-radius:10px; padding:10px 14px; font-size:14px; font-family:'Inter',sans-serif; color:var(--text); outline:none; appearance:none; }
        select:focus { border-color:var(--blue); }
        input[type=range] { width:100%; accent-color:var(--blue); cursor:pointer; }
        .range-labels { display:flex; justify-content:space-between; font-size:11px; color:var(--text-3); margin-top:4px; }
        .threshold-display { display:inline-flex; align-items:center; gap:6px; margin-left:8px; }
        .threshold-val { font-size:22px; font-weight:900; color:var(--blue); }
        .submit-btn { background:var(--blue); color:#fff; border:none; border-radius:10px; padding:10px 24px; font-size:14px; font-weight:700; font-family:'Inter',sans-serif; cursor:pointer; transition:filter .15s; }
        .submit-btn:hover { filter:brightness(1.1); }
        .submit-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .alert-row { display:flex; align-items:center; padding:13px 0; border-bottom:1px solid var(--border); }
        .alert-row:last-child { border-bottom:none; padding-bottom:0; }
        .alert-icon { font-size:22px; margin-right:12px; flex-shrink:0; }
        .alert-info { flex:1; }
        .alert-name { font-size:14px; font-weight:700; color:var(--text); }
        .alert-detail { font-size:12px; color:var(--text-3); margin-top:2px; }
        .alert-score-badge { background:var(--blue-light); color:var(--blue); font-size:12px; font-weight:700; padding:3px 10px; border-radius:100px; border:1px solid rgba(29,110,245,0.2); margin-right:12px; flex-shrink:0; }
        .delete-btn { width:32px; height:32px; border-radius:8px; border:1px solid var(--border-2); background:var(--bg); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:15px; transition:background .15s,border-color .15s; flex-shrink:0; }
        .delete-btn:hover { background:#fef2f2; border-color:#fca5a5; }
        .upgrade-card { text-align:center; padding:60px 24px; }
        .upgrade-icon { font-size:52px; margin-bottom:16px; }
        .upgrade-title { font-size:22px; font-weight:900; color:var(--text); margin-bottom:8px; }
        .upgrade-sub { font-size:14px; color:var(--text-3); margin-bottom:24px; }
        .upgrade-btn { display:inline-block; padding:12px 28px; border-radius:10px; font-size:14px; font-weight:700; color:#fff; background:var(--blue); text-decoration:none; }
        .empty-alerts { text-align:center; padding:28px 0 8px; color:var(--text-3); font-size:13px; }
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
            <h1 className="page-title">🔔 Powder Alerts</h1>
            <p className="page-sub">Get notified when a resort's powder score crosses your threshold.</p>

            {pageLoading ? (
              <div style={{textAlign:'center',padding:'60px 0',color:'var(--text-3)'}}>Loading…</div>
            ) : !isPro ? (
              <div className="card upgrade-card">
                <div className="upgrade-icon">🔔</div>
                <div className="upgrade-title">Pro Feature</div>
                <div className="upgrade-sub">Powder alerts are available on the Pro plan. Upgrade to get notified when conditions hit your target score.</div>
                <Link href="/account" className="upgrade-btn">Upgrade to Pro</Link>
              </div>
            ) : (
              <>
                {/* CREATE FORM */}
                <div className="card">
                  <div className="card-title">Create New Alert</div>
                  <form onSubmit={createAlert}>
                    <div className="field">
                      <label htmlFor="alert-mountain">Mountain</label>
                      <select id="alert-mountain" value={selectedMtn} onChange={e => setSelectedMtn(e.target.value)} required>
                        <option value="">Select a mountain…</option>
                        {mountains.map(m => <option key={m.id} value={m.id}>{m.name} — {m.state}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="alert-threshold">
                        Score threshold
                        <span className="threshold-display">
                          <span className="threshold-val">{threshold}</span>
                          <span style={{fontSize:12,color:'var(--text-3)'}}>— alert when score reaches this</span>
                        </span>
                      </label>
                      <input
                        id="alert-threshold"
                        type="range" min={30} max={95} step={5}
                        value={threshold}
                        onChange={e => setThreshold(Number(e.target.value))}
                        aria-valuemin={30} aria-valuemax={95} aria-valuenow={threshold}
                      />
                      <div className="range-labels"><span>30 (Low)</span><span>95 (Epic)</span></div>
                    </div>
                    <button type="submit" disabled={saving || !selectedMtn} className="submit-btn">
                      {saving ? 'Saving…' : '+ Create Alert'}
                    </button>
                  </form>
                </div>

                {/* ALERT LIST */}
                <div className="card">
                  <div className="card-title">Active Alerts ({alerts.length})</div>
                  {alerts.length === 0 ? (
                    <div className="empty-alerts">No alerts yet. Create one above.</div>
                  ) : (
                    alerts.map(a => (
                      <div key={a.id} className="alert-row">
                        <span className="alert-icon">🔔</span>
                        <div className="alert-info">
                          <div className="alert-name">{a.mountain.name}</div>
                          <div className="alert-detail">{a.mountain.state} · Notify when score ≥ {a.threshold}</div>
                        </div>
                        <span className="alert-score-badge">≥ {a.threshold}</span>
                        <button
                          onClick={() => deleteAlert(a.id)}
                          className="delete-btn"
                          aria-label={`Delete alert for ${a.mountain.name}`}
                        >🗑️</button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
