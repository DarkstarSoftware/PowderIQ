'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import TopNav from '@/components/TopNav';
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
      ]);

      if (meRes.ok) {
        const me = await meRes.json();
        const role = me.data?.role || 'user';
        setIsPro(role === 'pro_user' || role === 'admin');
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


  const filteredMtns = mountains.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.state.toLowerCase().includes(search.toLowerCase())
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
`}</style>

      <div style={{minHeight:'100vh',background:'var(--bg)'}}>
        <TopNav active="analytics" />

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
