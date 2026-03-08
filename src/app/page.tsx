import Link from 'next/link';

const FEATURED_RESORTS = [
  {
    name: 'Kirkwood',
    state: 'CA',
    score: 82,
    label: 'Great',
    newSnow: 32,
    base: 800,
    pass: 'Ikon',
    img: 'https://images.unsplash.com/photo-1548777123-e216912df7d8?w=600&q=80',
  },
  {
    name: 'Alta',
    state: 'UT',
    score: 91,
    label: 'Powder Star',
    newSnow: 18,
    base: 920,
    pass: 'Ikon',
    img: 'https://images.unsplash.com/photo-1605540436563-5bca919ae766?w=600&q=80',
  },
  {
    name: 'Crystal Mountain',
    state: 'WA',
    score: 74,
    label: 'Good',
    newSnow: 12,
    base: 620,
    pass: 'Ikon',
    img: 'https://images.unsplash.com/photo-1478827536114-da961b7f86d2?w=600&q=80',
  },
  {
    name: 'Mt. Bachelor',
    state: 'OR',
    score: 85,
    label: 'Great',
    newSnow: 22,
    base: 740,
    pass: 'Epic',
    img: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=80',
  },
  {
    name: 'Sugar Bowl',
    state: 'CA',
    score: 68,
    label: 'Decent',
    newSnow: 6,
    base: 490,
    pass: 'Ikon',
    img: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=80',
  },
  {
    name: 'Stevens Pass',
    state: 'WA',
    score: 77,
    label: 'Good',
    newSnow: 9,
    base: 580,
    pass: 'Ikon',
    img: 'https://images.unsplash.com/photo-1546961342-ea5f73e193f9?w=600&q=80',
  },
];

