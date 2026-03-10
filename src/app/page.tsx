import Link from 'next/link';

const FEATURED_RESORTS = [
  { name: 'Kirkwood',        state: 'CA', score: 82, label: 'Great',       newSnow: 28, base: 800, pass: 'Ikon', img: 'https://images.unsplash.com/photo-1548777123-e216912df7d8?w=600&q=80' },
  { name: 'Alta',            state: 'UT', score: 91, label: 'Powder Star', newSnow: 18, base: 920, pass: 'Ikon', img: 'https://images.unsplash.com/photo-1605540436563-5bca919ae766?w=600&q=80' },
  { name: 'Snowbird',        state: 'UT', score: 88, label: 'Great',       newSnow: 24, base: 880, pass: 'Ikon', img: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600&q=80' },
  { name: 'Jackson Hole',    state: 'WY', score: 85, label: 'Great',       newSnow: 20, base: 760, pass: 'Ikon', img: 'https://images.unsplash.com/photo-1453872302360-eed3c5f8ff66?w=600&q=80' },
  { name: 'Mt. Bachelor',    state: 'OR', score: 79, label: 'Good',        newSnow: 14, base: 640, pass: 'Epic', img: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=80' },
  { name: 'Stevens Pass',    state: 'WA', score: 74, label: 'Good',        newSnow:  9, base: 580, pass: 'Ikon', img: 'https://images.unsplash.com/photo-1546961342-ea5f73e193f9?w=600&q=80' },
];

const FORECAST_DAYS = [
  { day: 'Tue', icon: '🌨', snow: 8,  prob: 92 },
  { day: 'Wed', icon: '🌨', snow: 12, prob: 88 },
  { day: 'Thu', icon: '⛅', snow: 3,  prob: 45 },
  { day: 'Fri', icon: '☀️', snow: 0,  prob: 10 },
  { day: 'Sat', icon: '🌨', snow: 5,  prob: 57 },
];

function ScoreRing({ score, label }: { score: number; label: string }) {
  const color = score >= 85 ? '#1d6ef5' : score >= 70 ? '#22c55e' : score >= 55 ? '#f59e0b' : '#94a3b8';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{
        width:44, height:44, borderRadius:'50%', flexShrink:0,
        background:`conic-gradient(${color} ${score*3.6}deg, rgba(200,215,235,0.4) 0deg)`,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <div style={{
          width:34, height:34, borderRadius:'50%',
          background:'rgba(255,255,255,0.95)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:12, fontWeight:800, color, fontFamily:'Inter,sans-serif',
        }}>{score}</div>
      </div>
      <span style={{ fontSize:12, fontWeight:700, color, background:`${color}18`, padding:'2px 8px', borderRadius:100 }}>{label}</span>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --blue:       #1d6ef5;
          --blue-dark:  #1558d6;
          --blue-light: #e8f1fe;
          --blue-mid:   #3b82f6;
          --text:       #0d1b2e;
          --text-2:     #3d5166;
          --text-3:     #6b849a;
          --border:     rgba(100,150,200,0.18);
          --border-2:   rgba(100,150,200,0.28);
          --glass:      rgba(255,255,255,0.72);
          --glass-2:    rgba(255,255,255,0.88);
          --bg:         #f0f5fb;
          --white:      #ffffff;
          --radius:     18px;
          --shadow:     0 4px 24px rgba(15,40,80,0.10);
          --shadow-lg:  0 12px 48px rgba(15,40,80,0.16);
        }
        html { scroll-behavior: smooth; }
        body { font-family:'Inter',system-ui,sans-serif; background:var(--bg); color:var(--text); -webkit-font-smoothing:antialiased; }

        .skip-link { position:absolute; top:-60px; left:16px; z-index:9999; background:var(--blue); color:#fff; padding:10px 18px; border-radius:8px; font-weight:700; font-size:14px; text-decoration:none; transition:top .15s; }
        .skip-link:focus { top:12px; }
        a:focus-visible, button:focus-visible { outline:3px solid var(--blue); outline-offset:3px; border-radius:6px; }

        /* ── NAV ── */
        .nav { background:rgba(255,255,255,0.85); backdrop-filter:blur(20px); border-bottom:1px solid var(--border-2); position:sticky; top:0; z-index:50; }
        .nav-inner { max-width:1200px; margin:0 auto; padding:0 28px; height:66px; display:flex; align-items:center; justify-content:space-between; }
        .nav-logo { display:flex; align-items:center; gap:10px; text-decoration:none; }
        .nav-logo-icon { width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg,#1d6ef5,#3b82f6); display:flex; align-items:center; justify-content:center; font-size:19px; box-shadow:0 2px 8px rgba(29,110,245,0.35); }
        .nav-logo-text { font-size:20px; font-weight:900; color:var(--text); letter-spacing:-0.03em; }
        .nav-logo-sub { font-size:11px; color:var(--text-3); margin-top:-1px; font-weight:500; letter-spacing:0.02em; }
        .nav-links { display:flex; align-items:center; gap:6px; }
        .btn-ghost { padding:9px 18px; border-radius:10px; font-size:14px; font-weight:600; color:var(--text-2); text-decoration:none; background:transparent; border:none; cursor:pointer; font-family:'Inter',sans-serif; transition:background .15s,color .15s; }
        .btn-ghost:hover { background:var(--blue-light); color:var(--blue); }
        .btn-nav { padding:10px 20px; border-radius:10px; font-size:14px; font-weight:700; color:#fff; background:var(--blue); text-decoration:none; border:none; cursor:pointer; font-family:'Inter',sans-serif; box-shadow:0 2px 10px rgba(29,110,245,0.3); transition:filter .15s,transform .1s; }
        .btn-nav:hover { filter:brightness(1.1); transform:translateY(-1px); }

        /* ── HERO ── */
        .hero-section {
          position:relative; overflow:hidden; min-height:92vh;
          display:flex; flex-direction:column; justify-content:center;
          background:linear-gradient(180deg, #dce8f5 0%, #e8f2fb 40%, #f0f5fb 100%);
        }
        .hero-mountain-bg {
          position:absolute; inset:0; z-index:0;
          background-image:url('https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1600&q=70');
          background-size:cover; background-position:center 30%;
          opacity:0.18;
        }
        .hero-gradient-overlay { position:absolute; inset:0; z-index:1; background:linear-gradient(180deg,rgba(220,232,245,0.5) 0%,rgba(240,245,251,0.92) 75%,rgba(240,245,251,1) 100%); }
        .hero-inner { position:relative; z-index:2; max-width:1200px; margin:0 auto; padding:80px 28px 64px; display:grid; grid-template-columns:1fr 1fr; gap:64px; align-items:center; }
        @media(max-width:860px){ .hero-inner{grid-template-columns:1fr;padding:48px 20px 40px;gap:40px;} .hero-visual{order:-1;} }

        .hero-eyebrow { display:inline-flex; align-items:center; gap:7px; background:rgba(29,110,245,0.1); color:var(--blue); border:1px solid rgba(29,110,245,0.2); border-radius:100px; padding:6px 14px; font-size:13px; font-weight:600; margin-bottom:20px; }
        .hero-eyebrow-dot { width:7px; height:7px; border-radius:50%; background:var(--blue); animation:pulse 2s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.5)} }

        .hero-title { font-size:clamp(38px,5vw,60px); font-weight:900; line-height:1.07; letter-spacing:-0.03em; color:var(--text); margin-bottom:18px; }
        .hero-title .accent { color:var(--blue); }
        .hero-sub { font-size:17px; line-height:1.75; color:var(--text-2); margin-bottom:34px; max-width:440px; }
        .hero-ctas { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:36px; }
        .btn-primary-lg { padding:15px 30px; border-radius:12px; font-size:16px; font-weight:700; color:#fff; background:var(--blue); text-decoration:none; display:inline-block; font-family:'Inter',sans-serif; box-shadow:0 4px 18px rgba(29,110,245,0.4); transition:filter .15s,transform .15s,box-shadow .15s; }
        .btn-primary-lg:hover { filter:brightness(1.1); transform:translateY(-2px); box-shadow:0 6px 28px rgba(29,110,245,0.5); }
        .btn-outline-lg { padding:14px 28px; border-radius:12px; font-size:16px; font-weight:700; color:var(--text); background:var(--glass-2); text-decoration:none; display:inline-block; font-family:'Inter',sans-serif; border:1.5px solid var(--border-2); transition:border-color .15s,transform .15s,background .15s; }
        .btn-outline-lg:hover { border-color:var(--blue); color:var(--blue); transform:translateY(-2px); background:#fff; }

        .hero-stats { display:flex; gap:28px; padding-top:24px; border-top:1px solid var(--border-2); }
        .hero-stat-num { font-size:24px; font-weight:900; color:var(--text); letter-spacing:-0.02em; }
        .hero-stat-label { font-size:12px; color:var(--text-3); margin-top:3px; }

        /* Dashboard mockup */
        .hero-visual { display:flex; justify-content:center; position:relative; }
        .dash-mock {
          background:var(--glass-2); backdrop-filter:blur(20px);
          border:1px solid var(--border-2); border-radius:20px;
          box-shadow:var(--shadow-lg); width:100%; max-width:400px; overflow:hidden;
        }
        .dash-mock-topbar {
          background:rgba(255,255,255,0.95); border-bottom:1px solid var(--border);
          padding:12px 16px; display:flex; align-items:center; gap:10px;
        }
        .dash-mock-logo { width:28px; height:28px; border-radius:8px; background:linear-gradient(135deg,var(--blue),var(--blue-mid)); display:flex; align-items:center; justify-content:center; font-size:15px; }
        .dash-mock-brand { font-size:14px; font-weight:800; color:var(--text); letter-spacing:-0.02em; }
        .dash-mock-tabs { display:flex; gap:2px; margin-left:8px; }
        .dash-mock-tab { font-size:11px; font-weight:600; padding:4px 10px; border-radius:6px; color:var(--text-3); }
        .dash-mock-tab.active { background:var(--blue-light); color:var(--blue); }
        .dash-mock-body { display:grid; grid-template-columns:120px 1fr; min-height:280px; }
        .dash-mock-sidebar { background:rgba(248,251,255,0.8); border-right:1px solid var(--border); padding:12px 10px; }
        .dash-mock-nav-item { font-size:11px; font-weight:600; padding:7px 8px; border-radius:8px; color:var(--text-3); margin-bottom:2px; display:flex; align-items:center; gap:6px; }
        .dash-mock-nav-item.active { background:var(--blue-light); color:var(--blue); }
        .dash-mock-saved-label { font-size:10px; font-weight:700; color:var(--text-3); padding:10px 8px 4px; letter-spacing:0.05em; text-transform:uppercase; }
        .dash-mock-resort-row { display:flex; align-items:center; gap:6px; padding:5px 8px; border-radius:8px; cursor:pointer; }
        .dash-mock-resort-row:hover { background:var(--blue-light); }
        .dash-mock-resort-thumb { width:22px; height:22px; border-radius:6px; object-fit:cover; background:#c8d8e8; }
        .dash-mock-resort-name { font-size:10px; font-weight:700; color:var(--text-2); }
        .dash-mock-resort-score { font-size:10px; font-weight:700; color:var(--blue); margin-left:auto; }
        .dash-mock-main { padding:12px; }
        .dash-mock-card { background:#fff; border:1px solid var(--border); border-radius:12px; padding:12px; margin-bottom:8px; }
        .dash-mock-card-header { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
        .dash-mock-card-logo { width:26px; height:26px; border-radius:7px; background:linear-gradient(135deg,var(--blue),var(--blue-mid)); display:flex; align-items:center; justify-content:center; font-size:13px; }
        .dash-mock-card-title { font-size:13px; font-weight:800; color:var(--text); }
        .dash-mock-big-score { font-size:36px; font-weight:900; color:var(--blue); line-height:1; letter-spacing:-0.03em; }
        .dash-mock-score-label { font-size:13px; font-weight:700; color:var(--blue); margin-top:2px; }
        .dash-mock-metrics { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:4px; margin-top:8px; }
        .dash-mock-metric { background:var(--bg); border-radius:7px; padding:5px; text-align:center; }
        .dash-mock-metric-val { font-size:11px; font-weight:700; color:var(--text); }
        .dash-mock-metric-key { font-size:9px; color:var(--text-3); margin-top:1px; }
        .dash-mock-forecast-label { font-size:11px; font-weight:700; color:var(--text-2); margin:8px 0 6px; }
        .dash-mock-forecast { display:flex; gap:4px; }
        .dash-mock-fc { flex:1; background:var(--bg); border-radius:7px; padding:5px 2px; text-align:center; }
        .dash-mock-fc-day { font-size:9px; color:var(--text-3); margin-bottom:2px; }
        .dash-mock-fc-icon { font-size:12px; }
        .dash-mock-fc-snow { font-size:10px; font-weight:700; color:var(--blue); margin-top:1px; }
        .floating-pill { position:absolute; background:rgba(255,255,255,0.95); backdrop-filter:blur(12px); border:1px solid var(--border-2); border-radius:100px; padding:7px 13px; display:flex; align-items:center; gap:6px; font-size:12px; font-weight:700; color:var(--text); box-shadow:var(--shadow); white-space:nowrap; animation:floatY 3s ease-in-out infinite; }
        .pill-1 { top:-10px; right:-6px; color:#16a34a; animation-delay:0s; }
        .pill-2 { bottom:16px; left:-18px; color:var(--blue); animation-delay:1.7s; }
        @keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }

        /* ── FEATURE SECTIONS ── */
        .feature-section { position:relative; overflow:hidden; }
        .feature-section-bg { position:absolute; inset:0; background-size:cover; background-position:center; opacity:0.1; }
        .feature-section-overlay { position:absolute; inset:0; }
        .feature-section-inner { position:relative; z-index:2; max-width:1200px; margin:0 auto; padding:80px 28px; }
        .feature-section-header { text-align:center; margin-bottom:48px; }
        .feature-section-title { font-size:clamp(28px,3.5vw,44px); font-weight:900; color:var(--text); letter-spacing:-0.03em; margin-bottom:12px; }
        .feature-section-sub { font-size:17px; color:var(--text-2); max-width:520px; margin:0 auto; line-height:1.65; }
        .feature-section-sub strong { color:var(--blue); }

        /* ── POWDER INTELLIGENCE SECTION ── */
        .pi-section { position:relative; overflow:hidden; background:linear-gradient(180deg,#f0f5fb 0%,#e8f2fb 100%); } .pi-section::before { content:""; position:absolute; inset:0; z-index:0; background-image:url("https://images.unsplash.com/photo-1605540436563-5bca919ae766?w=1600&q=60"); background-size:cover; background-position:center 40%; opacity:0.07; } .pi-section > * { position:relative; z-index:1; }
        .pi-mockup-wrap { background:var(--glass-2); border:1px solid var(--border-2); border-radius:20px; box-shadow:var(--shadow-lg); overflow:hidden; }
        .pi-mockup-header { background:#fff; border-bottom:1px solid var(--border); padding:14px 20px; display:flex; align-items:center; gap:10px; }
        .pi-resort-info { display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:16px; }
        .pi-score-card { background:#fff; border:1px solid var(--border); border-radius:14px; padding:16px; }
        .pi-big-score { font-size:64px; font-weight:900; color:var(--blue); line-height:1; letter-spacing:-0.04em; }
        .pi-score-label { font-size:18px; font-weight:700; color:var(--blue); margin-top:4px; }
        .pi-metrics { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:12px; }
        .pi-metric { background:var(--bg); border-radius:9px; padding:10px; text-align:center; }
        .pi-metric-val { font-size:15px; font-weight:700; color:var(--text); }
        .pi-metric-key { font-size:11px; color:var(--text-3); margin-top:2px; }
        .pi-forecast-card { background:#fff; border:1px solid var(--border); border-radius:14px; padding:16px; }
        .pi-forecast-title { font-size:13px; font-weight:700; color:var(--text-2); margin-bottom:12px; }
        .pi-fc-row { display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border); }
        .pi-fc-row:last-child { border-bottom:none; padding-bottom:0; }
        .pi-fc-day { font-size:13px; font-weight:600; color:var(--text-2); width:36px; }
        .pi-fc-icon { font-size:16px; }
        .pi-fc-snow { font-size:16px; font-weight:800; color:var(--text); }
        .pi-fc-unit { font-size:11px; color:var(--text-3); font-weight:500; }
        .pi-fc-desc { font-size:11px; color:var(--text-3); max-width:120px; }

        /* ── FORECAST SECTION ── */
        .forecast-section { position:relative; overflow:hidden; background:linear-gradient(180deg,#e8f2fb 0%,#dce8f5 100%); } .forecast-section::before { content:""; position:absolute; inset:0; z-index:0; background-image:url("https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1600&q=60"); background-size:cover; background-position:center 30%; opacity:0.07; } .forecast-section > * { position:relative; z-index:1; }
        .forecast-mock { background:var(--glass-2); border:1px solid var(--border-2); border-radius:20px; box-shadow:var(--shadow-lg); padding:24px; }
        .forecast-mock-header { display:flex; align-items:center; gap:10px; margin-bottom:20px; }
        .forecast-mock-title { font-size:18px; font-weight:800; color:var(--text); }
        .forecast-mock-days { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; }
        .forecast-mock-day { background:#fff; border:1px solid var(--border); border-radius:14px; padding:14px 10px; text-align:center; }
        .fmd-name { font-size:12px; font-weight:700; color:var(--text-2); margin-bottom:8px; }
        .fmd-icon { font-size:28px; margin-bottom:8px; }
        .fmd-snow { font-size:20px; font-weight:900; color:var(--text); }
        .fmd-unit { font-size:11px; color:var(--text-3); margin-left:2px; }
        .fmd-prob { font-size:11px; color:var(--blue); margin-top:5px; font-weight:600; }

        /* ── RESORT LIST SECTION ── */
        .resorts-section { position:relative; overflow:hidden; background:linear-gradient(180deg,#f0f5fb 0%,#e8f2fb 100%); } .resorts-section::before { content:""; position:absolute; inset:0; z-index:0; background-image:url("https://images.unsplash.com/photo-1478827536114-da961b7f86d2?w=1600&q=60"); background-size:cover; background-position:center 20%; opacity:0.06; } .resorts-section > * { position:relative; z-index:1; }
        .section { max-width:1200px; margin:0 auto; padding:0 28px 80px; }
        .section-header { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:28px; flex-wrap:wrap; gap:16px; }
        .section-title { font-size:24px; font-weight:800; color:var(--text); letter-spacing:-0.02em; }
        .section-sub { font-size:14px; color:var(--text-3); margin-top:4px; }
        .filter-tabs { display:flex; gap:4px; background:#fff; padding:4px; border-radius:12px; border:1px solid var(--border-2); }
        .filter-tab { padding:7px 18px; border-radius:9px; font-size:13px; font-weight:600; color:var(--text-2); cursor:pointer; border:none; background:transparent; font-family:'Inter',sans-serif; transition:background .15s,color .15s; }
        .filter-tab.active { background:var(--blue); color:#fff; box-shadow:0 2px 8px rgba(29,110,245,0.3); }
        .filter-tab:hover:not(.active) { color:var(--text); background:var(--blue-light); }
        .resort-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px; }
        .resort-card { background:var(--white); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; text-decoration:none; color:inherit; display:flex; flex-direction:column; box-shadow:var(--shadow); transition:transform .2s,box-shadow .2s,border-color .2s; }
        .resort-card:hover { transform:translateY(-4px); box-shadow:var(--shadow-lg); border-color:var(--border-2); }
        .resort-img-wrap { position:relative; }
        .resort-img { width:100%; height:170px; object-fit:cover; display:block; }
        .resort-img-overlay { position:absolute; inset:0; background:linear-gradient(to bottom,transparent 55%,rgba(13,27,46,0.45) 100%); }
        .resort-pass-badge { position:absolute; top:10px; right:10px; font-size:11px; font-weight:700; padding:4px 10px; border-radius:100px; backdrop-filter:blur(10px); }
        .pass-Ikon { background:rgba(29,110,245,0.85); color:#fff; }
        .pass-Epic { background:rgba(0,0,0,0.7); color:#fff; }
        .pass-Indy { background:rgba(255,255,255,0.85); color:var(--text-2); }
        .resort-body { padding:14px; flex:1; display:flex; flex-direction:column; gap:10px; }
        .resort-title-row { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
        .resort-name { font-size:15px; font-weight:800; color:var(--text); }
        .resort-state { font-size:12px; color:var(--text-3); margin-top:2px; }
        .resort-metrics { display:flex; gap:6px; }
        .metric-chip { flex:1; background:var(--bg); border-radius:9px; padding:8px; text-align:center; border:1px solid var(--border); }
        .metric-val { font-size:13px; font-weight:700; color:var(--text); }
        .metric-val.blue-val { color:var(--blue); }
        .metric-val.green-val { color:#16a34a; }
        .metric-key { font-size:10px; color:var(--text-3); margin-top:2px; }
        .see-all-wrap { text-align:center; margin-top:32px; }

        /* ── ANALYTICS SECTION ── */
        .analytics-section { position:relative; overflow:hidden; background:linear-gradient(180deg,#dce8f5 0%,#e8f2fb 100%); padding:80px 0; } .analytics-section::before { content:""; position:absolute; inset:0; z-index:0; background-image:url("https://images.unsplash.com/photo-1548777123-e216912df7d8?w=1600&q=60"); background-size:cover; background-position:center 35%; opacity:0.07; } .analytics-section > * { position:relative; z-index:1; }
        .analytics-inner { max-width:1200px; margin:0 auto; padding:0 28px; }
        .analytics-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-top:48px; }
        @media(max-width:860px){ .analytics-grid{grid-template-columns:1fr;} }
        .analytics-card { background:var(--white); border:1px solid var(--border); border-radius:var(--radius); padding:20px; box-shadow:var(--shadow); }
        .analytics-card-header { display:flex; align-items:center; gap:8px; margin-bottom:14px; }
        .analytics-logo { width:28px; height:28px; border-radius:8px; background:linear-gradient(135deg,var(--blue),var(--blue-mid)); display:flex; align-items:center; justify-content:center; font-size:14px; }
        .analytics-resort-name { font-size:14px; font-weight:800; color:var(--text); }
        .analytics-date { font-size:11px; color:var(--text-3); margin-left:auto; }
        .analytics-resort-row { display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid var(--border); }
        .analytics-resort-row:last-child { border-bottom:none; }
        .analytics-resort-thumb { width:30px; height:30px; border-radius:8px; object-fit:cover; background:var(--bg); }
        .analytics-resort-info { flex:1; }
        .analytics-resort-name-sm { font-size:13px; font-weight:700; color:var(--text); }
        .analytics-resort-rating { font-size:11px; color:var(--text-3); margin-top:1px; }
        .analytics-snow-val { font-size:16px; font-weight:900; color:var(--text); }
        .analytics-snow-unit { font-size:11px; color:var(--text-3); font-weight:500; }
        .analytics-badge { font-size:10px; font-weight:700; padding:2px 8px; border-radius:100px; background:rgba(29,110,245,0.12); color:var(--blue); margin-left:4px; }
        .analytics-chart { background:var(--bg); border-radius:10px; padding:12px; margin-top:12px; height:80px; display:flex; align-items:flex-end; gap:4px; }
        .chart-bar-wrap { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; height:100%; justify-content:flex-end; }
        .chart-bar { width:100%; border-radius:4px 4px 0 0; background:linear-gradient(180deg,var(--blue),#93c5fd); min-height:4px; transition:opacity .2s; }
        .chart-bar:hover { opacity:0.8; }
        .chart-label { font-size:8px; color:var(--text-3); }

        /* ── CTA BAND ── */
        .cta-section { background:linear-gradient(180deg,#e8f2fb 0%,#f0f5fb 100%); padding:0 0 80px; }
        .cta-inner { max-width:1152px; margin:0 auto; padding:0 28px; }
        .cta-card { background:linear-gradient(135deg,var(--blue) 0%,#1344cc 60%,#0e2d8a 100%); border-radius:24px; padding:56px 48px; display:flex; align-items:center; justify-content:space-between; gap:28px; flex-wrap:wrap; box-shadow:0 8px 40px rgba(29,110,245,0.35); position:relative; overflow:hidden; }
        .cta-card::before { content:''; position:absolute; top:-80px; right:-80px; width:320px; height:320px; border-radius:50%; background:radial-gradient(circle,rgba(255,255,255,0.08) 0%,transparent 70%); pointer-events:none; }
        .cta-title { font-size:28px; font-weight:900; color:#fff; margin-bottom:8px; letter-spacing:-0.02em; position:relative; }
        .cta-sub { font-size:15px; color:rgba(255,255,255,0.8); max-width:420px; line-height:1.6; position:relative; }
        .btn-white { padding:15px 30px; border-radius:12px; font-size:16px; font-weight:700; color:var(--blue); background:#fff; text-decoration:none; display:inline-block; font-family:'Inter',sans-serif; white-space:nowrap; box-shadow:0 4px 20px rgba(0,0,0,0.15); transition:transform .15s,box-shadow .15s; }
        .btn-white:hover { transform:translateY(-2px); box-shadow:0 6px 28px rgba(0,0,0,0.22); }

        /* ── FOOTER ── */
        .footer-outer { border-top:1px solid var(--border-2); background:#fff; }
        .footer { max-width:1200px; margin:0 auto; padding:28px 28px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px; }
        .footer-logo { display:flex; align-items:center; gap:8px; text-decoration:none; }
        .footer-logo-icon { width:28px; height:28px; border-radius:8px; background:linear-gradient(135deg,var(--blue),var(--blue-mid)); display:flex; align-items:center; justify-content:center; font-size:14px; }
        .footer-logo-text { font-size:15px; font-weight:800; color:var(--text); }
        .footer-copy { font-size:12px; color:var(--text-3); margin-top:3px; }
        .footer-links { display:flex; gap:22px; }
        .footer-link { font-size:13px; font-weight:500; color:var(--text-2); text-decoration:none; transition:color .15s; }
        .footer-link:hover { color:var(--blue); }

        @media(max-width:600px){
          .cta-card{padding:32px 22px;}
          .hero-stats{gap:20px;}
          .section-header{flex-direction:column;align-items:flex-start;}
          .dash-mock-body{grid-template-columns:1fr;}
          .dash-mock-sidebar{display:none;}
          .forecast-mock-days{grid-template-columns:repeat(3,1fr);}
          .analytics-grid{grid-template-columns:1fr;}
        }
      `}</style>

      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* NAV */}
      <nav className="nav" aria-label="Main navigation">
        <div className="nav-inner">
          <Link href="/" className="nav-logo" aria-label="PowderIQ home">
            <div className="nav-logo-icon" aria-hidden="true">❄️</div>
            <div>
              <div className="nav-logo-text">PowderIQ</div>
              <div className="nav-logo-sub">Smart Snow Intelligence</div>
            </div>
          </Link>
          <div className="nav-links">
            <Link href="/auth/login" className="btn-ghost">Sign in</Link>
            <Link href="/auth/signup" className="btn-nav">Get Started Free</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero-section" aria-labelledby="hero-heading">
        <div className="hero-mountain-bg" aria-hidden="true" />
        <div className="hero-gradient-overlay" aria-hidden="true" />
        <div className="hero-inner">
          <div>
            <div className="hero-eyebrow">
              <span className="hero-eyebrow-dot" aria-hidden="true" />
              Live powder intelligence
            </div>
            <h1 id="hero-heading" className="hero-title">
              Know before<br />you go.<br />
              <span className="accent">Score the powder.</span>
            </h1>
            <p className="hero-sub">
              PowderIQ turns snowfall, wind, and resort data into one smart score —
              so you always know which mountain is worth the drive.
              Works with Ikon, Epic, Indy, or no pass at all.
            </p>
            <div className="hero-ctas">
              <Link href="/auth/signup" className="btn-primary-lg">Start Free Today</Link>
              <Link href="/auth/login" className="btn-outline-lg">Sign In</Link>
            </div>
            <div className="hero-stats" aria-label="Key statistics">
              <div><div className="hero-stat-num">500+</div><div className="hero-stat-label">Resorts tracked</div></div>
              <div><div className="hero-stat-num">Hourly</div><div className="hero-stat-label">Score updates</div></div>
              <div><div className="hero-stat-num">Free</div><div className="hero-stat-label">To get started</div></div>
            </div>
          </div>

          {/* Dashboard mockup */}
          <div className="hero-visual" aria-hidden="true">
            <div className="dash-mock">
              <div className="dash-mock-topbar">
                <div className="dash-mock-logo">❄️</div>
                <span className="dash-mock-brand">PowderIQ</span>
                <div className="dash-mock-tabs">
                  {['Dashboard','Resorts','Forecasts','Alerts'].map((t,i)=>(
                    <span key={t} className={`dash-mock-tab${i===0?' active':''}`}>{t}</span>
                  ))}
                </div>
              </div>
              <div className="dash-mock-body">
                <div className="dash-mock-sidebar">
                  {['Dashboard','Resorts','Forecasts','Alerts'].map((item,i)=>(
                    <div key={item} className={`dash-mock-nav-item${i===0?' active':''}`}>
                      <span>{['📊','🏔️','📅','🔔'][i]}</span>{item}
                    </div>
                  ))}
                  <div className="dash-mock-saved-label">Saved Resorts</div>
                  {[['Kirkwood','82'],['Sugar Bowl','74'],['Stevens Pass','77'],['Mt. Bachelor','79']].map(([name,score])=>(
                    <div key={name} className="dash-mock-resort-row">
                      <div className="dash-mock-resort-thumb" />
                      <span className="dash-mock-resort-name">{name}</span>
                      <span className="dash-mock-resort-score">{score}</span>
                    </div>
                  ))}
                </div>
                <div className="dash-mock-main">
                  <div className="dash-mock-card">
                    <div className="dash-mock-card-header">
                      <div className="dash-mock-card-logo">❄️</div>
                      <span className="dash-mock-card-title">Alta Resort</span>
                    </div>
                    <div className="dash-mock-big-score">82</div>
                    <div className="dash-mock-score-label">Great</div>
                    <div className="dash-mock-metrics">
                      {[['28 in','Conditions'],['7 mph','Wind'],['30°F','Temp'],['28 in','Base']].map(([v,k])=>(
                        <div key={k} className="dash-mock-metric"><div className="dash-mock-metric-val">{v}</div><div className="dash-mock-metric-key">{k}</div></div>
                      ))}
                    </div>
                  </div>
                  <div className="dash-mock-forecast-label">6-Day Snow Forecast</div>
                  <div className="dash-mock-forecast">
                    {[['T','🌨','8"'],['W','⛅','3"'],['Th','🌨','12"'],['F','☀️','0"'],['Sa','🌨','5"']].map(([d,ic,sn])=>(
                      <div key={d} className="dash-mock-fc"><div className="dash-mock-fc-day">{d}</div><div className="dash-mock-fc-icon">{ic}</div><div className="dash-mock-fc-snow">{sn}</div></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="floating-pill pill-1"><span>🟢</span> 34 lifts open</div>
            <div className="floating-pill pill-2"><span style={{color:'var(--blue)'}}>❄</span> 18″ in 24 hrs</div>
          </div>
        </div>
      </section>

      <main id="main-content">

        {/* ── POWDER INTELLIGENCE ── */}
        <section className="pi-section" aria-labelledby="pi-heading">
          <div style={{maxWidth:1200,margin:'0 auto',padding:'80px 28px'}}>
            <div className="feature-section-header" style={{textAlign:'center',marginBottom:48}}>
              <h2 id="pi-heading" className="feature-section-title">Powder Intelligence</h2>
              <p className="feature-section-sub">A single score that tells you where the <strong>best skiing</strong> is.</p>
            </div>
            <div className="pi-mockup-wrap">
              <div className="pi-mockup-header">
                <div className="dash-mock-logo">❄️</div>
                <span style={{fontSize:15,fontWeight:800,color:'var(--text)'}}>Alta Resort</span>
              </div>
              <div className="pi-resort-info">
                <div className="pi-score-card">
                  <div className="pi-big-score">82</div>
                  <div className="pi-score-label">Great</div>
                  <div className="pi-metrics">
                    {[['28 in','Conditions'],['7 mph','Wind'],['30° F','Temp'],['28 in','Base Depth']].map(([v,k])=>(
                      <div key={k} className="pi-metric"><div className="pi-metric-val">{v}</div><div className="pi-metric-key">{k}</div></div>
                    ))}
                  </div>
                </div>
                <div className="pi-forecast-card">
                  <div className="pi-forecast-title">6-Day Snow Forecast</div>
                  {FORECAST_DAYS.map(d=>(
                    <div key={d.day} className="pi-fc-row">
                      <span className="pi-fc-day">{d.day}</span>
                      <span className="pi-fc-icon">{d.icon}</span>
                      <div style={{marginLeft:'auto',display:'flex',alignItems:'baseline',gap:3}}>
                        <span className="pi-fc-snow">{d.snow}</span>
                        <span className="pi-fc-unit">in</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FORECAST ENGINE ── */}
        <section className="forecast-section" aria-labelledby="forecast-heading" style={{padding:'80px 0'}}>
          <div style={{maxWidth:1200,margin:'0 auto',padding:'0 28px'}}>
            <div style={{textAlign:'center',marginBottom:48}}>
              <h2 id="forecast-heading" className="feature-section-title">Forecast Engine</h2>
              <p className="feature-section-sub">See snowfall before it happens.</p>
            </div>
            <div className="forecast-mock">
              <div className="forecast-mock-header">
                <div className="dash-mock-logo">❄️</div>
                <span className="forecast-mock-title">Snowfall Forecast</span>
                <span style={{marginLeft:'auto',fontSize:12,fontWeight:700,background:'var(--blue-light)',color:'var(--blue)',padding:'3px 10px',borderRadius:100}}>Alta</span>
              </div>
              <div className="forecast-mock-days">
                {FORECAST_DAYS.map(d=>(
                  <div key={d.day} className="forecast-mock-day">
                    <div className="fmd-name">{d.day}</div>
                    <div className="fmd-icon">{d.icon}</div>
                    <div><span className="fmd-snow">{d.snow}</span><span className="fmd-unit">in</span></div>
                    <div className="fmd-prob">±{d.prob}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── TOP RESORTS ── */}
        <section className="resorts-section" aria-labelledby="resorts-heading" style={{padding:'80px 0 0'}}>
          <div className="section">
            <div className="section-header">
              <div>
                <h2 id="resorts-heading" className="section-title">Today&apos;s Top Powder</h2>
                <p className="section-sub">Live scores updated every hour — sign up to track your favorites</p>
              </div>
              <div className="filter-tabs" role="tablist" aria-label="Filter by pass type">
                {['All','Ikon','Epic','Indy'].map(tab=>(
                  <button key={tab} role="tab" aria-selected={tab==='All'} className={`filter-tab${tab==='All'?' active':''}`}>{tab}</button>
                ))}
              </div>
            </div>
            <div className="resort-grid" role="list">
              {FEATURED_RESORTS.map(r=>(
                <Link key={r.name} href="/auth/signup" className="resort-card" role="listitem"
                  aria-label={`${r.name}, ${r.state}. Score ${r.score}, ${r.label}. ${r.newSnow} inches new snow. ${r.pass} Pass.`}>
                  <div className="resort-img-wrap">
                    <img src={r.img} alt={`${r.name} mountain`} className="resort-img" loading="lazy" />
                    <div className="resort-img-overlay" aria-hidden="true" />
                    <span className={`resort-pass-badge pass-${r.pass}`}>{r.pass} Pass</span>
                  </div>
                  <div className="resort-body">
                    <div className="resort-title-row">
                      <div><div className="resort-name">{r.name}</div><div className="resort-state">{r.state}</div></div>
                      <ScoreRing score={r.score} label={r.label} />
                    </div>
                    <div className="resort-metrics">
                      <div className="metric-chip"><div className="metric-val blue-val">{r.newSnow}"</div><div className="metric-key">New Snow</div></div>
                      <div className="metric-chip"><div className="metric-val">{r.base}"</div><div className="metric-key">Base</div></div>
                      <div className="metric-chip"><div className="metric-val green-val">Open</div><div className="metric-key">Status</div></div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="see-all-wrap">
              <Link href="/auth/signup" className="btn-primary-lg">See All 500+ Mountains →</Link>
            </div>
          </div>
        </section>

        {/* ── SNOW ANALYTICS ── */}
        <section className="analytics-section" aria-labelledby="analytics-heading">
          <div className="analytics-inner">
            <div style={{textAlign:'center',marginBottom:0}}>
              <h2 id="analytics-heading" className="feature-section-title">Snow Analytics</h2>
              <p className="feature-section-sub">Follow <strong>storms</strong> and dig into the data.</p>
            </div>
            <div className="analytics-grid">
              {/* Resort comparison */}
              <div className="analytics-card">
                <div className="analytics-card-header">
                  <div className="analytics-logo">❄️</div>
                  <span className="analytics-resort-name">Alta</span>
                  <span className="analytics-date">22.03</span>
                </div>
                {[
                  {name:'Alta',     snow:28, rating:'Great', img:'https://images.unsplash.com/photo-1605540436563-5bca919ae766?w=80&q=60'},
                  {name:'Snowbird', snow:24, rating:'Great', img:'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=80&q=60'},
                  {name:'Jackson Hole',snow:20,rating:'Great',img:'https://images.unsplash.com/photo-1453872302360-eed3c5f8ff66?w=80&q=60'},
                ].map(r=>(
                  <div key={r.name} className="analytics-resort-row">
                    <img src={r.img} alt={r.name} className="analytics-resort-thumb" loading="lazy" />
                    <div className="analytics-resort-info">
                      <div className="analytics-resort-name-sm">{r.name}</div>
                      <div className="analytics-resort-rating">● {r.rating}</div>
                    </div>
                    <span className="analytics-snow-val">{r.snow}</span>
                    <span className="analytics-snow-unit">in</span>
                    <span className="analytics-badge">Good</span>
                  </div>
                ))}
              </div>

              {/* 7-day chart */}
              <div className="analytics-card">
                <div className="analytics-card-header">
                  <div className="analytics-logo">📊</div>
                  <span className="analytics-resort-name">Snowfall History</span>
                  <span style={{marginLeft:'auto',fontSize:11,color:'var(--text-3)',background:'var(--bg)',padding:'2px 8px',borderRadius:6}}>Last 7 Days ▾</span>
                </div>
                <div className="analytics-chart" aria-label="Snowfall bar chart">
                  {[18,24,8,32,12,28,20].map((h,i)=>(
                    <div key={i} className="chart-bar-wrap">
                      <div className="chart-bar" style={{height:`${(h/32)*100}%`}} title={`${h}"`} />
                      <span className="chart-label">{['M','T','W','T','F','S','S'][i]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top resorts list */}
              <div className="analytics-card">
                <div className="analytics-card-header">
                  <div className="analytics-logo">🏔️</div>
                  <span className="analytics-resort-name">Top Resorts</span>
                </div>
                {[
                  {name:'Alta',        snow:26, days:'18 days', img:'https://images.unsplash.com/photo-1605540436563-5bca919ae766?w=80&q=60'},
                  {name:'Snowbird',    snow:24, days:'14 days', img:'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=80&q=60'},
                  {name:'Jackson Hole',snow:20, days:'12 days', img:'https://images.unsplash.com/photo-1453872302360-eed3c5f8ff66?w=80&q=60'},
                  {name:'Kirkwood',    snow:18, days:'10 days', img:'https://images.unsplash.com/photo-1548777123-e216912df7d8?w=80&q=60'},
                ].map(r=>(
                  <div key={r.name} className="analytics-resort-row">
                    <img src={r.img} alt={r.name} className="analytics-resort-thumb" loading="lazy" />
                    <div className="analytics-resort-info">
                      <div className="analytics-resort-name-sm">{r.name}</div>
                      <div className="analytics-resort-rating">📅 {r.days}</div>
                    </div>
                    <span className="analytics-snow-val">{r.snow}</span>
                    <span className="analytics-snow-unit">in</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ── CTA ── */}
      <section className="cta-section" aria-labelledby="cta-heading">
        <div className="cta-inner" style={{paddingTop:80}}>
          <div className="cta-card">
            <div>
              <h2 id="cta-heading" className="cta-title">Ready to find your next powder day?</h2>
              <p className="cta-sub">Free to start. No credit card required. Works with any ski pass — or none at all.</p>
            </div>
            <Link href="/auth/signup" className="btn-white">Create Free Account</Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="footer-outer" aria-label="Site footer">
        <div className="footer">
          <div>
            <Link href="/" className="footer-logo">
              <div className="footer-logo-icon" aria-hidden="true">❄️</div>
              <div>
                <div className="footer-logo-text">PowderIQ</div>
                <div className="footer-copy">© {new Date().getFullYear()} PowderIQ. All rights reserved.</div>
              </div>
            </Link>
          </div>
          <nav className="footer-links" aria-label="Footer navigation">
            <Link href="/auth/signup" className="footer-link">Sign Up</Link>
            <Link href="/auth/login" className="footer-link">Sign In</Link>
            <Link href="/mountains" className="footer-link">Mountains</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
