// src/app/account/billing/page.tsx
'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { PRICES } from '@/lib/stripePrices';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const CSS = `
.card{background:#fff;border:1px solid rgba(100,150,200,0.25);border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(15,40,80,0.08);margin-bottom:20px;}
.card-hd{font-size:15px;font-weight:700;color:#0d1b2e;padding:16px 20px;border-bottom:1px solid rgba(100,150,200,0.15);display:flex;align-items:center;justify-content:space-between;}
.card-body{padding:20px;}
.plan-hero{background:linear-gradient(135deg,#1d6ef5,#1452c8);border-radius:12px;padding:20px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;}
.plan-hero-name{font-size:22px;font-weight:900;color:#fff;}
.plan-hero-price{font-size:14px;color:rgba(255,255,255,0.75);margin-top:2px;}
.plan-badge{padding:4px 12px;background:rgba(255,255,255,0.2);border-radius:20px;font-size:12px;font-weight:700;color:#fff;}
.free-plan-hero{background:#f8fafc;border:2px solid rgba(100,150,200,0.25);border-radius:12px;padding:20px;margin-bottom:16px;}
.free-plan-name{font-size:20px;font-weight:800;color:#0d1b2e;}
.free-plan-price{font-size:13px;color:#6b849a;margin-top:2px;}
.billing-toggle{display:flex;align-items:center;gap:8px;margin-bottom:20px;}
.toggle-btn{padding:7px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:1.5px solid rgba(100,150,200,0.25);background:#fff;color:#6b849a;font-family:'Inter',sans-serif;transition:all .15s;}
.toggle-btn.act{border-color:#1d6ef5;background:#e8f1fe;color:#1d6ef5;}
.save-tag{padding:3px 10px;background:#ccfbf1;color:#0d9488;border-radius:10px;font-size:11px;font-weight:700;}
.features-list{display:flex;flex-direction:column;gap:8px;margin-bottom:20px;}
.feature-item{display:flex;align-items:center;gap:8px;font-size:13px;color:#3d5166;}
.feature-check{color:#1d6ef5;font-weight:700;flex-shrink:0;}
.cta-btn{width:100%;padding:12px;border-radius:10px;border:none;font-size:14px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;transition:filter .15s;}
.cta-btn.upgrade{background:#1d6ef5;color:#fff;}
.cta-btn.upgrade:hover:not(:disabled){filter:brightness(1.08);}
.cta-btn.manage{background:#f0f5fb;color:#3d5166;border:1.5px solid rgba(100,150,200,0.25);}
.cta-btn.manage:hover{background:#e5edf5;}
.cta-btn:disabled{opacity:.55;cursor:not-allowed;}
.action-row{display:flex;gap:10px;margin-top:12px;}
.action-btn{flex:1;padding:10px;border-radius:9px;border:1.5px solid rgba(100,150,200,0.25);background:#fff;font-size:13px;font-weight:600;color:#3d5166;cursor:pointer;font-family:'Inter',sans-serif;display:flex;align-items:center;justify-content:center;gap:6px;transition:background .15s;}
.action-btn:hover{background:#f0f5fb;}
.info-row{display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid rgba(100,150,200,0.1);}
.info-row:last-child{border-bottom:none;}
.info-label{font-size:13px;color:#3d5166;}
.info-val{font-size:13px;font-weight:600;color:#0d1b2e;}
.success-msg{background:#f0fdf4;border:1px solid rgba(34,197,94,0.3);color:#15803d;border-radius:9px;padding:10px 14px;font-size:13px;font-weight:600;margin-bottom:16px;}
`;

function BillingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token,    setToken]    = useState('');
  const [role,     setRole]     = useState('user');
  const [sub,      setSub]      = useState<any>(null);
  const [billing,  setBilling]  = useState<'monthly'|'yearly'>('monthly');
  const [upgrading,setUpgrading]= useState(false);
  const [portal,   setPortal]   = useState(false);
  const [upgraded, setUpgraded] = useState(false);

  const isPro = role === 'pro_user' || role === 'admin';

  useEffect(()=>{
    (async()=>{
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push('/auth/login'); return; }
      const t = data.session.access_token;
      setToken(t);
      const [meRes, subRes] = await Promise.all([
        fetch('/api/me', { headers: { Authorization: `Bearer ${t}` } }),
        fetch('/api/billing/subscription', { headers: { Authorization: `Bearer ${t}` } }),
      ]);
      if (meRes.ok) setRole((await meRes.json()).data?.role||'user');
      if (subRes.ok) setSub((await subRes.json()).data);
      if (searchParams.get('upgraded')==='1') setUpgraded(true);
    })();
  },[router, searchParams]);

  async function handleUpgrade(){
    setUpgrading(true);
    const priceId = billing==='monthly' ? PRICES.consumer.pro.monthly : PRICES.consumer.pro.yearly;
    const res = await fetch('/api/billing/checkout',{
      method:'POST', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify({priceId}),
    });
    if (res.ok){
      const d = await res.json();
      const stripe = await stripePromise;
      if (d.data?.url) window.location.href = d.data.url;
      else await stripe?.redirectToCheckout({sessionId:d.data?.sessionId});
    }
    setUpgrading(false);
  }

  async function handlePortal(){
    setPortal(true);
    const res = await fetch('/api/billing/portal',{
      method:'POST', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify({}),
    });
    if (res.ok){ const d=await res.json(); if (d.data?.url) window.location.href=d.data.url; }
    setPortal(false);
  }

  return (
    <>
      <style>{CSS}</style>
      <div style={{padding:'20px 28px 48px'}}>
        <div style={{marginBottom:20}}>
          <h1 style={{fontSize:20,fontWeight:800,color:'#0d1b2e'}}>Billing</h1>
          <p style={{fontSize:13,color:'#6b849a',marginTop:3}}>Manage your subscription and payment details.</p>
        </div>

        {upgraded && <div className="success-msg">🎉 Welcome to Pro! Your upgraded features are now active.</div>}

        {/* Current plan */}
        <div className="card">
          <div className="card-hd">Current Plan</div>
          <div className="card-body">
            {isPro ? (
              <>
                <div className="plan-hero">
                  <div>
                    <div className="plan-hero-name">PowderIQ Pro</div>
                    <div className="plan-hero-price">
                      {sub?.stripePriceId === PRICES.consumer.pro.yearly ? '$99.00/year' : '$9.99/month'}
                    </div>
                  </div>
                  <div className="plan-badge">Active</div>
                </div>
                {sub?.currentPeriodEnd && (
                  <div className="info-row">
                    <span className="info-label">Next billing date</span>
                    <span className="info-val">{new Date(sub.currentPeriodEnd).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</span>
                  </div>
                )}
                <div className="action-row">
                  <button className="action-btn" onClick={handlePortal} disabled={portal}>📊 {portal?'…':'Manage Billing'}</button>
                  <button className="action-btn" onClick={handlePortal} disabled={portal}>⬇ Download Invoices</button>
                </div>
              </>
            ) : (
              <>
                <div className="free-plan-hero">
                  <div className="free-plan-name">Free Plan</div>
                  <div className="free-plan-price">$0 / month — limited access</div>
                </div>
                <div className="billing-toggle">
                  <button className={`toggle-btn${billing==='monthly'?' act':''}`} onClick={()=>setBilling('monthly')}>Monthly</button>
                  <button className={`toggle-btn${billing==='yearly'?' act':''}`}  onClick={()=>setBilling('yearly')}>Yearly</button>
                  <span className="save-tag">Save 33%</span>
                </div>
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:28,fontWeight:900,color:'#0d1b2e',lineHeight:1}}>
                    {billing==='monthly'?'$9.99':'$8.25'}
                    <span style={{fontSize:14,fontWeight:400,color:'#6b849a'}}>/month</span>
                  </div>
                  {billing==='yearly' && <div style={{fontSize:12,color:'#0d9488',marginTop:3,fontWeight:600}}>$99.00 billed yearly — 2 months free</div>}
                </div>
                <div className="features-list">
                  {['Unlimited saved resorts','Compare up to 10 resorts','Powder alerts — email & SMS','24h / 48h / 72h snow history','Personalized score weights','Priority 5-min data refresh'].map(f=>(
                    <div className="feature-item" key={f}><span className="feature-check">✓</span>{f}</div>
                  ))}
                </div>
                <button className="cta-btn upgrade" onClick={handleUpgrade} disabled={upgrading}>
                  {upgrading ? 'Redirecting…' : 'Upgrade to Pro — Start Free Trial'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Billing history */}
        <div className="card">
          <div className="card-hd">Billing History</div>
          <div className="card-body">
            {isPro ? (
              <button className="cta-btn manage" onClick={handlePortal} disabled={portal}>
                {portal ? 'Loading…' : '⬇ View All Invoices'}
              </button>
            ) : (
              <p style={{fontSize:13,color:'#6b849a'}}>No invoices yet. Upgrade to Pro to get started.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function BillingPage() {
  return <Suspense fallback={<div style={{padding:28,color:'#6b849a',fontSize:13}}>Loading…</div>}><BillingInner/></Suspense>;
}