function ScorePill({ score, label }: { score: number; label: string }) {
  const color =
    score >= 85 ? '#1d6ef5' :
    score >= 70 ? '#22c55e' :
    score >= 55 ? '#f59e0b' : '#94a3b8';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: `conic-gradient(${color} ${score * 3.6}deg, #e2e8f0 0deg)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, color,
        }}>
          {score}
        </div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{label}</span>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --blue: #1d6ef5; --blue-dark: #1558d6; --blue-light: #eff5ff;
          --green: #22c55e; --amber: #f59e0b;
          --text: #0f172a; --text-2: #475569; --text-3: #94a3b8;
          --border: #e2e8f0; --bg: #f8fafc; --white: #ffffff;
          --radius: 16px; --shadow: 0 2px 16px rgba(0,0,0,0.07);
          --shadow-lg: 0 8px 40px rgba(0,0,0,0.12);
        }
        body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); }
        .skip-link {
          position: absolute; top: -100px; left: 16px; z-index: 200;
          background: var(--blue); color: #fff; padding: 10px 16px; border-radius: 8px;
          font-weight: 700; text-decoration: none;
        }
        .skip-link:focus { top: 16px; }
        .nav {
          background: rgba(255,255,255,0.92); backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 50;
        }
        .nav-inner {
          max-width: 1200px; margin: 0 auto; padding: 0 24px; height: 64px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .nav-logo {
          display: flex; align-items: center; gap: 8px;
          font-family: 'Sora', sans-serif; font-weight: 800; font-size: 20px;
          color: var(--text); text-decoration: none;
        }
        .nav-logo-icon {
          width: 34px; height: 34px; background: var(--blue); border-radius: 10px;
          display: flex; align-items: center; justify-content: center; font-size: 18px;
        }
        .nav-links { display: flex; align-items: center; gap: 8px; }
        .btn-ghost {
          padding: 8px 16px; border-radius: 10px; font-size: 14px; font-weight: 600;
          color: var(--text-2); text-decoration: none; background: transparent;
          border: none; cursor: pointer; transition: background 0.15s, color 0.15s;
        }
        .btn-ghost:hover { background: var(--blue-light); color: var(--blue); }
        .btn-ghost:focus-visible { outline: 3px solid var(--blue); outline-offset: 2px; border-radius: 10px; }
        .btn-primary {
          padding: 10px 20px; border-radius: 10px; font-size: 14px; font-weight: 700;
          color: #fff; background: var(--blue); text-decoration: none;
          box-shadow: 0 2px 8px rgba(29,110,245,0.3); transition: background 0.15s, transform 0.1s;
          border: none; cursor: pointer;
        }
        .btn-primary:hover { background: var(--blue-dark); transform: translateY(-1px); }
        .btn-primary:focus-visible { outline: 3px solid var(--blue); outline-offset: 2px; }
        .hero {
          max-width: 1200px; margin: 0 auto; padding: 72px 24px 56px;
          display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center;
        }
        @media (max-width: 800px) {
          .hero { grid-template-columns: 1fr; padding: 40px 20px; gap: 40px; }
          .hero-visual { order: -1; }
        }
        .hero-eyebrow {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--blue-light); color: var(--blue); border-radius: 100px;
          padding: 6px 14px; font-size: 13px; font-weight: 600; margin-bottom: 20px;
        }
        .hero-title {
          font-family: 'Sora', sans-serif; font-weight: 800;
          font-size: clamp(34px, 4.5vw, 54px); line-height: 1.1;
          color: var(--text); margin-bottom: 18px; letter-spacing: -0.02em;
        }
        .hero-title span { color: var(--blue); }
        .hero-sub { font-size: 17px; line-height: 1.7; color: var(--text-2); margin-bottom: 32px; max-width: 420px; }
        .hero-ctas { display: flex; gap: 12px; flex-wrap: wrap; }
        .btn-primary-lg {
          padding: 14px 28px; border-radius: 12px; font-size: 16px; font-weight: 700;
          color: #fff; background: var(--blue); text-decoration: none; display: inline-block;
          box-shadow: 0 4px 16px rgba(29,110,245,0.35); transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
        }
        .btn-primary-lg:hover { background: var(--blue-dark); transform: translateY(-2px); box-shadow: 0 6px 24px rgba(29,110,245,0.4); }
        .btn-primary-lg:focus-visible { outline: 3px solid var(--blue); outline-offset: 3px; }
        .btn-secondary-lg {
          padding: 14px 28px; border-radius: 12px; font-size: 16px; font-weight: 700;
          color: var(--text); background: var(--white); text-decoration: none;
          border: 1.5px solid var(--border); transition: border-color 0.15s, color 0.15s, transform 0.15s;
        }
        .btn-secondary-lg:hover { border-color: var(--blue); color: var(--blue); transform: translateY(-2px); }
        .btn-secondary-lg:focus-visible { outline: 3px solid var(--blue); outline-offset: 3px; }
        .hero-stats {
          display: flex; gap: 28px; margin-top: 36px; padding-top: 28px;
          border-top: 1px solid var(--border);
        }
        .hero-stat-num { font-family: 'Sora', sans-serif; font-size: 24px; font-weight: 800; color: var(--text); }
        .hero-stat-label { font-size: 12px; color: var(--text-3); margin-top: 2px; }
        .hero-visual { display: flex; justify-content: center; position: relative; }
        .score-card-mock {
          background: var(--white); border-radius: 24px; box-shadow: var(--shadow-lg);
          padding: 22px; width: 100%; max-width: 320px; border: 1px solid var(--border);
        }
        .mock-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .mock-resort-name { font-family: 'Sora', sans-serif; font-weight: 700; font-size: 17px; }
        .mock-badge { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 100px; background: #eff5ff; color: var(--blue); }
        .mock-img { width: 100%; height: 150px; border-radius: 14px; object-fit: cover; margin-bottom: 14px; display: block; }
        .mock-score-row { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
        .mock-big-score { font-family: 'Sora', sans-serif; font-size: 48px; font-weight: 800; color: var(--blue); line-height: 1; }
        .mock-score-label { font-size: 15px; font-weight: 700; color: var(--blue); margin-top: 4px; }
        .mock-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; flex: 1; }
        .mock-stat { background: var(--bg); border-radius: 9px; padding: 8px; text-align: center; }
        .mock-stat-val { font-weight: 700; font-size: 13px; color: var(--text); }
        .mock-stat-key { font-size: 10px; color: var(--text-3); margin-top: 1px; }
        .mock-forecast { display: flex; gap: 5px; margin-top: 12px; }
        .mock-fc-day { flex: 1; background: var(--bg); border-radius: 9px; padding: 7px 3px; text-align: center; }
        .mock-fc-day-name { font-size: 9px; color: var(--text-3); margin-bottom: 3px; }
        .mock-fc-icon { font-size: 14px; }
        .mock-fc-snow { font-size: 10px; font-weight: 700; color: var(--blue); margin-top: 2px; }
        .floating-pill {
          position: absolute; background: var(--white); border-radius: 100px;
          padding: 7px 13px; box-shadow: var(--shadow-lg); border: 1px solid var(--border);
          display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600;
          animation: float 3s ease-in-out infinite; white-space: nowrap;
        }
        .floating-pill-1 { top: -12px; right: -8px; color: var(--green); animation-delay: 0s; }
        .floating-pill-2 { bottom: 20px; left: -16px; color: var(--blue); animation-delay: 1.5s; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        .section { max-width: 1200px; margin: 0 auto; padding: 0 24px 72px; }
        .section-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 28px; flex-wrap: wrap; gap: 16px; }
        .section-title { font-family: 'Sora', sans-serif; font-weight: 800; font-size: 26px; color: var(--text); }
        .section-sub { font-size: 14px; color: var(--text-3); margin-top: 3px; }
        .filter-tabs { display: flex; gap: 4px; background: var(--white); padding: 4px; border-radius: 12px; border: 1px solid var(--border); }
        .filter-tab {
          padding: 7px 16px; border-radius: 9px; font-size: 13px; font-weight: 600;
          color: var(--text-2); cursor: pointer; border: none; background: transparent; transition: background 0.15s, color 0.15s;
        }
        .filter-tab.active { background: var(--blue); color: #fff; }
        .filter-tab:focus-visible { outline: 3px solid var(--blue); outline-offset: 2px; }
        .resort-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 18px; }
        .resort-card {
          background: var(--white); border-radius: var(--radius); overflow: hidden;
          border: 1px solid var(--border); box-shadow: var(--shadow);
          transition: transform 0.2s, box-shadow 0.2s; text-decoration: none; color: inherit;
          display: flex; flex-direction: column;
        }
        .resort-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
        .resort-card:focus-visible { outline: 3px solid var(--blue); outline-offset: 3px; }
        .resort-img-wrap { position: relative; }
        .resort-img { width: 100%; height: 175px; object-fit: cover; display: block; background: linear-gradient(135deg,#bfdbfe,#93c5fd); }
        .resort-pass-badge {
          position: absolute; top: 10px; right: 10px; font-size: 11px; font-weight: 700;
          padding: 4px 10px; border-radius: 100px; backdrop-filter: blur(8px);
        }
        .pass-Ikon { background: rgba(255,255,255,0.9); color: #1d6ef5; }
        .pass-Epic { background: rgba(0,0,0,0.55); color: #fff; }
        .pass-Indy { background: rgba(255,255,255,0.85); color: #475569; }
        .resort-body { padding: 15px; flex: 1; display: flex; flex-direction: column; gap: 11px; }
        .resort-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
        .resort-name { font-family: 'Sora', sans-serif; font-weight: 700; font-size: 15px; color: var(--text); }
        .resort-state { font-size: 12px; color: var(--text-3); margin-top: 2px; }
        .resort-metrics { display: flex; gap: 7px; }
        .metric-chip { flex: 1; background: var(--bg); border-radius: 9px; padding: 8px; text-align: center; border: 1px solid var(--border); }
        .metric-val { font-weight: 700; font-size: 13px; color: var(--text); }
        .metric-key { font-size: 10px; color: var(--text-3); margin-top: 1px; }
        .metric-val.blue { color: var(--blue); }
        .metric-val.green { color: var(--green); }
        .features-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 18px; }
        .feature-card { background: var(--white); border: 1px solid var(--border); border-radius: var(--radius); padding: 26px; box-shadow: var(--shadow); }
        .feature-icon { width: 46px; height: 46px; border-radius: 13px; background: var(--blue-light); display: flex; align-items: center; justify-content: center; font-size: 21px; margin-bottom: 14px; }
        .feature-title { font-family: 'Sora', sans-serif; font-weight: 700; font-size: 15px; margin-bottom: 7px; }
        .feature-desc { font-size: 13px; line-height: 1.6; color: var(--text-2); }
        .cta-band {
          background: var(--blue); border-radius: 24px; padding: 52px 48px;
          margin: 0 24px 72px; max-width: 1152px; margin-left: auto; margin-right: auto;
          display: flex; align-items: center; justify-content: space-between; gap: 28px; flex-wrap: wrap;
          background-image: radial-gradient(circle at 80% 50%, rgba(255,255,255,0.08) 0%, transparent 60%);
        }
        .cta-title { font-family: 'Sora', sans-serif; font-weight: 800; font-size: 28px; color: #fff; margin-bottom: 8px; }
        .cta-sub { font-size: 15px; color: rgba(255,255,255,0.75); max-width: 420px; line-height: 1.6; }
        .btn-white {
          padding: 14px 28px; border-radius: 12px; font-size: 16px; font-weight: 700;
          color: var(--blue); background: #fff; text-decoration: none; white-space: nowrap;
          box-shadow: 0 4px 16px rgba(0,0,0,0.15); transition: transform 0.15s, box-shadow 0.15s;
        }
        .btn-white:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(0,0,0,0.2); }
        .btn-white:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
        .footer-outer { border-top: 1px solid var(--border); }
        .footer { max-width: 1200px; margin: 0 auto; padding: 28px 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
        .footer-logo { font-family: 'Sora', sans-serif; font-weight: 700; font-size: 15px; color: var(--text); display: flex; align-items: center; gap: 7px; }
        .footer-copy { font-size: 12px; color: var(--text-3); margin-top: 3px; }
        .footer-links { display: flex; gap: 20px; }
        .footer-link { font-size: 13px; color: var(--text-2); text-decoration: none; font-weight: 500; }
        .footer-link:hover { color: var(--blue); }
        .footer-link:focus-visible { outline: 3px solid var(--blue); outline-offset: 2px; border-radius: 4px; }
        @media (max-width: 600px) {
          .cta-band { padding: 32px 20px; }
          .hero-stats { gap: 18px; }
          .section-header { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <a href="#main-content" className="skip-link">Skip to main content</a>

      <div>
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
              <div className="hero-eyebrow" aria-hidden="true">
                <span>❄️</span> Real-time powder intelligence
              </div>
              <h1 id="hero-heading" className="hero-title">
                Know before you go.<br /><span>Score the powder.</span>
              </h1>
              <p className="hero-sub">
                PowderIQ turns snowfall, wind, and resort data into one smart score —
                so you always know which mountain is worth the drive. Works with Ikon, Epic, Indy, or no pass at all.
              </p>
              <div className="hero-ctas">
                <Link href="/auth/signup" className="btn-primary-lg">Start Free Today</Link>
                <Link href="/auth/login" className="btn-secondary-lg">Sign In</Link>
              </div>
              <div className="hero-stats" aria-label="Key statistics">
                <div>
                  <div className="hero-stat-num">500+</div>
                  <div className="hero-stat-label">Resorts tracked</div>
                </div>
                <div>
                  <div className="hero-stat-num">Hourly</div>
                  <div className="hero-stat-label">Score updates</div>
                </div>
                <div>
                  <div className="hero-stat-num">Free</div>
                  <div className="hero-stat-label">To get started</div>
                </div>
              </div>
            </div>

            <div className="hero-visual" aria-hidden="true">
              <div className="score-card-mock">
                <div className="mock-header">
                  <div className="mock-resort-name">Alta, UT</div>
                  <div className="mock-badge">Ikon Pass</div>
                </div>
                <img className="mock-img" src="https://images.unsplash.com/photo-1605540436563-5bca919ae766?w=600&q=80" alt="" />
                <div className="mock-score-row">
                  <div>
                    <div className="mock-big-score">91</div>
                    <div className="mock-score-label">⭐ Powder Star</div>
                  </div>
                  <div className="mock-stats">
                    {[['18"','New Snow'],['920"','Base'],['12mph','Wind']].map(([v,k]) => (
                      <div key={k} className="mock-stat">
                        <div className="mock-stat-val">{v}</div>
                        <div className="mock-stat-key">{k}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mock-forecast">
                  {[['Today','🌨','4"'],['Tue','⛅','1"'],['Wed','🌨','6"'],['Thu','☀️','0"'],['Fri','🌨','3"']].map(([d,icon,snow]) => (
                    <div key={d} className="mock-fc-day">
                      <div className="mock-fc-day-name">{d}</div>
                      <div className="mock-fc-icon">{icon}</div>
                      <div className="mock-fc-snow">{snow}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="floating-pill floating-pill-1"><span>🟢</span> 34 lifts open</div>
              <div className="floating-pill floating-pill-2"><span>❄️</span> 18" in 24 hrs</div>
            </div>
          </div>
        </section>

        {/* FEATURED RESORTS */}
        <main id="main-content">
          <section className="section" aria-labelledby="resorts-heading">
            <div className="section-header">
              <div>
                <h2 id="resorts-heading" className="section-title">Today&apos;s Top Powder</h2>
                <p className="section-sub">Live scores updated every hour — sign up to track your favorites</p>
              </div>
              <div className="filter-tabs" role="tablist" aria-label="Filter by pass type">
                {['All','Ikon','Epic','Indy'].map(tab => (
                  <button key={tab} role="tab" aria-selected={tab === 'All'} className={`filter-tab${tab === 'All' ? ' active' : ''}`}>
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            <div className="resort-grid" role="list">
              {FEATURED_RESORTS.map(r => (
                <Link
                  key={r.name}
                  href="/auth/signup"
                  className="resort-card"
                  role="listitem"
                  aria-label={`${r.name}, ${r.state}. Score: ${r.score} — ${r.label}. ${r.newSnow} inches new snow. ${r.pass} Pass.`}
                >
                  <div className="resort-img-wrap">
                    <img src={r.img} alt={`${r.name} mountain view`} className="resort-img" loading="lazy" />
                    <span className={`resort-pass-badge pass-${r.pass}`}>{r.pass} Pass</span>
                  </div>
                  <div className="resort-body">
                    <div className="resort-title-row">
                      <div>
                        <div className="resort-name">{r.name}</div>
                        <div className="resort-state">{r.state}</div>
                      </div>
                      <ScorePill score={r.score} label={r.label} />
                    </div>
                    <div className="resort-metrics">
                      <div className="metric-chip">
                        <div className="metric-val blue">{r.newSnow}"</div>
                        <div className="metric-key">New Snow</div>
                      </div>
                      <div className="metric-chip">
                        <div className="metric-val">{r.base}"</div>
                        <div className="metric-key">Base</div>
                      </div>
                      <div className="metric-chip">
                        <div className="metric-val green">Open</div>
                        <div className="metric-key">Status</div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div style={{textAlign:'center',marginTop:32}}>
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
                {icon:'🏔️',title:'Powder Score',desc:'A single 0–100 score built from snowfall, wind, base depth, temperature, and visibility — updated hourly.'},
                {icon:'📊',title:'Mountain Compare',desc:'Side-by-side comparison of any two resorts. See exactly which mountain wins the day before you go.'},
                {icon:'🔔',title:'Powder Alerts',desc:'Set your threshold and get notified the moment your favorite mountain hits the mark.'},
                {icon:'🗺️',title:'Live Trail Map',desc:'Live lift status, trail conditions, and grooming reports all in one place before you leave the house.'},
                {icon:'📅',title:'6-Day Forecast',desc:'Extended snow forecasts so you can plan your trip days in advance with real confidence.'},
                {icon:'⭐',title:'Favorites',desc:'Save your go-to mountains and see all their scores at a glance every time you open PowderIQ.'},
              ].map(f => (
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
        <section aria-labelledby="cta-heading">
          <div className="cta-band">
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
              <div className="footer-logo"><span aria-hidden="true">❄️</span> PowderIQ</div>
              <div className="footer-copy">© {new Date().getFullYear()} PowderIQ. All rights reserved.</div>
            </div>
            <nav className="footer-links" aria-label="Footer navigation">
              <Link href="/auth/signup" className="footer-link">Sign Up</Link>
              <Link href="/auth/login" className="footer-link">Sign In</Link>
              <Link href="/mountains" className="footer-link">Mountains</Link>
            </nav>
          </div>
        </footer>
      </div>
    </>
  );
}
