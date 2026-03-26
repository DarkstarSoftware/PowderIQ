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

export default function AlertsPage() {
  const router = useRouter();
  const [alerts,         setAlerts]         = useState<Alert[]>([]);
  const [mountains,      setMountains]      = useState<Mountain[]>([]);
  const [isPro,          setIsPro]          = useState(false);
  const [token,          setToken]          = useState('');
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

      const [meRes, aRes, mRes] = await Promise.all([
        fetch('/api/me',        { headers: { Authorization: `Bearer ${tok}` } }),
        fetch('/api/alerts',    { headers: { Authorization: `Bearer ${tok}` } }),
        fetch('/api/mountains'),
      ]);

      if (meRes.ok) {
        const me = await meRes.json();
        const role = me.data?.role || 'user';
        setIsPro(role === 'pro_user' || role === 'admin');
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
`}</style>

      <div style={{minHeight:'100vh',background:'var(--bg)'}}>
        <TopNav active="alerts" />

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
