'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const { data: session } = await supabase.auth.getSession();
    await fetch('/api/me', {
      headers: { Authorization: `Bearer ${session.session?.access_token}` },
    });

    router.push('/dashboard');
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Serif+Display:ital@0;1&display=swap');

        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }

        .login-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          font-family: 'DM Sans', system-ui, sans-serif;
          position: relative;
          overflow: hidden;
        }

        .login-bg {
          position: fixed;
          inset: 0;
          background-image: url('https://images.unsplash.com/photo-1612886683694-83b12afef9c7?w=1600&q=85');
          background-size: cover;
          background-position: center 30%;
          z-index: 0;
        }
        .login-bg::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            160deg,
            rgba(210,228,248,0.50) 0%,
            rgba(185,212,242,0.40) 40%,
            rgba(200,220,245,0.45) 100%
          );
        }

        .login-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
          background: rgba(255,255,255,0.84);
          backdrop-filter: blur(28px) saturate(1.8);
          -webkit-backdrop-filter: blur(28px) saturate(1.8);
          border: 1px solid rgba(255,255,255,0.92);
          border-radius: 24px;
          padding: 40px 36px 36px;
          box-shadow:
            0 8px 48px rgba(70,110,180,0.16),
            0 2px 8px rgba(70,110,180,0.10),
            inset 0 1px 0 rgba(255,255,255,0.98);
          animation: cardIn 0.5s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes cardIn {
          from { opacity:0; transform:translateY(20px) scale(0.98); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }

        .logo-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 24px;
        }
        .logo-badge {
          width: 90px;
          height: 90px;
          filter: drop-shadow(0 6px 20px rgba(20,60,150,0.28));
          animation: logoIn 0.55s cubic-bezier(0.22,1,0.36,1) 0.08s both;
        }
        @keyframes logoIn {
          from { opacity:0; transform:translateY(-14px) scale(0.88); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }

        .login-title {
          font-family: 'DM Serif Display', Georgia, serif;
          font-size: 30px;
          font-weight: 400;
          color: #18304e;
          text-align: center;
          margin-bottom: 6px;
          letter-spacing: -0.01em;
        }
        .login-sub {
          font-size: 14px;
          color: #5a7a98;
          text-align: center;
          margin-bottom: 28px;
          font-weight: 400;
          line-height: 1.5;
        }
        .login-sub em {
          font-style: italic;
          font-weight: 700;
          color: #2860b8;
        }

        .error-box {
          background: rgba(220,50,50,0.07);
          border: 1px solid rgba(220,50,50,0.22);
          color: #c0182a;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13px;
          margin-bottom: 18px;
          animation: shake 0.32s ease;
        }
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          25%{transform:translateX(-5px)}
          75%{transform:translateX(5px)}
        }

        .field { margin-bottom: 16px; }
        .field-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 7px;
        }
        label {
          font-size: 13px;
          font-weight: 600;
          color: #263d58;
          letter-spacing: 0.005em;
        }
        .forgot-link {
          font-size: 12px;
          color: #5080c0;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.15s;
        }
        .forgot-link:hover { color: #2860b8; }
        .forgot-link:focus-visible { outline: 2px solid #4a8ee0; border-radius: 3px; }

        .input-wrap { position: relative; }

        input[type="email"],
        input[type="password"],
        input[type="text"] {
          width: 100%;
          background: rgba(238,246,255,0.75);
          border: 1.5px solid rgba(170,205,238,0.9);
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 15px;
          font-family: 'DM Sans', system-ui, sans-serif;
          color: #18304e;
          outline: none;
          transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
          -webkit-appearance: none;
        }
        input::placeholder { color: #9ab8d4; }
        input:focus {
          border-color: #4a8ee0;
          background: rgba(255,255,255,0.97);
          box-shadow: 0 0 0 3px rgba(74,142,224,0.14);
        }
        input[type="password"],
        input[type="text"] { padding-right: 48px; }

        .pw-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #80a0c0;
          padding: 4px;
          display: flex;
          align-items: center;
          border-radius: 6px;
          transition: color 0.15s;
          line-height: 0;
        }
        .pw-toggle:hover { color: #2860b8; }
        .pw-toggle:focus-visible { outline: 2px solid #4a8ee0; outline-offset: 2px; }

        .submit-btn {
          width: 100%;
          padding: 14px;
          margin-top: 8px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #5295ec 0%, #2d6fd4 55%, #1a52b0 100%);
          color: #fff;
          font-size: 16px;
          font-weight: 700;
          font-family: 'DM Sans', system-ui, sans-serif;
          cursor: pointer;
          letter-spacing: 0.02em;
          transition: filter 0.18s, transform 0.14s, box-shadow 0.18s;
          box-shadow: 0 4px 18px rgba(40,100,200,0.38), 0 1px 3px rgba(40,100,200,0.18);
          position: relative;
          overflow: hidden;
        }
        .submit-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.13) 0%, transparent 60%);
          pointer-events: none;
        }
        .submit-btn:hover:not(:disabled) {
          filter: brightness(1.07);
          transform: translateY(-1px);
          box-shadow: 0 7px 24px rgba(40,100,200,0.46);
        }
        .submit-btn:active:not(:disabled) { transform:translateY(0); filter:brightness(0.96); }
        .submit-btn:disabled { opacity:0.62; cursor:not-allowed; transform:none; }
        .submit-btn:focus-visible { outline:3px solid #4a8ee0; outline-offset:3px; }

        .btn-inner { display:flex; align-items:center; justify-content:center; gap:8px; }
        .spinner {
          width:16px; height:16px;
          border:2.5px solid rgba(255,255,255,0.38);
          border-top-color:#fff;
          border-radius:50%;
          animation:spin 0.65s linear infinite;
          flex-shrink:0;
        }
        @keyframes spin { to { transform:rotate(360deg); } }

        .signup-row {
          text-align:center;
          margin-top:22px;
          font-size:14px;
          color:#6888a8;
        }
        .signup-row a {
          color:#2860b8;
          font-weight:700;
          text-decoration:none;
          transition:color 0.15s;
        }
        .signup-row a:hover { color:#1a4898; }
        .signup-row a:focus-visible { outline:2px solid #4a8ee0; border-radius:3px; }
      `}</style>

      <div className="login-root">
        <div className="login-bg" aria-hidden="true" />

        <div className="login-card" role="main">
          {/* Shield Logo */}
          <div className="logo-wrap">
            <Link href="/" aria-label="PowderIQ home">
              <svg className="logo-badge" viewBox="0 0 120 132" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <defs>
                  <linearGradient id="lg-shield" x1="0" y1="0" x2="0" y2="132" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#1c3d82"/>
                    <stop offset="100%" stopColor="#0e2354"/>
                  </linearGradient>
                  <linearGradient id="lg-sky" x1="15" y1="18" x2="105" y2="88" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#b8d8f0"/>
                    <stop offset="45%" stopColor="#88c8ec"/>
                    <stop offset="100%" stopColor="#a8dfc0"/>
                  </linearGradient>
                  <linearGradient id="lg-banner" x1="0" y1="84" x2="0" y2="118" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#1c3d82"/>
                    <stop offset="100%" stopColor="#0e2354"/>
                  </linearGradient>
                  <clipPath id="shield-clip">
                    <path d="M60 6 L110 26 L110 74 C110 100 60 122 60 122 C60 122 10 100 10 74 L10 26 Z"/>
                  </clipPath>
                </defs>
                {/* Shield base */}
                <path d="M60 6 L110 26 L110 74 C110 100 60 122 60 122 C60 122 10 100 10 74 L10 26 Z"
                  fill="url(#lg-shield)" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"/>
                {/* Sky fill */}
                <rect x="10" y="26" width="100" height="96" fill="url(#lg-sky)" clipPath="url(#shield-clip)"/>
                {/* Mountains */}
                <g clipPath="url(#shield-clip)">
                  {/* Back mountains */}
                  <polygon points="35,70 20,75 50,75" fill="rgba(200,220,240,0.6)"/>
                  <polygon points="88,68 70,75 106,75" fill="rgba(200,220,240,0.6)"/>
                  {/* Main center peak */}
                  <polygon points="60,28 92,75 28,75" fill="#fff" opacity="0.96"/>
                  {/* Snow shadow on main */}
                  <polygon points="60,28 74,55 46,55" fill="rgba(220,236,250,0.55)"/>
                  {/* Left peak */}
                  <polygon points="36,46 58,75 14,75" fill="#fff" opacity="0.88"/>
                  <polygon points="36,46 44,60 28,60" fill="rgba(220,236,250,0.5)"/>
                  {/* Right peak */}
                  <polygon points="87,50 106,75 68,75" fill="#fff" opacity="0.84"/>
                  <polygon points="87,50 94,62 80,62" fill="rgba(220,236,250,0.5)"/>
                  {/* Snow base line */}
                  <rect x="10" y="72" width="100" height="6" fill="rgba(255,255,255,0.55)"/>
                </g>
                {/* Banner */}
                <path d="M10 80 L110 80 L110 108 C110 118 86 122 60 122 C34 122 10 118 10 108 Z"
                  fill="url(#lg-banner)" clipPath="url(#shield-clip)"/>
                <text x="60" y="107" textAnchor="middle" fill="white" fontSize="13" fontWeight="800"
                  fontFamily="DM Sans, system-ui, sans-serif" letterSpacing="1">PowderIQ</text>
                {/* Rim highlight */}
                <path d="M60 6 L110 26 L110 74 C110 100 60 122 60 122 C60 122 10 100 10 74 L10 26 Z"
                  fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="2"/>
                {/* Top highlight */}
                <path d="M60 6 L110 26 L100 26 L60 10 L20 26 L10 26 Z"
                  fill="rgba(255,255,255,0.12)"/>
              </svg>
            </Link>
          </div>

          <h1 className="login-title">Welcome Back</h1>
          <p className="login-sub">Log in and find the <em>best</em> snow.</p>

          <form onSubmit={handleSubmit} noValidate aria-label="Sign in form">
            {error && (
              <div role="alert" className="error-box">{error}</div>
            )}

            <div className="field">
              <div className="field-header">
                <label htmlFor="email">Email address</label>
              </div>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>

            <div className="field">
              <div className="field-header">
                <label htmlFor="password">Password</label>
                <Link href="/auth/forgot-password" className="forgot-link">
                  Forgot password?
                </Link>
              </div>
              <div className="input-wrap">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPw(v => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="submit-btn">
              <span className="btn-inner">
                {loading && <span className="spinner" aria-hidden="true" />}
                {loading ? 'Signing in…' : 'Log In'}
              </span>
            </button>
          </form>

          <p className="signup-row">
            Don&apos;t have an account? <Link href="/auth/signup">Sign Up</Link>
          </p>
        </div>
      </div>
    </>
  );
}
