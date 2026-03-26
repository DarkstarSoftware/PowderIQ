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

const METRICS: { key: string; label: string; icon: string; unit?: string }[] = [
  { key: 'snowfall24h',   label: '24h Snow',       icon: '❄️',  unit: 'pts' },
  { key: 'snowfall7d',    label: '7-Day Snow',      icon: '🌨️', unit: 'pts' },
  { key: 'baseDepth',     label: 'Base Depth',      icon: '📏', unit: 'pts' },
  { key: 'wind',          label: 'Wind',            icon: '💨', unit: 'pts' },
  { key: 'tempStability', label: 'Temp Stability',  icon: '🌡️', unit: 'pts' },
  { key: 'crowd',         label: 'Crowd Factor',    icon: '👥', unit: 'pts' },
];

function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ flex:1, height:6, background:'rgba(100,150,200,0.15)', borderRadius:4, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:4,
          transition:'width .6s cubic-bezier(.4,0,.2,1)' }} />
      </div>
      <span style={{ fontSize:12, fontWeight:700, color, minWidth:28, textAlign:'right' }}>{Math.round(value)}</span>
    </div>
  );
}

const RESORT_COLORS = ['#1d6ef5','#0d9488','#f59e0b','#ef4444'];

function getScoreColor(score: number) {
  if (score >= 80) return '#16a34a';
  if (score >= 65) return '#0d9488';
  if (score >= 50) return '#2563eb';
  if (score >= 35) return '#d97706';
  return '#dc2626';
}

