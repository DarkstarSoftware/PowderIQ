'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { loadStripe } from '@stripe/stripe-js';
import { PRICES } from '@/lib/stripePrices';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface UserData {
  id: string; email: string; role: string;
  profile?: { displayName?: string; style?: string; skillLevel?: string };
}
interface Favorite {
  id: string; score?: number;
  mountain: { id: string; name: string; imageUrl?: string };
}

export default function AccountPage() {
  const router = useRouter();
  const [user,          setUser]          = useState<UserData | null>(null);
  const [favorites,     setFavorites]     = useState<Favorite[]>([]);
  const [token,         setToken]         = useState('');
  const [userRole,      setUserRole]      = useState('');
  const [userEmail,     setUserEmail]     = useState('');
  const [billingLoading,setBilling]       = useState(false);
  const [billing,       setBillingCycle]  = useState<'monthly' | 'yearly'>('monthly');
  const [portalLoading, setPortalLoading] = useState(false);
  const [exporting,     setExporting]     = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [upgraded,      setUpgraded]      = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push('/auth/login'); return; }
      const t = data.session.access_token;
      setToken(t);
      setUserEmail(data.session.user?.email || '');

      const [meRes, favsRes] = await Promise.all([
        fetch('/api/me',        { headers: { Authorization: `Bearer ${t}` } }),
        fetch('/api/favorites', { headers: { Authorization: `Bearer ${t}` } }),
      ]);
      if (meRes.ok) {
        const me = await meRes.json();
        setUser(me.data);
        setUserRole(me.data?.role || 'user');
      }
      if (favsRes.ok) {
        const fd = await favsRes.json();
        setFavorites(fd.data || []);
      }
      if (typeof window !== 'undefined' && window.location.search.includes('upgraded=1')) {
        setUpgraded(true);
      }
    })();
  }, [router]);

  async function handleUpgrade(priceId: string) {
    setBilling(true);
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId }),
    });
    if (res.ok) {
      const data = await res.json();
      const stripe = await stripePromise;
      if (data.data?.url) window.location.href = data.data.url;
      else await stripe?.redirectToCheckout({ sessionId: data.data?.sessionId });
    }
    setBilling(false);
  }

  async function handlePortal() {
    setPortalLoading(true);
    const res = await fetch('/api/billing/portal', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.data?.url) window.location.href = data.data.url;
    }
    setPortalLoading(false);
  }

  async function handleExport() {
    setExporting(true);
    const res = await fetch('/api/privacy/export', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'powderiq-data.json'; a.click();
      URL.revokeObjectURL(url);
    }
    setExporting(false);
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to permanently delete your account? This cannot be undone.')) return;
    setDeleting(true);
    await fetch('/api/privacy/delete', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  const avatarLetter = userEmail?.[0]?.toUpperCase() || 'U';
  const isPro = userRole === 'pro_user' || userRole === 'admin';

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    :root{
      --blue:#1d6ef5;--blue-light:#e8f1fe;
      --text:#0d1b2e;--text-2:#3d5166;--text-3:#6b849a;
      --bd:rgba(100,150,200,0.15);--bd2:rgba(100,150,200,0.25);
      --bg:#f0f5fb;--white:#ffffff;
      --green:#22c55e;--green-bg:#f0fdf4;
      --sh:0 2px 12px rgba(15,40,80,0.08);--sh-lg:0 8px 32px rgba(15,40,80,0.14);
    }
    html,body{height:100%;background:#f0f5fb !important;font-family:'Inter',sans-serif;color:var(--text);font-size:14px;}
    .tnav{position:sticky;top:0;z-index:100;height:60px;background:var(--white);border-bottom:1px solid var(--bd2);display:flex;align-items:center;padding:0 20px;gap:12px;box-shadow:var(--sh);}
    .tnav-logo{display:flex;align-items:center;text-decoration:none;flex-shrink:0;}
    .tnav-logo img{height:34px;width:auto;}
    .tnav-tabs{display:flex;align-items:center;gap:2px;flex:1;}
    .tnav-tab{display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:9px;font-size:13px;font-weight:600;color:var(--text-3);text-decoration:none;white-space:nowrap;transition:background .15s,color .15s;}
    .tnav-tab:hover{background:var(--bg);color:var(--text);}
    .tnav-tab.act{background:var(--blue-light);color:var(--blue);}
    .tnav-right{display:flex;align-items:center;gap:8px;margin-left:auto;flex-shrink:0;}
    .api-badge{display:flex;align-items:center;gap:5px;padding:5px 12px;background:var(--green-bg);border:1px solid rgba(34,197,94,0.3);border-radius:20px;font-size:12px;font-weight:600;color:#15803d;}
    .api-dot{width:7px;height:7px;background:var(--green);border-radius:50%;}
    .tnav-icon{width:34px;height:34px;border-radius:8px;border:1px solid var(--bd2);background:var(--white);display:flex;align-items:center;justify-content:center;font-size:15px;cursor:pointer;text-decoration:none;transition:background .15s;}
    .tnav-icon:hover{background:var(--bg);}
    .tnav-avatar{width:34px;height:34px;border-radius:50%;background:var(--blue);color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;}
    .tnav-badge{width:34px;height:34px;border-radius:8px;background:var(--blue-light);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--blue);}
    .tnav-out{font-size:13px;font-weight:600;color:var(--text-2);cursor:pointer;background:none;border:none;font-family:'Inter',sans-serif;transition:color .15s;}
    .tnav-out:hover{color:var(--text);}
    .shell{display:flex;height:calc(100vh - 60px);overflow:hidden;}
    .sidebar{width:196px;flex-shrink:0;background:var(--white);border-right:1px solid var(--bd2);overflow-y:auto;display:flex;flex-direction:column;padding:12px 8px;}
    .sb-active{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:9px;background:var(--blue-light);font-size:13px;font-weight:700;color:var(--blue);margin-bottom:12px;}
    .sb-lbl{font-size:10px;font-weight:700;color:var(--text-3);letter-spacing:.07em;text-transform:uppercase;padding:0 10px 6px;}
    .sb-item{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:9px;text-decoration:none;cursor:pointer;transition:background .15s;margin:1px 0;}
    .sb-item:hover{background:var(--bg);}
    .sb-thumb{width:24px;height:24px;border-radius:6px;flex-shrink:0;background:linear-gradient(135deg,#dbeafe,#bfdbfe);display:flex;align-items:center;justify-content:center;font-size:11px;overflow:hidden;}
    .sb-thumb img{width:100%;height:100%;object-fit:cover;}
    .sb-name{font-size:12px;font-weight:600;color:var(--text-2);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .sb-score{font-size:11px;font-weight:700;color:var(--blue);flex-shrink:0;}
    .sb-footer{margin-top:auto;padding:12px 8px 4px;border-top:1px solid var(--bd);}
    .sb-fbtn{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:9px;font-size:12.5px;font-weight:600;cursor:pointer;background:none;border:none;font-family:'Inter',sans-serif;width:100%;text-align:left;transition:background .15s;}
    .sb-fbtn:hover{background:var(--bg);}
    .sb-fbtn.export{color:var(--text-2);}
    .sb-fbtn.danger{color:#dc2626;}
    .main-scroll{flex:1;overflow-y:auto;background:var(--bg);}
    .hero{position:relative;height:300px;overflow:hidden;}
    .hero img{width:100%;height:100%;object-fit:cover;object-position:center 40%;}
    .hero-ov{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(210,228,248,0.3) 0%,rgba(255,255,255,0.88) 100%);}
    .hero-ct{position:absolute;bottom:0;left:0;right:0;padding:28px 36px;}
    .hero-title{font-size:28px;font-weight:800;color:var(--text);margin-bottom:6px;}
    .hero-sub{font-size:15px;color:var(--text-2);max-width:440px;line-height:1.5;}
    .content{padding:28px 36px 48px;background:var(--bg);}
    .billing-toggle{display:flex;align-items:center;gap:0;margin-bottom:24px;border-bottom:2px solid var(--bd2);}
    .toggle-tab{padding:10px 20px;font-size:14px;font-weight:600;color:var(--text-3);cursor:pointer;border:none;background:none;border-bottom:2px solid transparent;margin-bottom:-2px;font-family:'Inter',sans-serif;transition:color .15s,border-color .15s;}
    .toggle-tab.act{color:var(--blue);border-bottom-color:var(--blue);}
    .save-badge{margin-left:12px;padding:3px 10px;background:#dcfce7;color:#15803d;border-radius:12px;font-size:12px;font-weight:700;}
    .plan-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;background:var(--white);border:1px solid var(--bd2);border-radius:16px;overflow:hidden;box-shadow:var(--sh-lg);}
    .plan-left{padding:28px;border-right:1px solid var(--bd2);position:relative;overflow:hidden;min-height:420px;background:var(--white);}
    .plan-left-bg{position:absolute;inset:0;background-image:url('/brand/auth-bg.jpg');background-size:cover;background-position:center;opacity:0.08;}
    .plan-left-ct{position:relative;z-index:1;}
    .pl-title{font-size:22px;font-weight:800;color:var(--text);margin-bottom:8px;}
    .pl-sub{font-size:13px;color:var(--text-3);line-height:1.5;margin-bottom:24px;}
    .pl-free{font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px;}
    .pl-price{font-size:32px;font-weight:900;color:var(--text);margin-bottom:10px;}
    .pl-price span{font-size:14px;font-weight:400;color:var(--text-3);}
    .pl-current{display:inline-block;padding:8px 20px;border-radius:8px;background:var(--bg);color:var(--text-3);border:1px solid var(--bd2);font-size:13px;font-weight:600;margin-bottom:20px;}
    .pl-feats{display:flex;flex-direction:column;gap:6px;}
    .pl-feat{font-size:13px;color:var(--text-2);display:flex;align-items:center;gap:8px;}
    .pl-check{color:var(--text-3);font-size:12px;}
    .plan-right{padding:28px;background:var(--white);}
    .pr-price{font-size:36px;font-weight:900;color:var(--text);line-height:1;margin-bottom:4px;}
    .pr-price span{font-size:15px;font-weight:400;color:var(--text-3);}
    .pr-sub{font-size:13px;color:var(--text-3);margin-bottom:6px;}
    .pr-sub strong{color:var(--blue);font-weight:600;}
    .pr-feats{display:flex;flex-direction:column;gap:8px;margin:20px 0 24px;}
    .pr-feat{font-size:13px;color:var(--text-2);display:flex;align-items:center;gap:8px;}
    .pr-check{color:var(--blue);font-weight:700;}
    .cta{width:100%;padding:14px;border-radius:10px;border:none;background:var(--blue);color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;transition:filter .15s;display:flex;align-items:center;justify-content:center;gap:8px;}
    .cta:hover:not(:disabled){filter:brightness(1.08);}
    .cta:disabled{opacity:.55;cursor:not-allowed;}
    .cta.manage{background:var(--bg);color:var(--text-2);border:1px solid var(--bd2);}
    .cta.manage:hover{background:#e5edf5;}
    .pro-card{background:var(--white);border:1px solid var(--bd2);border-radius:16px;overflow:hidden;box-shadow:var(--sh-lg);}
    .pro-hd{background:linear-gradient(135deg,#1d6ef5,#1452c8);padding:22px 28px;display:flex;align-items:center;gap:12px;}
    .pro-hd-title{font-size:18px;font-weight:800;color:#fff;}
    .pro-hd-sub{font-size:13px;color:rgba(255,255,255,0.75);margin-top:2px;}
    .pro-body{padding:24px 28px;}
    .pro-feats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;}
    .pro-feat{font-size:13px;color:var(--text-2);display:flex;align-items:center;gap:7px;}
    .profile-card{background:var(--white);border:1px solid var(--bd2);border-radius:14px;overflow:hidden;box-shadow:var(--sh);margin-top:24px;}
    .prof-row{display:flex;align-items:center;padding:13px 18px;border-bottom:1px solid var(--bd);}
    .prof-row:last-child{border-bottom:none;}
    .prof-lbl{font-size:13px;color:var(--text-3);width:100px;flex-shrink:0;}
    .prof-val{font-size:13px;font-weight:600;color:var(--text);flex:1;}
    .role-badge{padding:2px 10px;border-radius:10px;font-size:11px;font-weight:700;}
    .role-free{background:#f1f5f9;color:var(--text-3);}
    .role-pro{background:var(--blue-light);color:var(--blue);}
    @media(max-width:900px){.sidebar{display:none;}.plan-grid{grid-template-columns:1fr;}.pro-feats{grid-template-columns:1fr;}}
    @media(max-width:640px){.tnav-tabs{display:none;}.hero-ct{padding:20px;}.content{padding:20px;}}
  `;

  return (
    <>
      <style>{CSS}</style>

      <nav className="tnav">
        <Link href="/dashboard" className="tnav-logo">
          <img src="/brand/powderiq_logo.png" alt="PowderIQ" />
        </Link>
        <div className="tnav-tabs">
          <Link href="/dashboard" className="tnav-tab">📊 Dashboard</Link>
          <Link href="/mountains" className="tnav-tab">🏔️ Resorts</Link>
          <Link href="/forecasts"  className="tnav-tab">📅 Forecasts</Link>
          <Link href="/account"    className="tnav-tab act">👤 Account</Link>
        </div>
        <div className="tnav-right">
          <div className="api-badge"><div className="api-dot" />API Connected</div>
          <div className="tnav-badge">l2</div>
          <div className="tnav-avatar">{avatarLetter}</div>
          <button className="tnav-out" onClick={signOut}>Sign out</button>
        </div>
      </nav>

      <div className="shell">
        <aside className="sidebar">
          <div className="sb-active"><span>👤</span> Account</div>
          {favorites.length > 0 && (
            <>
              <div className="sb-lbl">Saved Resorts</div>
              {favorites.map(f => (
                <Link key={f.id} href={`/mountains/${f.mountain.id}`} className="sb-item">
                  <div className="sb-thumb">
                    {f.mountain.imageUrl
                      ? <img src={f.mountain.imageUrl} alt="" onError={e=>{(e.target as HTMLImageElement).style.display='none';}} />
                      : '🏔'}
                  </div>
                  <span className="sb-name">{f.mountain.name}</span>
                  {f.score != null && <span className="sb-score">{f.score}</span>}
                </Link>
              ))}
            </>
          )}
          <div className="sb-footer">
            <button className="sb-fbtn export" onClick={handleExport} disabled={exporting}>
              📥 {exporting ? 'Exporting…' : 'Export my data (JSON)'}
            </button>
            <button className="sb-fbtn danger" onClick={handleDelete} disabled={deleting}>
              🗑️ {deleting ? 'Deleting…' : 'Permanently delete my account'}
            </button>
          </div>
        </aside>

        <div className="main-scroll">
          <div className="hero">
            <img src="/brand/auth-bg.jpg" alt="" />
            <div className="hero-ov" />
            <div className="hero-ct">
              {upgraded && (
                <div style={{background:'#f0fdf4',border:'1px solid rgba(34,197,94,0.3)',color:'#15803d',borderRadius:10,padding:'10px 16px',fontSize:13,fontWeight:600,marginBottom:14,display:'inline-flex',alignItems:'center',gap:8}}>
                  🎉 Welcome to Pro! Your upgraded features are now active.
                </div>
              )}
              <h1 className="hero-title">{isPro ? "You're on Pro" : 'Upgrade to Pro'}</h1>
              <p className="hero-sub">
                {isPro
                  ? 'Manage your subscription and account settings below.'
                  : 'Unlock mountain comparison, powder alerts, 72h snow history, and personalized scoring.'}
              </p>
            </div>
          </div>

          <div className="content">

            {!isPro && (
              <>
                <div className="billing-toggle">
                  <button className={`toggle-tab${billing==='monthly'?' act':''}`} onClick={()=>setBillingCycle('monthly')}>Monthly</button>
                  <button className={`toggle-tab${billing==='yearly'?' act':''}`}  onClick={()=>setBillingCycle('yearly')}>Yearly</button>
                  {billing==='yearly' && <span className="save-badge">Save 33%</span>}
                </div>

                <div className="plan-grid">
                  <div className="plan-left">
                    <div className="plan-left-bg" />
                    <div className="plan-left-ct">
                      <div className="pl-title">Upgrade to Pro</div>
                      <div className="pl-sub">Unlock mountain comparison, powder alerts.<br/>72h snow history, and personalized scoring.</div>
                      <div className="pl-free">Free</div>
                      <div className="pl-price">$0 <span>/month</span></div>
                      <div className="pl-current">Current Plan</div>
                      <div className="pl-feats">
                        {['Powder scores for all resorts','Basic 6-day forecast','Save up to 3 resorts','Compare up to 15 resorts','Powder alerts — email & SMS','24h / 48h / 72h snow history','Personalized score weights'].map(f=>(
                          <div className="pl-feat" key={f}><span className="pl-check">✓</span> {f}</div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="plan-right">
                    <div className="pr-price">
                      {billing==='monthly' ? '$9.99' : '$8.25'}<span>/month</span>
                    </div>
                    <div className="pr-sub">
                      {billing==='yearly'
                        ? <><strong>$99.00 billed yearly</strong> — 2 months free</>
                        : <>Switch to yearly and save $20.88 | <strong>$8.25/month</strong></>}
                    </div>
                    <div className="pr-feats">
                      {['Everything in Free','Unlimited saved resorts','Powder alerts — email & SMS','24h / 48h / 72h snow history','Personalized score weights','Priority 5-min data refresh','AI-powered snow reports'].map(f=>(
                        <div className="pr-feat" key={f}><span className="pr-check">✓</span> {f}</div>
                      ))}
                    </div>
                    <button className="cta" onClick={()=>handleUpgrade(billing==='monthly'?PRICES.consumer.pro.monthly:PRICES.consumer.pro.yearly)} disabled={billingLoading}>
                      {billingLoading ? 'Loading…' : 'Start Free Trial →'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {isPro && (
              <div className="pro-card">
                <div className="pro-hd">
                  <span style={{fontSize:24}}>⭐</span>
                  <div>
                    <div className="pro-hd-title">PowderIQ Pro</div>
                    <div className="pro-hd-sub">Active subscription</div>
                  </div>
                </div>
                <div className="pro-body">
                  <div className="pro-feats">
                    {['Unlimited saved resorts','Priority 5-min data refresh','Compare up to 10 resorts','AI-powered snow reports','Powder alerts — email & SMS','Personalized score weights','24h / 48h / 72h snow history','6-day snow forecast'].map(f=>(
                      <div className="pro-feat" key={f}><span className="pr-check">✓</span> {f}</div>
                    ))}
                  </div>
                  <button className="cta manage" onClick={handlePortal} disabled={portalLoading}>
                    {portalLoading ? 'Loading…' : 'Manage Billing →'}
                  </button>
                </div>
              </div>
            )}

            <div className="profile-card">
              <div className="prof-row">
                <span className="prof-lbl">Email</span>
                <span className="prof-val">{user?.email}</span>
              </div>
              <div className="prof-row">
                <span className="prof-lbl">Plan</span>
                <span className={`role-badge ${isPro ? 'role-pro' : 'role-free'}`}>
                  {userRole==='admin' ? 'Admin' : isPro ? 'Pro' : 'Free'}
                </span>
              </div>
              {user?.profile?.displayName && (
                <div className="prof-row">
                  <span className="prof-lbl">Name</span>
                  <span className="prof-val">{user.profile.displayName}</span>
                </div>
              )}
              {user?.profile?.style && (
                <div className="prof-row">
                  <span className="prof-lbl">Style</span>
                  <span className="prof-val" style={{textTransform:'capitalize'}}>{user.profile.style.replace('_',' ')}</span>
                </div>
              )}
              <div className="prof-row">
                <Link href="/onboarding" style={{fontSize:13,color:'var(--blue)',fontWeight:600,textDecoration:'none'}}>
                  Edit profile →
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
