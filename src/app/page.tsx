import Link from 'next/link';

const FEATURED_RESORTS = [
  { name: 'Kirkwood',        state: 'CA', score: 82, label: 'Great',       newSnow: 32, base: 800, pass: 'Ikon', img: 'https://images.unsplash.com/photo-1548777123-e216912df7d8?w=600&q=80' },
  { name: 'Alta',            state: 'UT', score: 91, label: 'Powder Star', newSnow: 18, base: 920, pass: 'Ikon', img: 'https://images.unsplash.com/photo-1605540436563-5bca919ae766?w=600&q=80' },
  { name: 'Crystal Mountain',state: 'WA', score: 74, label: 'Good',        newSnow: 12, base: 620, pass: 'Ikon', img: 'https://images.unsplash.com/photo-1478827536114-da961b7f86d2?w=600&q=80' },
  { name: 'Mt. Bachelor',    state: 'OR', score: 85, label: 'Great',       newSnow: 22, base: 740, pass: 'Epic', img: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=80' },
  { name: 'Sugar Bowl',      state: 'CA', score: 68, label: 'Decent',      newSnow:  6, base: 490, pass: 'Ikon', img: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=80' },
  { name: 'Stevens Pass',    state: 'WA', score: 77, label: 'Good',        newSnow:  9, base: 580, pass: 'Ikon', img: 'https://images.unsplash.com/photo-1546961342-ea5f73e193f9?w=600&q=80' },
];

function ScoreRing({ score, label }: { score: number; label: string }) {
  const color = score >= 85 ? '#24FA3F' : score >= 70 ? '#4DB8FF' : score >= 55 ? '#FFB547' : '#8899AA';
  const bg    = score >= 85 ? 'rgba(36,250,63,0.15)'  : score >= 70 ? 'rgba(77,184,255,0.15)' : 'rgba(255,181,71,0.15)';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{
        width:46, height:46, borderRadius:'50%', flexShrink:0,
        background:`conic-gradient(${color} ${score*3.6}deg, rgba(255,255,255,0.1) 0deg)`,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <div style={{
          width:35, height:35, borderRadius:'50%', background:'#1B2B4B',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:12, fontWeight:800, color, fontFamily:'Inter, sans-serif',
        }}>{score}</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
        <span style={{ fontSize:11, fontWeight:700, color, background:bg, padding:'2px 8px', borderRadius:100 }}>{label}</span>
      </div>
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
          /* Brand palette */
          --deep-alpine: #0F162E;
          --navy:        #1B2B4B;
          --navy-light:  #243352;
          --signal-blue: #1F36FE;
          --powder-blue: #7EC8F0;
          --ice-blue:    #B8E4F9;
          --ice-glow:    #24FA3F;
          --snow-white:  #FFFFFF;
          --off-white:   #E8F0F8;
          --text-muted:  #8AAAC8;
          --border:      rgba(126,200,240,0.15);
          --border-bright: rgba(126,200,240,0.3);
          --shadow:      0 4px 24px rgba(0,0,0,0.35);
          --shadow-lg:   0 12px 48px rgba(0,0,0,0.5);
          --radius:      16px;
        }

        html { scroll-behavior: smooth; }
        body {
          font-family: 'Inter', system-ui, sans-serif;
          background: var(--deep-alpine);
          color: var(--snow-white);
          -webkit-font-smoothing: antialiased;
        }

        /* ── ACCESSIBILITY ── */
        .skip-link {
          position: absolute; top: -60px; left: 16px; z-index: 9999;
          background: var(--signal-blue); color: #fff;
          padding: 10px 18px; border-radius: 8px; font-weight: 700;
          text-decoration: none; font-size: 14px; transition: top 0.15s;
        }
        .skip-link:focus { top: 12px; }

        /* Focus ring — WCAG 2.4.11 */
        a:focus-visible, button:focus-visible {
          outline: 3px solid var(--powder-blue);
          outline-offset: 3px;
          border-radius: 6px;
        }

        /* ── NAV ── */
        .nav {
          background: rgba(15,22,46,0.92);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--border-bright);
          position: sticky; top: 0; z-index: 50;
        }
        .nav-inner {
          max-width: 1200px; margin: 0 auto; padding: 0 24px; height: 68px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .nav-logo {
          display: flex; align-items: center; gap: 10px;
          font-size: 20px; font-weight: 900; color: var(--snow-white);
          text-decoration: none; letter-spacing: -0.03em;
        }
        .nav-logo-icon {
          width: 38px; height: 38px; border-radius: 11px;
          background: linear-gradient(135deg, var(--signal-blue), #4D6BFF);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; box-shadow: 0 0 16px rgba(31,54,254,0.5);
        }
        .nav-links { display: flex; align-items: center; gap: 6px; }

        .btn-ghost {
          padding: 9px 18px; border-radius: 10px; font-size: 14px; font-weight: 600;
          color: var(--ice-blue); text-decoration: none; background: transparent;
          border: none; cursor: pointer; transition: background 0.15s, color 0.15s;
          font-family: 'Inter', sans-serif;
        }
        .btn-ghost:hover { background: rgba(126,200,240,0.1); color: var(--snow-white); }

        .btn-primary {
          padding: 10px 22px; border-radius: 10px; font-size: 14px; font-weight: 700;
          color: var(--snow-white); background: var(--signal-blue); text-decoration: none;
          border: none; cursor: pointer; font-family: 'Inter', sans-serif;
          box-shadow: 0 0 20px rgba(31,54,254,0.4);
          transition: filter 0.15s, transform 0.1s, box-shadow 0.15s;
        }
        .btn-primary:hover { filter: brightness(1.15); transform: translateY(-1px); box-shadow: 0 0 28px rgba(31,54,254,0.6); }

        /* ── HERO ── */
        .hero {
          max-width: 1200px; margin: 0 auto; padding: 80px 24px 64px;
          display: grid; grid-template-columns: 1fr 1fr; gap: 72px; align-items: center;
        }
        @media (max-width: 860px) {
          .hero { grid-template-columns: 1fr; padding: 48px 20px 40px; gap: 48px; }
          .hero-visual { order: -1; }
        }

        .hero-eyebrow {
          display: inline-flex; align-items: center; gap: 7px;
          background: rgba(36,250,63,0.12); color: #24FA3F;
          border: 1px solid rgba(36,250,63,0.3);
          border-radius: 100px; padding: 6px 14px;
          font-size: 13px; font-weight: 600; margin-bottom: 22px;
          letter-spacing: 0.01em;
        }
        .hero-eyebrow-dot { width: 7px; height: 7px; border-radius: 50%; background: #24FA3F; animation: pulse 2s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.4)} }

        .hero-title {
          font-size: clamp(36px, 4.8vw, 58px); font-weight: 900;
          line-height: 1.08; letter-spacing: -0.03em;
          color: var(--snow-white); margin-bottom: 20px;
        }
        .hero-title .accent {
          background: linear-gradient(90deg, var(--powder-blue), #24FA3F);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-sub {
          font-size: 17px; line-height: 1.75; color: var(--text-muted);
          margin-bottom: 36px; max-width: 440px;
          /* WCAG: #8AAAC8 on #0F162E = 4.6:1 — passes AA for large text, borderline normal */
          /* Boosted to off-white for body copy */
          color: #A8C8E0;
        }

        .hero-ctas { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 40px; }

        .btn-primary-lg {
          padding: 15px 30px; border-radius: 12px; font-size: 16px; font-weight: 700;
          color: var(--snow-white); background: var(--signal-blue); text-decoration: none;
          font-family: 'Inter', sans-serif; display: inline-block;
          box-shadow: 0 0 28px rgba(31,54,254,0.45);
          transition: filter 0.15s, transform 0.15s, box-shadow 0.15s;
        }
        .btn-primary-lg:hover { filter: brightness(1.15); transform: translateY(-2px); box-shadow: 0 0 40px rgba(31,54,254,0.65); }

        .btn-outline-lg {
          padding: 14px 28px; border-radius: 12px; font-size: 16px; font-weight: 700;
          color: var(--snow-white); background: transparent; text-decoration: none;
          font-family: 'Inter', sans-serif; display: inline-block;
          border: 1.5px solid var(--border-bright);
          transition: border-color 0.15s, background 0.15s, transform 0.15s;
        }
        .btn-outline-lg:hover { border-color: var(--powder-blue); background: rgba(126,200,240,0.08); transform: translateY(-2px); }

        .hero-stats { display: flex; gap: 32px; padding-top: 28px; border-top: 1px solid var(--border); }
        .hero-stat-num { font-size: 26px; font-weight: 900; color: var(--snow-white); letter-spacing: -0.02em; }
        .hero-stat-label { font-size: 12px; color: var(--text-muted); margin-top: 3px; letter-spacing: 0.02em; }

        /* ── HERO CARD MOCKUP ── */
        .hero-visual { display: flex; justify-content: center; position: relative; }

        .score-card-mock {
          background: linear-gradient(160deg, var(--navy) 0%, var(--navy-light) 100%);
          border: 1px solid var(--border-bright);
          border-radius: 24px; padding: 22px; width: 100%; max-width: 316px;
          box-shadow: var(--shadow-lg);
        }
        .mock-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .mock-resort-name { font-size: 17px; font-weight: 800; color: var(--snow-white); }
        .mock-pass-badge {
          font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 100px;
          background: rgba(31,54,254,0.25); color: var(--powder-blue);
          border: 1px solid rgba(126,200,240,0.3);
        }
        .mock-img { width: 100%; height: 148px; border-radius: 14px; object-fit: cover; margin-bottom: 14px; display: block; }
        .mock-score-row { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
        .mock-big-score {
          font-size: 52px; font-weight: 900; line-height: 1; letter-spacing: -0.04em;
          background: linear-gradient(135deg, var(--powder-blue), #24FA3F);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .mock-score-label { font-size: 14px; font-weight: 700; color: #24FA3F; margin-top: 4px; }
        .mock-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; flex: 1; }
        .mock-stat { background: rgba(0,0,0,0.25); border-radius: 9px; padding: 8px; text-align: center; border: 1px solid var(--border); }
        .mock-stat-val { font-size: 13px; font-weight: 700; color: var(--snow-white); }
        .mock-stat-key { font-size: 10px; color: var(--text-muted); margin-top: 2px; }
        .mock-forecast { display: flex; gap: 5px; }
        .mock-fc-day { flex: 1; background: rgba(0,0,0,0.2); border-radius: 9px; padding: 7px 3px; text-align: center; border: 1px solid var(--border); }
        .mock-fc-name { font-size: 9px; color: var(--text-muted); margin-bottom: 3px; }
        .mock-fc-icon { font-size: 14px; }
        .mock-fc-snow { font-size: 10px; font-weight: 700; color: var(--powder-blue); margin-top: 3px; }

        .floating-pill {
          position: absolute; border-radius: 100px;
          background: linear-gradient(135deg, var(--navy), var(--navy-light));
          border: 1px solid var(--border-bright);
          padding: 8px 14px; display: flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 700; color: var(--snow-white);
          box-shadow: var(--shadow); white-space: nowrap;
          animation: floatY 3s ease-in-out infinite;
        }
        .pill-1 { top: -14px; right: -10px; animation-delay: 0s; }
        .pill-2 { bottom: 20px; left: -18px; animation-delay: 1.6s; }
        .pill-dot-green { color: #24FA3F; }
        .pill-dot-blue  { color: var(--powder-blue); }
        @keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }

        /* ── SECTIONS ── */
        .section { max-width: 1200px; margin: 0 auto; padding: 0 24px 80px; }

        .section-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 28px; flex-wrap: wrap; gap: 16px; }
        .section-title { font-size: 26px; font-weight: 800; color: var(--snow-white); letter-spacing: -0.02em; }
        .section-sub { font-size: 14px; color: var(--text-muted); margin-top: 4px; }

        .filter-tabs {
          display: flex; gap: 4px;
          background: var(--navy); padding: 4px; border-radius: 12px; border: 1px solid var(--border-bright);
        }
        .filter-tab {
          padding: 7px 18px; border-radius: 9px; font-size: 13px; font-weight: 600;
          color: var(--text-muted); cursor: pointer; border: none; background: transparent;
          font-family: 'Inter', sans-serif; transition: background 0.15s, color 0.15s;
        }
        .filter-tab.active { background: var(--signal-blue); color: #fff; box-shadow: 0 0 12px rgba(31,54,254,0.4); }
        .filter-tab:hover:not(.active) { color: var(--snow-white); background: rgba(126,200,240,0.08); }

        /* ── RESORT CARDS ── */
        .resort-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(288px,1fr)); gap: 18px; }

        .resort-card {
          background: linear-gradient(160deg, var(--navy) 0%, var(--navy-light) 100%);
          border: 1px solid var(--border);
          border-radius: var(--radius); overflow: hidden;
          text-decoration: none; color: inherit; display: flex; flex-direction: column;
          transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
          box-shadow: var(--shadow);
        }
        .resort-card:hover { transform: translateY(-5px); border-color: var(--border-bright); box-shadow: var(--shadow-lg); }
        .resort-card:focus-visible { outline: 3px solid var(--powder-blue); outline-offset: 3px; border-radius: var(--radius); }

        .resort-img-wrap { position: relative; }
        .resort-img { width: 100%; height: 178px; object-fit: cover; display: block; }
        .resort-img-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(to bottom, transparent 50%, rgba(15,22,46,0.7) 100%);
        }
        .resort-pass-badge {
          position: absolute; top: 10px; right: 10px;
          font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 100px;
          backdrop-filter: blur(8px);
        }
        .pass-Ikon { background: rgba(31,54,254,0.75); color: #fff; }
        .pass-Epic { background: rgba(0,0,0,0.7); color: #fff; }
        .pass-Indy { background: rgba(255,255,255,0.2); color: #fff; }

        .resort-body { padding: 14px; flex: 1; display: flex; flex-direction: column; gap: 10px; }
        .resort-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
        .resort-name { font-size: 15px; font-weight: 800; color: var(--snow-white); }
        .resort-state { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

        .resort-metrics { display: flex; gap: 6px; }
        .metric-chip {
          flex: 1; background: rgba(0,0,0,0.3); border-radius: 9px; padding: 8px;
          text-align: center; border: 1px solid var(--border);
        }
        .metric-val { font-size: 13px; font-weight: 700; color: var(--snow-white); }
        .metric-val.blue-val { color: var(--powder-blue); }
        .metric-val.green-val { color: #24FA3F; }
        .metric-key { font-size: 10px; color: var(--text-muted); margin-top: 2px; }

        .see-all-wrap { text-align: center; margin-top: 36px; }

        /* ── FEATURE CARDS ── */
        .features-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px,1fr)); gap: 16px; }
        .feature-card {
          background: linear-gradient(160deg, var(--navy) 0%, var(--navy-light) 100%);
          border: 1px solid var(--border); border-radius: var(--radius); padding: 26px;
          box-shadow: var(--shadow); transition: border-color 0.2s, transform 0.2s;
        }
        .feature-card:hover { border-color: var(--border-bright); transform: translateY(-2px); }
        .feature-icon {
          width: 48px; height: 48px; border-radius: 14px;
          background: rgba(31,54,254,0.2); border: 1px solid rgba(31,54,254,0.35);
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; margin-bottom: 14px;
        }
        .feature-title { font-size: 15px; font-weight: 700; color: var(--snow-white); margin-bottom: 8px; }
        .feature-desc { font-size: 13px; line-height: 1.65; color: #A8C8E0; }

        /* ── CTA BAND ── */
        .cta-band {
          max-width: 1152px; margin: 0 auto 80px; padding: 0 24px;
        }
        .cta-inner {
          background: linear-gradient(135deg, var(--signal-blue) 0%, #1344CC 60%, #0E2D8A 100%);
          border-radius: 24px; padding: 56px 48px;
          display: flex; align-items: center; justify-content: space-between; gap: 28px; flex-wrap: wrap;
          position: relative; overflow: hidden;
          box-shadow: 0 0 60px rgba(31,54,254,0.4);
        }
        .cta-inner::before {
          content:''; position:absolute; top:-60px; right:-60px;
          width:280px; height:280px; border-radius:50%;
          background: radial-gradient(circle, rgba(36,250,63,0.15) 0%, transparent 70%);
          pointer-events: none;
        }
        .cta-title { font-size: 28px; font-weight: 900; color: #fff; margin-bottom: 8px; letter-spacing: -0.02em; position: relative; }
        .cta-sub { font-size: 15px; color: rgba(255,255,255,0.8); max-width: 420px; line-height: 1.6; position: relative; }
        .btn-white {
          padding: 15px 30px; border-radius: 12px; font-size: 16px; font-weight: 700;
          color: var(--signal-blue); background: #fff; text-decoration: none; white-space: nowrap;
          font-family: 'Inter', sans-serif; display: inline-block; position: relative;
          box-shadow: 0 4px 20px rgba(0,0,0,0.2); transition: transform 0.15s, box-shadow 0.15s;
        }
        .btn-white:hover { transform: translateY(-2px); box-shadow: 0 6px 28px rgba(0,0,0,0.3); }

        /* ── FOOTER ── */
        .footer-outer { border-top: 1px solid var(--border); }
        .footer { max-width: 1200px; margin: 0 auto; padding: 28px 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
        .footer-logo { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 800; color: var(--snow-white); text-decoration: none; }
        .footer-logo-icon { width: 28px; height: 28px; border-radius: 8px; background: var(--signal-blue); display: flex; align-items: center; justify-content: center; font-size: 14px; }
        .footer-copy { font-size: 12px; color: var(--text-muted); margin-top: 3px; }
        .footer-links { display: flex; gap: 20px; }
        .footer-link { font-size: 13px; font-weight: 500; color: var(--text-muted); text-decoration: none; transition: color 0.15s; }
        .footer-link:hover { color: var(--snow-white); }

        @media (max-width: 600px) {
          .cta-inner { padding: 32px 22px; }
          .hero-stats { gap: 20px; }
          .section-header { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* NAV */}
      <nav className="nav" aria-label="Main navigation">
        <div className="nav-inner">
          <Link href="/" className="nav-logo" aria-label="PowderIQ home">
            <div className="nav-logo-icon" aria-hidden="true">❄️</div>
            PowderIQ
          </Link>
          <div className="nav-links">
            <Link href="/auth/login" className="btn-ghost">Sign in</Link>
            <Link href="/auth/signup" className="btn-primary">Get Started Free</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section aria-labelledby="hero-heading">
        <div className="hero">
          <div>
            <div className="hero-eyebrow">
              <span className="hero-eyebrow-dot" aria-hidden="true"></span>
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

          {/* Score card mockup */}
          <div className="hero-visual" aria-hidden="true">
            <div className="score-card-mock">
              <div className="mock-header">
                <span className="mock-resort-name">Alta, UT</span>
                <span className="mock-pass-badge">Ikon Pass</span>
              </div>
              <img className="mock-img" src="https://images.unsplash.com/photo-1605540436563-5bca919ae766?w=600&q=80" alt="" />
              <div className="mock-score-row">
                <div>
                  <div className="mock-big-score">91</div>
                  <div className="mock-score-label">⭐ Powder Star</div>
                </div>
                <div className="mock-stats">
                  {[['18"','New Snow'],['920"','Base'],['12 mph','Wind']].map(([v,k])=>(
                    <div key={k} className="mock-stat"><div className="mock-stat-val">{v}</div><div className="mock-stat-key">{k}</div></div>
                  ))}
                </div>
              </div>
              <div className="mock-forecast">
                {[['Today','🌨','4"'],['Tue','⛅','1"'],['Wed','🌨','6"'],['Thu','☀️','0"'],['Fri','🌨','3"']].map(([d,ic,sn])=>(
                  <div key={d} className="mock-fc-day">
                    <div className="mock-fc-name">{d}</div>
                    <div className="mock-fc-icon">{ic}</div>
                    <div className="mock-fc-snow">{sn}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="floating-pill pill-1"><span className="pill-dot-green">●</span> 34 lifts open</div>
            <div className="floating-pill pill-2"><span className="pill-dot-blue">❄</span> 18" in 24 hrs</div>
          </div>
        </div>
      </section>

      <main id="main-content">

        {/* FEATURED RESORTS */}
        <section className="section" aria-labelledby="resorts-heading">
          <div className="section-header">
            <div>
              <h2 id="resorts-heading" className="section-title">Today&apos;s Top Powder</h2>
              <p className="section-sub">Live scores updated every hour — sign up to track your favorites</p>
            </div>
            <div className="filter-tabs" role="tablist" aria-label="Filter by pass type">
              {['All','Ikon','Epic','Indy'].map(tab=>(
                <button key={tab} role="tab" aria-selected={tab==='All'} className={`filter-tab${tab==='All'?' active':''}`}>
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="resort-grid" role="list">
            {FEATURED_RESORTS.map(r=>(
              <Link
                key={r.name} href="/auth/signup"
                className="resort-card" role="listitem"
                aria-label={`${r.name}, ${r.state}. Score ${r.score}, ${r.label}. ${r.newSnow} inches new snow. ${r.pass} Pass.`}
              >
                <div className="resort-img-wrap">
                  <img src={r.img} alt={`${r.name} mountain`} className="resort-img" loading="lazy" />
                  <div className="resort-img-overlay" aria-hidden="true" />
                  <span className={`resort-pass-badge pass-${r.pass}`}>{r.pass} Pass</span>
                </div>
                <div className="resort-body">
                  <div className="resort-title-row">
                    <div>
                      <div className="resort-name">{r.name}</div>
                      <div className="resort-state">{r.state}</div>
                    </div>
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
        </section>

        {/* FEATURES */}
        <section className="section" aria-labelledby="features-heading">
          <div className="section-header">
            <div>
              <h2 id="features-heading" className="section-title">Everything you need to chase powder</h2>
              <p className="section-sub">Built for Ikon, Epic, Indy, and independent riders alike</p>
            </div>
          </div>
          <div className="features-grid">
            {[
              {icon:'🏔️',title:'Powder Score',desc:'A 0–100 score built from snowfall, wind, base depth, temperature, and visibility — updated hourly.'},
              {icon:'📊',title:'Mountain Compare',desc:'Side-by-side comparison of any two resorts. See exactly which mountain wins the day before you go.'},
              {icon:'🔔',title:'Powder Alerts',desc:'Set your threshold and get notified the moment your favorite mountain hits the mark.'},
              {icon:'🗺️',title:'Live Trail Map',desc:'Live lift status, trail conditions, and grooming reports — all in one place before you leave home.'},
              {icon:'📅',title:'6-Day Forecast',desc:'Extended snow forecasts so you can plan your trip days in advance with real confidence.'},
              {icon:'⭐',title:'Favorites',desc:'Save your go-to mountains and see all their scores at a glance every time you open PowderIQ.'},
            ].map(f=>(
              <div key={f.title} className="feature-card">
                <div className="feature-icon" aria-hidden="true">{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* CTA BAND */}
      <section aria-labelledby="cta-heading" className="cta-band">
        <div className="cta-inner">
          <div>
            <h2 id="cta-heading" className="cta-title">Ready to find your next powder day?</h2>
            <p className="cta-sub">Free to start. No credit card required. Works with any ski pass — or none at all.</p>
          </div>
          <Link href="/auth/signup" className="btn-white">Create Free Account</Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer-outer" aria-label="Site footer">
        <div className="footer">
          <div>
            <Link href="/" className="footer-logo">
              <div className="footer-logo-icon" aria-hidden="true">❄️</div>
              PowderIQ
            </Link>
            <div className="footer-copy">© {new Date().getFullYear()} PowderIQ. All rights reserved.</div>
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