export default function ComparePage() {
  const router = useRouter();
  const [mountains,  setMountains]  = useState<Mountain[]>([]);
  const [selected,   setSelected]   = useState<string[]>([]);
  const [results,    setResults]    = useState<CompareResult[]>([]);
  const [isPro,      setIsPro]      = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [pageLoad,   setPageLoad]   = useState(true);
  const [token,      setToken]      = useState('');
  const [search,     setSearch]     = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push('/auth/login'); return; }
      const tok = data.session.access_token;
      setToken(tok);
      const [meRes, mRes] = await Promise.all([
        fetch('/api/me',       { headers: { Authorization: `Bearer ${tok}` } }),
        fetch('/api/mountains'),
      ]);
      if (meRes.ok) {
        const me = await meRes.json();
        const role = me.data?.role || 'user';
        const sub  = me.data?.subscription?.status;
        setIsPro(role === 'pro_user' || role === 'admin' || sub === 'active' || sub === 'trialing');
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

  const filtered = mountains.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.state.toLowerCase().includes(search.toLowerCase())
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
          --shadow:0 2px 12px rgba(15,40,80,0.08);
        }
        body { font-family:'Inter',system-ui,sans-serif; background:var(--bg); color:var(--text); -webkit-font-smoothing:antialiased; }
        .page-wrap { min-height:100vh; background:var(--bg); }
        .page-inner { max-width:960px; margin:0 auto; padding:28px 20px 80px; }
        .page-hdr { margin-bottom:24px; }
        .page-title { font-size:24px; font-weight:900; color:var(--text); letter-spacing:-0.03em; }
        .page-sub { font-size:14px; color:var(--text-3); margin-top:4px; }
        .card { background:var(--white); border:1px solid var(--border-2); border-radius:16px; padding:22px; box-shadow:var(--shadow); margin-bottom:20px; }
        .card-hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; }
        .card-title { font-size:14px; font-weight:700; color:var(--text); }
        .search-row { position:relative; margin-bottom:14px; }
        .search-icon { position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:14px; }
        .search-input { width:100%; padding:9px 12px 9px 36px; border:1px solid var(--border-2); border-radius:10px; font-size:13px; font-family:inherit; background:var(--bg); color:var(--text); outline:none; }
        .search-input:focus { border-color:var(--blue); background:var(--white); }
        .hint { font-size:12px; color:var(--text-3); margin-bottom:12px; }
        .pill-grid { display:flex; flex-wrap:wrap; gap:7px; margin-bottom:16px; }
        .pill { padding:6px 13px; border-radius:100px; border:1.5px solid var(--border-2); background:var(--white); font-size:12px; font-weight:600; color:var(--text-2); cursor:pointer; transition:all .15s; display:flex; align-items:center; gap:4px; }
        .pill:hover:not(:disabled) { border-color:var(--blue); color:var(--blue); background:var(--blue-light); }
        .pill.sel { border-color:var(--blue); background:var(--blue); color:#fff; }
        .pill:disabled { opacity:0.4; cursor:not-allowed; }
        .cta-row { display:flex; align-items:center; gap:12px; }
        .compare-btn { padding:10px 24px; border-radius:10px; background:var(--blue); color:#fff; border:none; font-size:14px; font-weight:700; font-family:inherit; cursor:pointer; transition:filter .15s; }
        .compare-btn:hover:not(:disabled) { filter:brightness(1.1); }
        .compare-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .sel-count { font-size:13px; color:var(--text-3); }

        /* Results */
        .results-grid { display:grid; gap:16px; }
        .resort-card { border:1.5px solid var(--border-2); border-radius:14px; overflow:hidden; background:var(--white); }
        .resort-card-hdr { padding:14px 18px; display:flex; align-items:center; gap:12px; border-bottom:1px solid var(--border); }
        .resort-rank { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; color:#fff; flex-shrink:0; }
        .resort-meta { flex:1; }
        .resort-name { font-size:15px; font-weight:800; color:var(--text); }
        .resort-state { font-size:12px; color:var(--text-3); }
        .resort-score-ring { width:52px; height:52px; flex-shrink:0; position:relative; }
        .resort-card-body { padding:14px 18px 18px; }
        .metric-row { display:grid; grid-template-columns:130px 1fr; align-items:center; gap:8px; margin-bottom:10px; }
        .metric-row:last-child { margin-bottom:0; }
        .metric-label { font-size:11px; font-weight:600; color:var(--text-3); display:flex; align-items:center; gap:4px; }
        .explanation { font-size:12px; color:var(--text-2); line-height:1.6; padding-top:12px; border-top:1px solid var(--border); margin-top:12px; }

        /* Upgrade */
        .upgrade-wrap { text-align:center; padding:60px 24px; }
        .upgrade-icon { font-size:48px; margin-bottom:16px; }
        .upgrade-title { font-size:22px; font-weight:900; color:var(--text); margin-bottom:8px; }
        .upgrade-sub { font-size:14px; color:var(--text-3); margin-bottom:24px; max-width:360px; margin-left:auto; margin-right:auto; line-height:1.6; }
        .upgrade-btn { display:inline-block; padding:12px 28px; border-radius:10px; font-size:14px; font-weight:700; color:#fff; background:var(--blue); text-decoration:none; }

        @media(max-width:640px) { .results-grid { grid-template-columns:1fr; } }
        @media(min-width:640px) { .results-grid { grid-template-columns:repeat(2,1fr); } }
      `}</style>

      <div className="page-wrap">
        <TopNav active="analytics" />
        <main>
          <div className="page-inner">
            <div className="page-hdr">
              <div className="page-title">📈 Analytics</div>
              <div className="page-sub">Compare powder scores and conditions across up to 4 resorts side-by-side.</div>
            </div>

            {pageLoad ? (
              <div style={{textAlign:'center',padding:'60px 0',color:'var(--text-3)',fontSize:14}}>Loading resorts…</div>
            ) : !isPro ? (
              <div className="card">
                <div className="upgrade-wrap">
                  <div className="upgrade-icon">📊</div>
                  <div className="upgrade-title">Pro Feature</div>
                  <div className="upgrade-sub">Compare resorts side-by-side with detailed score breakdowns. Available on the Pro plan.</div>
                  <Link href="/account/billing" className="upgrade-btn">Upgrade to Pro →</Link>
                </div>
              </div>
            ) : (
              <>
                {/* Resort selector */}
                <div className="card">
                  <div className="card-hdr">
                    <div className="card-title">Select Resorts</div>
                    <span className="sel-count">{selected.length}/4 selected</span>
                  </div>
                  <div className="search-row">
                    <span className="search-icon">🔍</span>
                    <input className="search-input" type="search" placeholder="Search resorts…"
                      value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <p className="hint">
                    {selected.length < 2
                      ? `Select ${2 - selected.length} more resort${selected.length === 1 ? '' : 's'} to compare`
                      : `${selected.length} resorts ready — hit Compare`}
                  </p>
                  <div className="pill-grid">
                    {filtered.map(m => {
                      const isSel = selected.includes(m.id);
                      const idx   = selected.indexOf(m.id);
                      return (
                        <button key={m.id} onClick={() => toggle(m.id)}
                          disabled={!isSel && selected.length >= 4}
                          className={`pill${isSel ? ' sel' : ''}`}
                          style={isSel ? { background: RESORT_COLORS[idx], borderColor: RESORT_COLORS[idx] } : {}}>
                          {isSel && <span style={{fontSize:10}}>✓</span>}
                          {m.name}
                          <span style={{opacity:0.7,fontSize:11}}>{m.state}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="cta-row">
                    <button className="compare-btn" onClick={runCompare}
                      disabled={selected.length < 2 || loading}>
                      {loading ? 'Comparing…' : `Compare ${selected.length > 0 ? `(${selected.length})` : ''}`}
                    </button>
                    {selected.length > 0 && (
                      <button onClick={() => { setSelected([]); setResults([]); }}
                        style={{background:'none',border:'none',fontSize:12,color:'var(--text-3)',cursor:'pointer',fontFamily:'inherit'}}>
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Results */}
                {results.length > 0 && (
                  <>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--text-2)',marginBottom:12}}>
                      Results — ranked by overall score
                    </div>
                    <div className="results-grid">
                      {[...results]
                        .sort((a, b) => b.scoreData.score - a.scoreData.score)
                        .map((r, i) => {
                          const color = RESORT_COLORS[selected.indexOf(r.mountain.id)] ?? RESORT_COLORS[i];
                          return (
                            <div key={r.mountain.id} className="resort-card"
                              style={{borderColor: i === 0 ? color : 'var(--border-2)'}}>
                              <div className="resort-card-hdr">
                                <div className="resort-rank" style={{background:color}}>
                                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i+1}
                                </div>
                                <div className="resort-meta">
                                  <div className="resort-name">{r.mountain.name}</div>
                                  <div className="resort-state">{r.mountain.state}</div>
                                </div>
                                <div style={{textAlign:'right'}}>
                                  <div style={{fontSize:28,fontWeight:900,color:getScoreColor(r.scoreData.score),lineHeight:1}}>
                                    {r.scoreData.score}
                                  </div>
                                  <div style={{fontSize:10,color:'var(--text-3)',marginTop:2}}>PowderIQ Score</div>
                                </div>
                              </div>
                              <div className="resort-card-body">
                                {METRICS.map(({ key, label, icon }) => (
                                  <div key={key} className="metric-row">
                                    <div className="metric-label">{icon} {label}</div>
                                    <ScoreBar value={r.scoreData.breakdown[key] ?? 0} color={color} />
                                  </div>
                                ))}
                                {r.scoreData.explanation && (
                                  <div className="explanation">{r.scoreData.explanation}</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
