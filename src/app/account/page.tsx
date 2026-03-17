'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { PRICES } from '@/lib/stripePrices';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface UserData {
  id: string; email: string; role: string; name?: string;
  profile?: { displayName?: string; style?: string; skillLevel?: string; avatarUrl?: string };
}

const STYLES = [
  { value: 'powder',       label: 'Powder Hunter' },
  { value: 'all_mountain', label: 'All Mountain'  },
  { value: 'expert',       label: 'Expert'        },
];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --blue:#1d6ef5;--blue-lt:#e8f1fe;--teal:#0d9488;--teal-lt:#ccfbf1;
  --text:#0d1b2e;--text2:#3d5166;--text3:#6b849a;
  --bd:rgba(100,150,200,0.15);--bd2:rgba(100,150,200,0.25);
  --bg:#f0f5fb;--white:#ffffff;
  --green:#22c55e;--green-bg:#f0fdf4;
  --sh:0 2px 12px rgba(15,40,80,0.08);--sh-lg:0 8px 32px rgba(15,40,80,0.12);
}
html,body{height:100%;background:#f0f5fb !important;font-family:'Inter',sans-serif;color:var(--text);font-size:14px;}

/* TOPNAV */
.tnav{position:sticky;top:0;z-index:100;height:56px;background:var(--white);border-bottom:1px solid var(--bd2);display:flex;align-items:center;padding:0 20px;gap:10px;box-shadow:var(--sh);}
.tnav-logo{display:flex;align-items:center;text-decoration:none;flex-shrink:0;}
.tnav-logo img{height:32px;width:auto;}
.tnav-tabs{display:flex;align-items:center;gap:2px;flex:1;}
.tnav-tab{display:flex;align-items:center;gap:5px;padding:6px 14px;border-radius:8px;font-size:13px;font-weight:600;color:var(--text3);text-decoration:none;white-space:nowrap;transition:background .15s,color .15s;}
.tnav-tab:hover{background:var(--bg);color:var(--text);}
.tnav-tab.act{background:var(--blue-lt);color:var(--blue);}
.tnav-right{display:flex;align-items:center;gap:6px;margin-left:auto;flex-shrink:0;}
.api-badge{display:flex;align-items:center;gap:5px;padding:4px 10px;background:var(--green-bg);border:1px solid rgba(34,197,94,0.3);border-radius:16px;font-size:11.5px;font-weight:600;color:#15803d;}
.api-dot{width:6px;height:6px;background:var(--green);border-radius:50%;}
.tnav-av{width:32px;height:32px;border-radius:50%;background:var(--blue);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;}
.tnav-av img{width:100%;height:100%;object-fit:cover;}
.tnav-badge{padding:4px 10px;background:var(--blue-lt);border-radius:8px;font-size:12px;font-weight:700;color:var(--blue);}
.tnav-out{font-size:13px;font-weight:600;color:var(--text2);cursor:pointer;background:none;border:none;font-family:'Inter',sans-serif;}
.tnav-out:hover{color:var(--text);}

/* SHELL */
.shell{display:flex;height:calc(100vh - 56px);overflow:hidden;}

/* SIDEBAR */
.sidebar{width:200px;flex-shrink:0;background:var(--white);border-right:1px solid var(--bd2);overflow-y:auto;padding:12px 8px;}
.sb-active{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:9px;background:var(--blue-lt);font-size:13px;font-weight:700;color:var(--blue);margin-bottom:6px;cursor:pointer;border:none;font-family:'Inter',sans-serif;width:100%;text-align:left;}
.sb-link{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:9px;font-size:13px;font-weight:500;color:var(--text2);cursor:pointer;text-decoration:none;transition:background .15s,color .15s;border:none;background:none;font-family:'Inter',sans-serif;width:100%;text-align:left;}
.sb-link:hover{background:var(--bg);color:var(--text);}
.sb-link.act{background:var(--blue-lt);color:var(--blue);font-weight:600;}
.sb-icon{font-size:14px;width:18px;text-align:center;flex-shrink:0;}

/* MAIN */
.main-scroll{flex:1;overflow-y:auto;background:var(--bg);}
.page-title{font-size:22px;font-weight:800;color:var(--text);padding:20px 24px 12px;}

/* HERO */
.hero{height:200px;overflow:hidden;position:relative;}
.hero img{width:100%;height:100%;object-fit:cover;object-position:center 35%;}

/* THREE COLUMN GRID */
.grid3{display:grid;grid-template-columns:260px 1fr 280px;gap:16px;padding:20px 24px 40px;align-items:start;}
.col{display:flex;flex-direction:column;gap:16px;}

/* CARD */
.card{background:var(--white);border:1px solid var(--bd2);border-radius:12px;overflow:hidden;box-shadow:var(--sh);}
.card-title{font-size:15px;font-weight:700;color:var(--text);padding:16px 18px;border-bottom:1px solid var(--bd);}

/* PROFILE CARD */
.avatar-wrap{position:relative;width:110px;margin:16px auto 8px;text-align:center;}
.avatar-img{width:110px;height:110px;border-radius:12px;object-fit:cover;background:linear-gradient(135deg,#dbeafe,#bfdbfe);display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:800;color:var(--blue);}
.avatar-img img{width:100%;height:100%;object-fit:cover;border-radius:12px;}
.upload-btn{display:flex;align-items:center;gap:5px;padding:5px 12px;background:var(--white);border:1px solid var(--bd2);border-radius:7px;font-size:11.5px;font-weight:600;color:var(--text2);cursor:pointer;font-family:'Inter',sans-serif;margin:6px auto;width:fit-content;transition:background .15s;}
.upload-btn:hover{background:var(--bg);}
.prof-field{padding:8px 18px;border-bottom:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between;}
.prof-field:last-child{border-bottom:none;}
.prof-label{font-size:12px;color:var(--text3);font-weight:500;}
.prof-val{font-size:13px;font-weight:600;color:var(--text);}

/* NOTIFICATIONS MINI CARD */
.notif-link{display:flex;align-items:center;gap:8px;padding:10px 18px;border-bottom:1px solid var(--bd);font-size:13px;color:var(--text2);cursor:pointer;font-weight:500;text-decoration:none;transition:background .15s;}
.notif-link:hover{background:var(--bg);}
.notif-link:last-child{border-bottom:none;}

/* FORM FIELDS */
.form-group{padding:12px 18px;border-bottom:1px solid var(--bd);}
.form-group:last-of-type{border-bottom:none;}
.form-label{font-size:12px;color:var(--text3);font-weight:500;margin-bottom:6px;display:block;}
.form-row{display:flex;gap:8px;align-items:center;}
.form-input{flex:1;padding:9px 12px;border:1.5px solid var(--bd2);border-radius:8px;font-size:13px;font-family:'Inter',sans-serif;color:var(--text);background:var(--bg);outline:none;transition:border-color .15s;}
.form-input:focus{border-color:var(--blue);background:var(--white);}
.form-btn{padding:8px 14px;border-radius:8px;border:none;background:var(--blue);color:#fff;font-size:12.5px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;white-space:nowrap;transition:filter .15s;}
.form-btn:hover{filter:brightness(1.08);}
.form-btn.sec{background:var(--bg);color:var(--text2);border:1px solid var(--bd2);}
.form-btn.sec:hover{background:#e5edf5;}
.form-btn.full{width:calc(100% - 36px);margin:0 18px 14px;display:block;}
.form-btn.teal{background:var(--teal);color:#fff;}
.form-btn.teal:hover{filter:brightness(1.08);}

/* RIDING PREFS */
.style-btns{display:flex;gap:8px;padding:12px 18px;flex-wrap:wrap;}
.style-btn{padding:7px 14px;border-radius:8px;border:1.5px solid var(--bd2);font-size:12.5px;font-weight:600;color:var(--text2);cursor:pointer;font-family:'Inter',sans-serif;background:var(--white);transition:background .15s,border-color .15s,color .15s;}
.style-btn.act{background:var(--blue);border-color:var(--blue);color:#fff;}
.style-btn:hover:not(.act){background:var(--bg);}
.billing-history-row{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;font-size:13px;color:var(--text2);}
.billing-history-val{color:var(--text3);font-size:12px;}

/* BILLING CARD */
.bill-toggle{display:flex;align-items:center;gap:8px;padding:14px 18px 10px;}
.bill-tab{padding:5px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;font-family:'Inter',sans-serif;transition:background .15s,color .15s;}
.bill-tab.act{color:var(--blue);background:none;text-decoration:underline;text-underline-offset:3px;}
.bill-tab:not(.act){color:var(--text3);background:none;}
.save-tag{padding:3px 10px;background:var(--teal-lt);color:var(--teal);border-radius:10px;font-size:11px;font-weight:700;}
.plan-name{font-size:22px;font-weight:800;color:var(--text);padding:4px 18px 2px;}
.plan-price{font-size:13px;color:var(--text3);padding:0 18px 14px;}
.plan-price strong{font-size:24px;font-weight:900;color:var(--text);}
.plan-row{display:flex;gap:8px;padding:0 18px 12px;align-items:center;}
.plan-access{flex:1;padding:8px 12px;background:var(--bg);border-radius:8px;font-size:12.5px;color:var(--text2);font-weight:500;}
.upgrade-btn{padding:8px 16px;border-radius:8px;border:none;background:var(--teal);color:#fff;font-size:12.5px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;flex-shrink:0;transition:filter .15s;}
.upgrade-btn:hover{filter:brightness(1.08);}
.bill-action-row{display:flex;gap:8px;padding:0 18px 14px;}
.bill-action{flex:1;padding:8px;border-radius:8px;border:1px solid var(--bd2);background:var(--white);font-size:12px;font-weight:600;color:var(--text2);cursor:pointer;font-family:'Inter',sans-serif;display:flex;align-items:center;justify-content:center;gap:5px;transition:background .15s;}
.bill-action:hover{background:var(--bg);}

/* NOTIFICATION TOGGLES */
.notif-settings{padding:4px 0;}
.notif-row{display:flex;align-items:center;padding:10px 18px;border-bottom:1px solid var(--bd);}
.notif-row:last-of-type{border-bottom:none;}
.notif-check{color:var(--blue);font-size:13px;margin-right:8px;flex-shrink:0;}
.notif-label{font-size:13px;color:var(--text2);flex:1;font-weight:500;}
.toggle{position:relative;width:40px;height:22px;flex-shrink:0;}
.toggle input{opacity:0;width:0;height:0;position:absolute;}
.toggle-track{position:absolute;inset:0;border-radius:11px;background:#d1d5db;cursor:pointer;transition:background .2s;}
.toggle input:checked ~ .toggle-track{background:var(--teal);}
.toggle-thumb{position:absolute;top:3px;left:3px;width:16px;height:16px;background:#fff;border-radius:50%;transition:transform .2s;pointer-events:none;}
.toggle input:checked ~ .toggle-track .toggle-thumb{transform:translateX(18px);}
.delete-btn{width:calc(100% - 36px);margin:14px 18px;padding:10px;border-radius:9px;border:none;background:#fca5a5;color:#7f1d1d;font-size:13px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;transition:background .15s;display:block;}
.delete-btn:hover{background:#f87171;}

/* BANNER */
.banner{margin:0 24px 16px;padding:12px 16px;border-radius:10px;font-size:13px;font-weight:600;}
.banner-success{background:var(--green-bg);border:1px solid rgba(34,197,94,0.3);color:#15803d;}

@media(max-width:1100px){.grid3{grid-template-columns:240px 1fr;}.col:last-child{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:16px;}}
@media(max-width:800px){.sidebar{display:none;}.grid3{grid-template-columns:1fr;}.col:last-child{grid-template-columns:1fr;}}
@media(max-width:640px){.tnav-tabs{display:none;}}
@keyframes spin{to{transform:rotate(360deg)}}
`;

export default function AccountPage() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const fileRef     = useRef<HTMLInputElement>(null);

  const [user,        setUser]        = useState<UserData | null>(null);
  const [token,       setToken]       = useState('');
  const [userRole,    setUserRole]    = useState('user');
  const [userEmail,   setUserEmail]   = useState('');
  const [userName,    setUserName]    = useState('');
  const [username,    setUsername]    = useState('');
  const [avatarUrl,   setAvatarUrl]   = useState('');
  const [ridingStyle, setRidingStyle] = useState('all_mountain');
  const [billing,     setBilling]     = useState<'monthly'|'yearly'>('monthly');
  const [notifs,      setNotifs]      = useState({ email: true, sms: true, weekly: true, newResort: false });
  const [saving,      setSaving]      = useState(false);
  const [savingPw,    setSavingPw]    = useState(false);
  const [currentPw,   setCurrentPw]  = useState('');
  const [newPw,       setNewPw]       = useState('');
  const [upgrading,   setUpgrading]   = useState(false);
  const [portalLoad,  setPortalLoad]  = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [upgraded,    setUpgraded]    = useState(false);
  const [activeSection, setActiveSection] = useState('profile');

  const isPro = userRole === 'pro_user' || userRole === 'admin';

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push('/auth/login'); return; }
      const t = data.session.access_token;
      setToken(t);
      setUserEmail(data.session.user?.email || '');

      const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) {
        const me = await res.json();
        setUser(me.data);
        setUserRole(me.data?.role || 'user');
        setUserName(me.data?.profile?.displayName || '');
        setUsername(me.data?.profile?.username || '');
        setRidingStyle(me.data?.profile?.style || 'all_mountain');
        setAvatarUrl(me.data?.profile?.avatarUrl || '');
      }
      if (searchParams.get('upgraded') === '1') setUpgraded(true);
    })();
  }, [router, searchParams]);

  async function saveProfile() {
    setSaving(true);
    await fetch('/api/me/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: userName, style: ridingStyle }),
    });
    setSaving(false);
  }

  async function changePassword() {
    if (!newPw) return;
    setSavingPw(true);
    await supabase.auth.updateUser({ password: newPw });
    setCurrentPw(''); setNewPw('');
    setSavingPw(false);
  }

  async function handleUpgrade() {
    setUpgrading(true);
    const priceId = billing === 'monthly' ? PRICES.consumer.pro.monthly : PRICES.consumer.pro.yearly;
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId }),
    });
    if (res.ok) {
      const d = await res.json();
      const stripe = await stripePromise;
      if (d.data?.url) window.location.href = d.data.url;
      else await stripe?.redirectToCheckout({ sessionId: d.data?.sessionId });
    }
    setUpgrading(false);
  }

  async function handlePortal() {
    setPortalLoad(true);
    const res = await fetch('/api/billing/portal', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const d = await res.json();
      if (d.data?.url) window.location.href = d.data.url;
    }
    setPortalLoad(false);
  }

  async function handleDelete() {
    if (!confirm('Permanently delete your account? This cannot be undone.')) return;
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
  const savedCount = 12; // from actual favorites count if needed

  const SIDEBAR_LINKS = [
    { key: 'account',     label: 'Account',       icon: '👤', isHeader: true },
    { key: 'profile',     label: 'Profile',        icon: '🪪' },
    { key: 'security',    label: 'Security',       icon: '🔒' },
    { key: 'billing',     label: 'Billing',        icon: '💳' },
    { key: 'notifications',label:'Notifications',  icon: '🔔' },
    { key: 'preferences', label: 'Preferences',    icon: '⚙️' },
    { key: 'privacy',     label: 'Data & Privacy', icon: '🛡️' },
  ];

  return (
    <>
      <style>{CSS}</style>

      {/* TOPNAV */}
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
          <div className="api-badge"><div className="api-dot"/>API Connected</div>
          <div className="tnav-badge">{savedCount}</div>
          <div className="tnav-av">
            {avatarUrl ? <img src={avatarUrl} alt="avatar"/> : avatarLetter}
          </div>
          <button className="tnav-out" onClick={signOut}>Sign out</button>
        </div>
      </nav>

      <div className="shell">

        {/* SIDEBAR */}
        <aside className="sidebar">
          {SIDEBAR_LINKS.map(l => l.isHeader ? (
            <button key={l.key} className="sb-active" onClick={() => setActiveSection(l.key)}>
              <span className="sb-icon">{l.icon}</span>{l.label}
            </button>
          ) : (
            <button key={l.key} className={`sb-link${activeSection===l.key?' act':''}`} onClick={() => setActiveSection(l.key)}>
              <span className="sb-icon">{l.icon}</span>{l.label}
            </button>
          ))}
        </aside>

        {/* MAIN */}
        <div className="main-scroll">
          <div className="page-title">Account Settings</div>

          {/* HERO */}
          <div className="hero">
            <img src="/brand/auth-bg.jpg" alt="mountain" />
          </div>

          {upgraded && (
            <div className="banner banner-success" style={{marginTop:16}}>
              🎉 Welcome to Pro! Your upgraded features are now active.
            </div>
          )}

          {/* THREE COLUMN GRID */}
          <div className="grid3">

            {/* LEFT COL */}
            <div className="col">
              {/* Profile Card */}
              <div className="card">
                <div className="card-title">Profile</div>
                <div className="avatar-wrap">
                  <div className="avatar-img">
                    {avatarUrl ? <img src={avatarUrl} alt="avatar"/> : avatarLetter}
                  </div>
                </div>
                <div style={{textAlign:'center'}}>
                  <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}}/>
                  <button className="upload-btn" onClick={()=>fileRef.current?.click()}>
                    📷 Upload Image
                  </button>
                </div>
                <div className="prof-field">
                  <span className="prof-label">Name</span>
                  <span className="prof-val">{userName || '—'}</span>
                </div>
                <div className="prof-field">
                  <span className="prof-label">Email</span>
                  <span className="prof-val" style={{fontSize:12,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{userEmail}</span>
                </div>
              </div>

              {/* Quick links mini card */}
              <div className="card">
                <div className="card-title">Notifications</div>
                <button className="notif-link" onClick={()=>setActiveSection('notifications')}>
                  <span>🔔</span> Powder alerts
                </button>
                <button className="notif-link" onClick={()=>setActiveSection('preferences')}>
                  <span>🎿</span> Riding preferences
                </button>
                <button className="notif-link" onClick={()=>setActiveSection('privacy')}>
                  <span>🛡️</span> Data &amp; Privacy
                </button>
              </div>
            </div>

            {/* CENTER COL */}
            <div className="col">
              {/* Password & Security */}
              <div className="card">
                <div className="card-title">Password &amp; Security</div>
                <div className="form-group">
                  <label className="form-label">Current Password</label>
                  <input className="form-input" type="password" value={currentPw} onChange={e=>setCurrentPw(e.target.value)} placeholder="••••••••"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <div className="form-row">
                    <input className="form-input" type="email" defaultValue={userEmail} readOnly/>
                    <button className="form-btn">Change Email</button>
                  </div>
                </div>
                <div className="form-group" style={{borderBottom:'1px solid var(--bd)'}}>
                  <label className="form-label">Username (optional)</label>
                  <input className="form-input" type="text" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Shredder_McPow"/>
                </div>
                <div style={{padding:'12px 18px'}}>
                  <button className="form-btn teal" style={{width:'100%',padding:'10px'}} onClick={changePassword} disabled={savingPw}>
                    {savingPw ? 'Saving…' : 'Change Password'}
                  </button>
                </div>
              </div>

              {/* Riding Preferences */}
              <div className="card">
                <div className="card-title">Riding Preferences</div>
                <div className="style-btns">
                  {STYLES.map(s=>(
                    <button key={s.value} className={`style-btn${ridingStyle===s.value?' act':''}`} onClick={()=>setRidingStyle(s.value)}>
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="billing-history-row">
                  <span>Billing History</span>
                  <span className="billing-history-val">{isPro ? 'View invoices →' : 'No invoices yet'}</span>
                </div>
                <div style={{padding:'0 18px 14px'}}>
                  <button className="form-btn teal" style={{width:'100%',padding:'10px'}} onClick={saveProfile} disabled={saving}>
                    {saving ? 'Saving…' : 'Save Preferences'}
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT COL */}
            <div className="col">
              {/* Billing Card */}
              <div className="card">
                <div className="card-title">Billing</div>
                <div className="bill-toggle">
                  <button className={`bill-tab${billing==='monthly'?' act':''}`} onClick={()=>setBilling('monthly')}>Monthly</button>
                  <button className={`bill-tab${billing==='yearly'?' act':''}`}  onClick={()=>setBilling('yearly')}>Yearly</button>
                  <span className="save-tag">Save 33%</span>
                </div>
                <div className="plan-name">{isPro ? 'Pro' : 'Free'}</div>
                <div className="plan-price">
                  <strong>{isPro ? (billing==='monthly'?'$9.99':'$8.25') : '$0'}</strong> / month
                  {isPro && billing==='yearly' && <span style={{display:'block',fontSize:12,color:'var(--teal)',marginTop:2}}>$99.00 billed yearly</span>}
                </div>
                {!isPro && (
                  <div className="plan-row">
                    <div className="plan-access">3 Resorts saved</div>
                    <button className="upgrade-btn" onClick={handleUpgrade} disabled={upgrading}>
                      {upgrading ? '…' : 'Upgrade Plan'}
                    </button>
                  </div>
                )}
                <div className="bill-action-row">
                  <button className="bill-action" onClick={handlePortal} disabled={portalLoad}>
                    📊 {portalLoad?'…':'Manage Billing'}
                  </button>
                  <button className="bill-action" onClick={handlePortal} disabled={portalLoad}>
                    ⬇ Download Invoices
                  </button>
                </div>
              </div>

              {/* Notification Settings */}
              <div className="card">
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 18px 10px'}}>
                  <span style={{fontSize:15,fontWeight:700,color:'var(--text)'}}>Notification Settings</span>
                  <label className="toggle">
                    <input type="checkbox" checked={notifs.email&&notifs.sms} onChange={e=>setNotifs(p=>({...p,email:e.target.checked,sms:e.target.checked}))}/>
                    <div className="toggle-track"><div className="toggle-thumb"/></div>
                  </label>
                </div>
                <div className="notif-settings">
                  {[
                    { key:'email',     label:'Email powder alerts' },
                    { key:'sms',       label:'SMS powder alerts' },
                    { key:'weekly',    label:'Weekly snow report' },
                    { key:'newResort', label:'New resort alerts' },
                  ].map(n=>(
                    <div className="notif-row" key={n.key}>
                      <span className="notif-check">✓</span>
                      <span className="notif-label">{n.label}</span>
                      <label className="toggle">
                        <input type="checkbox" checked={notifs[n.key as keyof typeof notifs]} onChange={e=>setNotifs(p=>({...p,[n.key]:e.target.checked}))}/>
                        <div className="toggle-track"><div className="toggle-thumb"/></div>
                      </label>
                    </div>
                  ))}
                </div>
                <button className="delete-btn" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Delete Account'}
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
