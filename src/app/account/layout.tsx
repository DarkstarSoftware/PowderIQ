// src/app/account/layout.tsx
// Shared layout for all /account/* pages
// Includes topnav (no Account tab, avatar links to /account) + left sidebar

'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --blue:#1d6ef5;--blue-lt:#e8f1fe;
  --text:#0d1b2e;--text2:#3d5166;--text3:#6b849a;
  --bd:rgba(100,150,200,0.15);--bd2:rgba(100,150,200,0.25);
  --bg:#f0f5fb;--white:#ffffff;
  --green:#22c55e;--green-bg:#f0fdf4;
  --sh:0 2px 12px rgba(15,40,80,0.08);
}
html,body{height:100%;background:#f0f5fb !important;font-family:'Inter',sans-serif;color:var(--text);font-size:14px;}
.tnav{position:sticky;top:0;z-index:100;height:56px;background:var(--white);border-bottom:1px solid var(--bd2);display:flex;align-items:center;padding:0 20px;gap:10px;box-shadow:var(--sh);}
.tnav-logo{display:flex;align-items:center;gap:8px;text-decoration:none;flex-shrink:0;}
.tnav-logo img{height:32px;width:auto;}
.tnav-brand{font-size:17px;font-weight:800;color:#0d1b2e;letter-spacing:-0.03em;}
.tnav-tabs{display:flex;align-items:center;gap:2px;flex:1;}
.tnav-tab{display:flex;align-items:center;gap:5px;padding:6px 14px;border-radius:8px;font-size:13px;font-weight:600;color:var(--text3);text-decoration:none;white-space:nowrap;transition:background .15s,color .15s;}
.tnav-tab:hover{background:var(--bg);color:var(--text);}
.tnav-tab.act{background:var(--blue-lt);color:var(--blue);}
.tnav-right{display:flex;align-items:center;gap:6px;margin-left:auto;flex-shrink:0;}
.api-badge{display:flex;align-items:center;gap:5px;padding:4px 10px;background:var(--green-bg);border:1px solid rgba(34,197,94,0.3);border-radius:16px;font-size:11.5px;font-weight:600;color:#15803d;}
.api-dot{width:6px;height:6px;background:var(--green);border-radius:50%;}
.tnav-av{width:32px;height:32px;border-radius:50%;background:var(--blue);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;text-decoration:none;transition:box-shadow .15s;}
.tnav-av:hover{box-shadow:0 0 0 3px rgba(29,110,245,0.25);}
.tnav-av img{width:100%;height:100%;object-fit:cover;}
.tnav-out{font-size:13px;font-weight:600;color:var(--text2);cursor:pointer;background:none;border:none;font-family:'Inter',sans-serif;}
.tnav-out:hover{color:var(--text);}
.shell{display:flex;height:calc(100vh - 56px);overflow:hidden;}
.sidebar{width:200px;flex-shrink:0;background:var(--white);border-right:1px solid var(--bd2);overflow-y:auto;padding:16px 8px;}
.sb-section-lbl{font-size:10px;font-weight:700;color:var(--text3);letter-spacing:.07em;text-transform:uppercase;padding:0 10px 6px;margin-top:8px;}
.sb-link{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:9px;font-size:13px;font-weight:500;color:var(--text2);text-decoration:none;transition:background .15s,color .15s;margin:1px 0;}
.sb-link:hover{background:var(--bg);color:var(--text);}
.sb-link.act{background:var(--blue-lt);color:var(--blue);font-weight:600;}
.sb-icon{font-size:14px;width:18px;text-align:center;flex-shrink:0;}
.main-scroll{flex:1;overflow-y:auto;background:var(--bg);}
.hero{height:180px;overflow:hidden;flex-shrink:0;}
.hero img{width:100%;height:100%;object-fit:cover;object-position:center 35%;}
.page-header{padding:20px 28px 0;}
.page-title{font-size:20px;font-weight:800;color:var(--text);}
.page-sub{font-size:13px;color:var(--text3);margin-top:3px;}
.page-content{padding:20px 28px 48px;}
@media(max-width:768px){.sidebar{display:none;}}
@media(max-width:640px){.tnav-tabs{display:none;}}
`;

const NAV_LINKS = [
  { href: '/account/profile',       label: 'Profile',        icon: '🪪' },
  { href: '/account/security',      label: 'Security',       icon: '🔒' },
  { href: '/account/billing',       label: 'Billing',        icon: '💳' },
  { href: '/account/notifications', label: 'Notifications',  icon: '🔔' },
  { href: '/account/preferences',   label: 'Preferences',    icon: '⚙️' },
  { href: '/account/privacy',       label: 'Data & Privacy', icon: '🛡️' },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const [email,   setEmail]   = useState('');
  const [avatar,  setAvatar]  = useState('');
  const [role,    setRole]    = useState('user');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push('/auth/login'); return; }
      setEmail(data.session.user?.email || '');

      // Check localStorage first for instant display
      const cached = localStorage.getItem('powderiq_avatar');
      if (cached) setAvatar(cached);

      const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${data.session.access_token}` } });
      if (res.ok) {
        const me = await res.json();
        setRole(me.data?.role || 'user');
        const url = me.data?.profile?.avatarUrl || '';
        if (url) {
          setAvatar(url);
          localStorage.setItem('powderiq_avatar', url);
        }
      }
    })();

    // Listen for avatar changes triggered by profile page
    function onAvatarChanged() {
      const url = localStorage.getItem('powderiq_avatar') || '';
      setAvatar(url);
    }
    window.addEventListener('powderiq_avatar_changed', onAvatarChanged);
    return () => window.removeEventListener('powderiq_avatar_changed', onAvatarChanged);
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  const avatarLetter = email?.[0]?.toUpperCase() || 'U';

  return (
    <>
      <style>{CSS}</style>
      <nav className="tnav">
        <Link href="/dashboard" className="tnav-logo">
          <img src="/brand/powderiq_logo.png" alt="PowderIQ" />
          <span className="tnav-brand">PowderIQ</span>
        </Link>
        <div className="tnav-tabs">
          <Link href="/dashboard" className="tnav-tab">📊 Dashboard</Link>
          <Link href="/mountains" className="tnav-tab">🏔️ Resorts</Link>
          <Link href="/forecasts"  className="tnav-tab">📅 Forecasts</Link>
        </div>
        <div className="tnav-right">
          <div className="api-badge"><div className="api-dot"/>API Connected</div>
          <Link href="/account/profile" className="tnav-av" aria-label="Account settings">
            {avatar ? <img src={avatar} alt="avatar"/> : avatarLetter}
          </Link>
          <button className="tnav-out" onClick={signOut}>Sign out</button>
        </div>
      </nav>

      <div className="shell">
        <aside className="sidebar">
          <div className="sb-section-lbl">Account</div>
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} className={`sb-link${pathname === l.href ? ' act' : ''}`}>
              <span className="sb-icon">{l.icon}</span>
              {l.label}
            </Link>
          ))}
        </aside>

        <div className="main-scroll">
          <div className="hero">
            <img src="/brand/auth-bg.jpg" alt="" />
          </div>
          {children}
        </div>
      </div>
    </>
  );
}
