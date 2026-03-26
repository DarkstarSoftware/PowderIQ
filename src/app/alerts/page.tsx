'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import TopNav from '@/components/TopNav';

interface Alert {
  id: string; threshold: number; active: boolean;
  mountain: { id: string; name: string; state: string };
}
interface Mountain { id: string; name: string; state: string }

function ScoreLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Outstanding', color: '#16a34a' };
  if (score >= 65) return { label: 'Great Day',   color: '#0d9488' };
  if (score >= 50) return { label: 'Good Day',    color: '#2563eb' };
  if (score >= 35) return { label: 'Fair Day',    color: '#d97706' };
  return                  { label: 'Low',         color: '#dc2626' };
}

export default function AlertsPage() {
  const router = useRouter();
  const [alerts,      setAlerts]      = useState<Alert[]>([]);
  const [mountains,   setMountains]   = useState<Mountain[]>([]);
  const [isPro,       setIsPro]       = useState(false);
  const [token,       setToken]       = useState('');
  const [selectedMtn, setSelectedMtn] = useState('');
  const [threshold,   setThreshold]   = useState(70);
  const [saving,      setSaving]      = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push('/auth/login'); return; }
      const tok = data.session.access_token;
      setToken(tok);
      const [meRes, aRes, mRes] = await Promise.all([
        fetch('/api/me',     { headers: { Authorization: `Bearer ${tok}` } }),
        fetch('/api/alerts', { headers: { Authorization: `Bearer ${tok}` } }),
        fetch('/api/mountains'),
      ]);
      if (meRes.ok) {
        const me = await meRes.json();
        const role = me.data?.role || 'user';
        const sub  = me.data?.subscription?.status;
        setIsPro(role === 'pro_user' || role === 'admin' || sub === 'active' || sub === 'trialing');
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
      const d = await res.json();
      setAlerts(prev => {
        const exists = prev.find(a => a.id === d.data.id);
        return exists ? prev.map(a => a.id === d.data.id ? d.data : a) : [...prev, d.data];
      });
      setSelectedMtn('');
    }
    setSaving(false);
  }

  async function deleteAlert(id: string) {
    setDeletingId(id);
    await fetch('/api/alerts', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId: id }),
    });
    setAlerts(prev => prev.filter(a => a.id !== id));
    setDeletingId(null);
  }

  const sl = ScoreLabel(threshold);

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
          --green:#16a34a; --green-light:#dcfce7;
        }
        body { font-family:'Inter',system-ui,sans-serif; background:var(--bg); color:var(--text); -webkit-font-smoothing:antialiased; }
        .page-wrap  { min-height:100vh; background:var(--bg); }
        .page-inner { max-width:680px; margin:0 auto; padding:28px 20px 80px; }
        .page-hdr   { margin-bottom:24px; }
        .page-title { font-size:24px; font-weight:900; color:var(--text); letter-spacing:-0.03em; }
        .page-sub   { font-size:14px; color:var(--text-3); margin-top:4px; }
        .card { background:var(--white); border:1px solid var(--border-2); border-radius:16px; padding:22px; box-shadow:var(--shadow); margin-bottom:20px; }
        .card-title { font-size:14px; font-weight:700; color:var(--text); margin-bottom:18px; }
        .field { margin-bottom:18px; }
        .field label { display:block; font-size:12px; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:.05em; margin-bottom:8px; }
        select { width:100%; padding:11px 14px; border:1.5px solid var(--border-2); border-radius:10px; font-size:14px; font-family:inherit; color:var(--text); background:var(--bg); outline:none; appearance:none; cursor:pointer; }
        select:focus { border-color:var(--blue); background:var(--white); }
        .threshold-display { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
        .threshold-num { font-size:36px; font-weight:900; line-height:1; transition:color .2s; }
        .threshold-label { font-size:12px; font-weight:700; padding:3px 10px; border-radius:100px; }
        input[type=range] { width:100%; height:6px; border-radius:3px; accent-color:var(--blue); cursor:pointer; background:linear-gradient(to right, var(--blue) 0%, var(--blue) calc((${threshold}-30)/(95-30)*100%), rgba(100,150,200,0.2) calc((${threshold}-30)/(95-30)*100%), rgba(100,150,200,0.2) 100%); appearance:none; outline:none; }
        input[type=range]::-webkit-slider-thumb { appearance:none; width:18px; height:18px; border-radius:50%; background:var(--blue); border:3px solid white; box-shadow:0 1px 4px rgba(29,110,245,0.4); cursor:pointer; }
        .range-ticks { display:flex; justify-content:space-between; margin-top:6px; }
        .range-tick { font-size:10px; color:var(--text-3); font-weight:600; }
        .submit-btn { width:100%; padding:12px; border-radius:10px; background:var(--blue); color:#fff; border:none; font-size:14px; font-weight:700; font-family:inherit; cursor:pointer; transition:filter .15s; display:flex; align-items:center; justify-content:center; gap:6px; }
        .submit-btn:hover:not(:disabled) { filter:brightness(1.08); }
        .submit-btn:disabled { opacity:0.5; cursor:not-allowed; }

        /* Alert list */
        .alerts-list { display:flex; flex-direction:column; gap:10px; }
        .alert-item { display:flex; align-items:center; gap:14px; padding:14px 16px; background:var(--bg); border:1.5px solid var(--border-2); border-radius:12px; transition:border-color .15s; }
        .alert-item:hover { border-color:rgba(100,150,200,0.4); }
        .alert-dot { width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg,#1d6ef5,#0d9488); display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }
        .alert-body { flex:1; min-width:0; }
        .alert-name { font-size:14px; font-weight:700; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .alert-detail { font-size:12px; color:var(--text-3); margin-top:2px; }
        .alert-badge { padding:4px 10px; border-radius:100px; font-size:12px; font-weight:700; flex-shrink:0; }
        .delete-btn { width:32px; height:32px; border-radius:8px; border:1.5px solid var(--border-2); background:var(--white); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px; transition:all .15s; flex-shrink:0; }
        .delete-btn:hover { background:#fef2f2; border-color:#fca5a5; }
        .empty-state { text-align:center; padding:32px 20px; color:var(--text-3); }
        .empty-icon { font-size:36px; margin-bottom:10px; opacity:0.5; }
        .empty-text { font-size:13px; }

        /* Upgrade */
        .upgrade-wrap { text-align:center; padding:52px 24px; }
        .upgrade-icon { font-size:48px; margin-bottom:16px; }
        .upgrade-title { font-size:22px; font-weight:900; color:var(--text); margin-bottom:8px; }
        .upgrade-sub { font-size:14px; color:var(--text-3); margin-bottom:24px; line-height:1.6; max-width:340px; margin-left:auto; margin-right:auto; }
        .upgrade-btn { display:inline-block; padding:12px 28px; border-radius:10px; font-size:14px; font-weight:700; color:#fff; background:var(--blue); text-decoration:none; }
      `}</style>

      <div className="page-wrap">
        <TopNav active="alerts" />
        <main>
          <div className="page-inner">
            <div className="page-hdr">
              <div className="page-title">🔔 Powder Alerts</div>
              <div className="page-sub">Get notified when a resort's PowderIQ score hits your target.</div>
            </div>

            {pageLoading ? (
              <div style={{textAlign:'center',padding:'60px 0',color:'var(--text-3)',fontSize:14}}>Loading…</div>
            ) : !isPro ? (
              <div className="card">
                <div className="upgrade-wrap">
                  <div className="upgrade-icon">🔔</div>
                  <div className="upgrade-title">Pro Feature</div>
                  <div className="upgrade-sub">
                    Get notified the moment powder conditions hit your target score.
                    Available on the Pro plan.
                  </div>
                  <Link href="/account/billing" className="upgrade-btn">Upgrade to Pro →</Link>
                </div>
              </div>
            ) : (
              <>
                {/* Create alert */}
                <div className="card">
                  <div className="card-title">Create New Alert</div>
                  <form onSubmit={createAlert}>
                    <div className="field">
                      <label>Resort</label>
                      <select value={selectedMtn} onChange={e => setSelectedMtn(e.target.value)} required>
                        <option value="">Select a resort…</option>
                        {mountains.map(m => (
                          <option key={m.id} value={m.id}>{m.name} — {m.state}</option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label>Score Threshold</label>
                      <div className="threshold-display">
                        <div className="threshold-num" style={{color: sl.color}}>{threshold}</div>
                        <span className="threshold-label"
                          style={{background:`${sl.color}15`, color:sl.color}}>
                          {sl.label}
                        </span>
                      </div>
                      <input type="range" min={30} max={95} step={5}
                        value={threshold} onChange={e => setThreshold(Number(e.target.value))} />
                      <div className="range-ticks">
                        {[30, 45, 60, 75, 95].map(v => (
                          <span key={v} className="range-tick"
                            style={{color: v === threshold ? 'var(--blue)' : undefined,
                              fontWeight: v === threshold ? 800 : undefined}}>{v}</span>
                        ))}
                      </div>
                    </div>

                    <button type="submit" disabled={saving || !selectedMtn} className="submit-btn">
                      {saving ? (
                        <><div style={{width:14,height:14,border:'2px solid rgba(255,255,255,0.3)',
                          borderTopColor:'#fff',borderRadius:'50%',animation:'spin .6s linear infinite'}}/>
                          Saving…</>
                      ) : '+ Create Alert'}
                    </button>
                  </form>
                </div>

                {/* Active alerts */}
                <div className="card">
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
                    <div className="card-title" style={{marginBottom:0}}>Active Alerts</div>
                    {alerts.length > 0 && (
                      <span style={{fontSize:12,fontWeight:700,background:'var(--blue-light)',
                        color:'var(--blue)',padding:'3px 10px',borderRadius:100}}>{alerts.length}</span>
                    )}
                  </div>

                  {alerts.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">🔕</div>
                      <div className="empty-text">No alerts yet.<br/>Create one above to get notified.</div>
                    </div>
                  ) : (
                    <div className="alerts-list">
                      {alerts.map(a => {
                        const asl = ScoreLabel(a.threshold);
                        return (
                          <div key={a.id} className="alert-item">
                            <div className="alert-dot">🔔</div>
                            <div className="alert-body">
                              <div className="alert-name">{a.mountain.name}</div>
                              <div className="alert-detail">{a.mountain.state} · Notify when score ≥ {a.threshold}</div>
                            </div>
                            <span className="alert-badge"
                              style={{background:`${asl.color}15`, color:asl.color}}>
                              ≥ {a.threshold}
                            </span>
                            <button className="delete-btn" onClick={() => deleteAlert(a.id)}
                              disabled={deletingId === a.id}
                              aria-label={`Delete alert for ${a.mountain.name}`}>
                              {deletingId === a.id ? '…' : '🗑️'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      <style>{`@keyframes spin { to { transform:rotate(360deg); }}`}</style>
    </>
  );
}
