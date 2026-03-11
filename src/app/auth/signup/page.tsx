'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

const EyeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);
const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

export default function SignupPage() {
  const router = useRouter();
  const [fullName,    setFullName]    = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed,      setAgreed]      = useState(false);
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!agreed) {
      setError('Please agree to the Terms of Service to continue.');
      return;
    }

    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    router.push('/onboarding');
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Serif+Display:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }

        .auth-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          font-family: 'DM Sans', system-ui, sans-serif;
          position: relative;
          overflow: hidden;
        }
        .auth-bg {
          position: fixed;
          inset: 0;
          background-image: url('/brand/auth-bg.jpg');
          background-size: cover;
          background-position: center 30%;
          z-index: 0;
        }
        .auth-bg::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            160deg,
            rgba(210,228,248,0.52) 0%,
            rgba(185,212,242,0.42) 40%,
            rgba(200,220,245,0.48) 100%
          );
        }
        .auth-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 440px;
          background: rgba(255,255,255,0.84);
          backdrop-filter: blur(28px) saturate(1.8);
          -webkit-backdrop-filter: blur(28px) saturate(1.8);
          border: 1px solid rgba(255,255,255,0.92);
          border-radius: 24px;
          padding: 36px 36px 32px;
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

        /* Logo */
        .logo-wrap {
          display: flex;
          justify-content: center;
          margin-bottom: 20px;
          animation: logoIn 0.55s cubic-bezier(0.22,1,0.36,1) 0.08s both;
        }
        .logo-wrap a { display:block; line-height:0; }
        .logo-img {
          width: 110px;
          height: auto;
          filter: drop-shadow(0 6px 20px rgba(20,60,150,0.28));
        }
        @keyframes logoIn {
          from { opacity:0; transform:translateY(-14px) scale(0.88); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }

        /* Title */
        .auth-title {
          font-family: 'DM Serif Display', Georgia, serif;
          font-size: 28px;
          font-weight: 400;
          color: #18304e;
          text-align: center;
          margin-bottom: 5px;
          letter-spacing: -0.01em;
        }
        .auth-sub {
          font-size: 14px;
          color: #5a7a98;
          text-align: center;
          margin-bottom: 24px;
          line-height: 1.5;
        }
        .auth-sub strong {
          font-weight: 700;
          color: #2860b8;
        }

        /* Error */
        .error-box {
          background: rgba(220,50,50,0.07);
          border: 1px solid rgba(220,50,50,0.22);
          color: #c0182a;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13px;
          margin-bottom: 16px;
          animation: shake 0.32s ease;
        }
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          25%{transform:translateX(-5px)}
          75%{transform:translateX(5px)}
        }

        /* Fields */
        .field { margin-bottom: 14px; }
        .field-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #263d58;
          margin-bottom: 7px;
          letter-spacing: 0.005em;
        }
        .field-label svg { color: #7a9ab8; flex-shrink: 0; }

        .input-wrap { position: relative; }

        input[type="text"],
        input[type="email"],
        input[type="password"] {
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
        input[type="password"] { padding-right: 48px; }

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

        /* Password strength bar */
        .pw-strength {
          display: flex;
          gap: 4px;
          margin-top: 6px;
        }
        .pw-seg {
          flex: 1;
          height: 3px;
          border-radius: 2px;
          background: rgba(170,205,238,0.4);
          transition: background 0.3s;
        }
        .pw-seg.filled-weak   { background: #ef4444; }
        .pw-seg.filled-fair   { background: #f59e0b; }
        .pw-seg.filled-good   { background: #3b82f6; }
        .pw-seg.filled-strong { background: #16a34a; }

        /* Terms checkbox */
        .terms-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin: 16px 0 4px;
          cursor: pointer;
        }
        .terms-checkbox {
          width: 20px;
          height: 20px;
          border-radius: 6px;
          border: 1.5px solid rgba(170,205,238,0.9);
          background: rgba(238,246,255,0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 1px;
          transition: border-color 0.15s, background 0.15s;
          cursor: pointer;
        }
        .terms-checkbox.checked {
          background: #2860b8;
          border-color: #2860b8;
        }
        .terms-checkbox svg {
          width: 12px;
          height: 12px;
          color: white;
          opacity: 0;
          transform: scale(0.6);
          transition: opacity 0.15s, transform 0.15s;
        }
        .terms-checkbox.checked svg {
          opacity: 1;
          transform: scale(1);
        }
        .terms-text {
          font-size: 13px;
          color: #4a6880;
          line-height: 1.5;
          padding-top: 1px;
        }
        .terms-text a {
          color: #2860b8;
          font-weight: 600;
          text-decoration: none;
        }
        .terms-text a:hover { color: #1a4898; text-decoration: underline; }

        /* Submit */
        .submit-btn {
          width: 100%;
          padding: 14px;
          margin-top: 16px;
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

        /* Login link */
        .login-row {
          text-align: center;
          margin-top: 20px;
          font-size: 14px;
          color: #6888a8;
        }
        .login-row a {
          color: #2860b8;
          font-weight: 700;
          text-decoration: none;
          transition: color 0.15s;
        }
        .login-row a:hover { color: #1a4898; }
        .login-row a:focus-visible { outline: 2px solid #4a8ee0; border-radius: 3px; }
      `}</style>

      <div className="auth-root">
        <div className="auth-bg" aria-hidden="true" />

        <div className="auth-card" role="main">
          {/* Logo */}
          <div className="logo-wrap">
            <Link href="/" aria-label="PowderIQ home">
              <img
                src="/brand/powderiq_logo.png"
                alt="PowderIQ"
                className="logo-img"
              />
            </Link>
          </div>

          <h1 className="auth-title">Create an Account</h1>
          <p className="auth-sub">Sign up to find the <strong>best</strong> ski conditions.</p>

          <form onSubmit={handleSubmit} noValidate aria-label="Sign up form">
            {error && (
              <div role="alert" className="error-box">{error}</div>
            )}

            {/* Full Name */}
            <div className="field">
              <div className="field-label">
                <UserIcon />
                Full name
              </div>
              <input
                id="fullname"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="John Doe"
              />
            </div>

            {/* Email */}
            <div className="field">
              <label className="field-label" htmlFor="email">Email address</label>
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

            {/* Password */}
            <div className="field">
              <label className="field-label" htmlFor="password">Password</label>
              <div className="input-wrap">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="8+ characters"
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPw(v => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {/* Strength indicator */}
              {password.length > 0 && (() => {
                const len = password.length;
                const strength = len < 6 ? 1 : len < 8 ? 2 : len < 12 ? 3 : 4;
                const cls = ['', 'filled-weak', 'filled-fair', 'filled-good', 'filled-strong'][strength];
                return (
                  <div className="pw-strength" aria-hidden="true">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`pw-seg${i <= strength ? ` ${cls}` : ''}`} />
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Confirm Password */}
            <div className="field">
              <label className="field-label" htmlFor="confirm">Confirm password</label>
              <div className="input-wrap">
                <input
                  id="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  style={confirm.length > 0 ? {
                    borderColor: confirm === password ? 'rgba(22,163,74,0.6)' : 'rgba(220,50,50,0.5)',
                  } : undefined}
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowConfirm(v => !v)}
                  aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* Terms */}
            <div
              className="terms-row"
              onClick={() => setAgreed(v => !v)}
              role="checkbox"
              aria-checked={agreed}
              tabIndex={0}
              onKeyDown={e => (e.key === ' ' || e.key === 'Enter') && setAgreed(v => !v)}
            >
              <div className={`terms-checkbox${agreed ? ' checked' : ''}`} aria-hidden="true">
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2,6 5,9 10,3"/>
                </svg>
              </div>
              <span className="terms-text" onClick={e => e.stopPropagation()}>
                I agree to the{' '}
                <Link href="/terms" onClick={e => e.stopPropagation()}>Terms of Service</Link>
              </span>
            </div>

            <button type="submit" disabled={loading} className="submit-btn">
              <span className="btn-inner">
                {loading && <span className="spinner" aria-hidden="true" />}
                {loading ? 'Creating account…' : 'Sign Up'}
              </span>
            </button>
          </form>

          <p className="login-row">
            Already have an account? <Link href="/auth/login">Log In</Link>
          </p>
        </div>
      </div>
    </>
  );
}
