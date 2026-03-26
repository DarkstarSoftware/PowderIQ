// src/components/TopNav.tsx
// Universal navigation bar for all consumer pages.
// Handles its own auth state, avatar, hasResort, role — 
// each page just passes its active tab name.

'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export type NavTab = 'dashboard' | 'mountains' | 'forecasts' | 'analytics' | 'alerts';

interface Props {
  active: NavTab;
}

export default function TopNav({ active }: Props) {
  const router = useRouter();
  const [userName,  setUserName]  = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [userRole,  setUserRole]  = useState('user');
  const [hasResort, setHasResort] = useState(false);
  const [isPro,     setIsPro]     = useState(false);

  useEffect(() => {
    (async () => {
      // Try avatar from localStorage immediately (avoids flash)
      const cachedAvatar = localStorage.getItem('powderiq_avatar');
      if (cachedAvatar) setAvatarUrl(cachedAvatar);

      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const tok = data.session.access_token;

      try {
        const res = await fetch('/api/me', {
          headers: { Authorization: `Bearer ${tok}` },
        });
        if (!res.ok) return;
        const me = await res.json();
        const role = me.data?.role ?? 'user';
        setUserName(me.data?.profile?.displayName ?? '');
        setUserRole(role);
        setHasResort(!!me.data?.hasResort);

        const subStatus = me.data?.subscription?.status;
        setIsPro(role === 'pro_user' || role === 'admin' ||
                 subStatus === 'active' || subStatus === 'trialing');

        const url = me.data?.profile?.avatarUrl ?? '';
        if (url) {
          setAvatarUrl(url);
          localStorage.setItem('powderiq_avatar', url);
        }
      } catch (_) {}
    })();

    function onAvatarChanged() {
      setAvatarUrl(localStorage.getItem('powderiq_avatar') ?? '');
    }
    window.addEventListener('powderiq_avatar_changed', onAvatarChanged);
    return () => window.removeEventListener('powderiq_avatar_changed', onAvatarChanged);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/');
  }

  const isAdmin = userRole === 'admin';

  return (
    <>
      <style>{`
        .piq-nav {
          position: sticky; top: 0; z-index: 100;
          height: 56px; background: #ffffff;
          border-bottom: 1px solid rgba(100,150,200,0.15);
          display: flex; align-items: center;
          padding: 0 20px; gap: 4px;
          box-shadow: 0 1px 6px rgba(15,40,80,0.07);
        }
        .piq-nav-logo {
          display: flex; align-items: center; gap: 8px;
          text-decoration: none; flex-shrink: 0; margin-right: 8px;
        }
        .piq-nav-logo img { height: 28px; width: auto; }
        .piq-nav-brand {
          font-size: 16px; font-weight: 800;
          color: #0d1b2e; letter-spacing: -0.03em;
        }
        .piq-nav-tabs {
          display: flex; align-items: center;
          gap: 2px; flex: 1; overflow-x: auto;
        }
        .piq-nav-tab {
          display: flex; align-items: center; gap: 5px;
          padding: 6px 12px; border-radius: 8px;
          font-size: 13px; font-weight: 600;
          color: #6b849a; text-decoration: none;
          white-space: nowrap; transition: all .15s;
          border: none; background: transparent;
          font-family: inherit; cursor: pointer;
        }
        .piq-nav-tab:hover { background: #f0f5fb; color: #0d1b2e; }
        .piq-nav-tab.act {
          background: #e8f1fe; color: #1d6ef5;
        }
        .piq-nav-right {
          display: flex; align-items: center;
          gap: 8px; margin-left: auto; flex-shrink: 0;
        }
        .piq-nav-resort {
          display: flex; align-items: center; gap: 5px;
          padding: 5px 11px; border-radius: 8px;
          background: #e8f1fe; color: #1d6ef5;
          font-size: 12px; font-weight: 700;
          text-decoration: none;
          border: 1px solid rgba(29,110,245,0.2);
          white-space: nowrap; transition: background .15s;
        }
        .piq-nav-resort:hover { background: #d4e5fd; }
        .piq-nav-signout {
          font-size: 12px; font-weight: 600;
          color: #6b849a; background: none;
          border: 1px solid rgba(100,150,200,0.2);
          cursor: pointer; padding: 5px 11px;
          border-radius: 8px; font-family: inherit;
          transition: all .15s; white-space: nowrap;
        }
        .piq-nav-signout:hover { background: #f0f5fb; color: #0d1b2e; }
        .piq-nav-av {
          width: 32px; height: 32px; border-radius: 50%;
          background: linear-gradient(135deg,#1d6ef5,#3b82f6);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; color: #fff;
          border: 2px solid rgba(100,150,200,0.2);
          overflow: hidden; text-decoration: none; flex-shrink: 0;
        }
        .piq-nav-av img { width: 100%; height: 100%; object-fit: cover; }
        @media(max-width:700px) { .piq-nav-tabs { display: none; } }
      `}</style>

      <nav className="piq-nav">
        {/* Logo */}
        <Link href="/dashboard" className="piq-nav-logo">
          <img src="/brand/powderiq_logo.png" alt="PowderIQ"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span className="piq-nav-brand">PowderIQ</span>
        </Link>

        {/* Tabs */}
        <div className="piq-nav-tabs">
          <Link href="/dashboard"  className={`piq-nav-tab${active==='dashboard'  ? ' act' : ''}`}>📊 Dashboard</Link>
          <Link href="/mountains"  className={`piq-nav-tab${active==='mountains'  ? ' act' : ''}`}>🏔️ Resorts</Link>
          <Link href="/forecasts"  className={`piq-nav-tab${active==='forecasts'  ? ' act' : ''}`}>🌨️ Forecasts</Link>
          {(isPro || isAdmin) && (
            <Link href="/compare"  className={`piq-nav-tab${active==='analytics'  ? ' act' : ''}`}>📈 Analytics</Link>
          )}
          {(isPro || isAdmin) && (
            <Link href="/alerts"   className={`piq-nav-tab${active==='alerts'     ? ' act' : ''}`}>🔔 Alerts</Link>
          )}
          {isAdmin && (
            <Link href="/admin"    className="piq-nav-tab">🛠 Admin</Link>
          )}
        </div>

        {/* Right side */}
        <div className="piq-nav-right">
          {hasResort && (
            <Link href="/resort/dashboard" className="piq-nav-resort">
              🎿 Resort
            </Link>
          )}
          <button className="piq-nav-signout" onClick={handleSignOut}>
            Sign out
          </button>
          <Link href="/account/profile" className="piq-nav-av" aria-label="Account">
            {avatarUrl
              ? <img src={avatarUrl} alt={userName || 'avatar'} />
              : (userName ? userName[0].toUpperCase() : '👤')}
          </Link>
        </div>
      </nav>
    </>
  );
}
