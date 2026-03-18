'use client';
import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Serif+Display:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        .page { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px 16px; font-family:'DM Sans',system-ui,sans-serif; position:relative; overflow:hidden; }
        .bg { position:fixed; inset:0; background-image:url('/brand/auth-bg.jpg'); background-size:cover; background-position:center 30%; z-index:0; }
        .bg::after { content:''; position:absolute; inset:0; background:linear-gradient(160deg,rgba(210,228,248,0.50) 0%,rgba(185,212,242,0.40) 40%,rgba(200,220,245,0.45) 100%); }
        .card { position:relative; z-index:1; width:100%; max-width:420px; background:rgba(255,255,255,0.84); backdrop-filter:blur(28px) saturate(1.8); -webkit-backdrop-filter:blur(28px) saturate(1.8); border:1px solid rgba(255,255,255,0.92); border-radius:24px; padding:40px 36px 36px; box-shadow:0 8px 48px rgba(70,110,180,0.16),0 2px 8px rgba(70,110,180,0.10),inset 0 1px 0 rgba(255,255,255,0.98); animation:cardIn 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes cardIn { from{opacity:0;transform:translateY(20px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)} }
        .logo-wrap { display:flex; justify-content:center; margin-bottom:20px; }
        .logo-img { width:110px; height:auto; filter:drop-shadow(0 6px 20px rgba(20,60,150,0.28)); }
        .title { font-family:'DM Serif Display',Georgia,serif; font-size:28px; font-weight:400; color:#18304e; text-align:center; margin-bottom:8px; letter-spacing:-0.01em; }
        .sub { font-size:14px; color:#5a7a98; text-align:center; margin-bottom:28px; line-height:1.5; }
        .error-box { background:rgba(220,50,50,0.07); border:1px solid rgba(220,50,50,0.22); color:#c0182a; border-radius:10px; padding:10px 14px; font-size:13px; margin-bottom:18px; }
        .success-box { background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.3); color:#15803d; border-radius:10px; padding:16px; font-size:14px; margin-bottom:18px; line-height:1.5; }
        .field { margin-bottom:18px; }
        label { display:block; font-size:13px; font-weight:600; color:#263d58; margin-bottom:7px; }
        input { width:100%; background:rgba(238,246,255,0.75); border:1.5px solid rgba(170,205,238,0.9); border-radius:12px; padding:12px 16px; font-size:15px; font-family:'DM Sans',system-ui,sans-serif; color:#18304e; outline:none; transition:border-color 0.18s,box-shadow 0.18s; -webkit-appearance:none; }
        input::placeholder { color:#9ab8d4; }
        input:focus { border-color:#4a8ee0; background:rgba(255,255,255,0.97); box-shadow:0 0 0 3px rgba(74,142,224,0.14); }
        .submit-btn { width:100%; padding:14px; margin-top:4px; border-radius:12px; border:none; background:linear-gradient(135deg,#5295ec 0%,#2d6fd4 55%,#1a52b0 100%); color:#fff; font-size:16px; font-weight:700; font-family:'DM Sans',system-ui,sans-serif; cursor:pointer; transition:filter 0.18s,transform 0.14s; box-shadow:0 4px 18px rgba(40,100,200,0.38); }
        .submit-btn:hover:not(:disabled) { filter:brightness(1.07); transform:translateY(-1px); }
        .submit-btn:disabled { opacity:0.62; cursor:not-allowed; }
        .btn-inner { display:flex; align-items:center; justify-content:center; gap:8px; }
        .spinner { width:16px; height:16px; border:2.5px solid rgba(255,255,255,0.38); border-top-color:#fff; border-radius:50%; animation:spin 0.65s linear infinite; }
        @keyframes spin { to{transform:rotate(360deg)} }
        .back-row { text-align:center; margin-top:22px; font-size:14px; color:#6888a8; }
        .back-row a { color:#2860b8; font-weight:700; text-decoration:none; }
        .back-row a:hover { color:#1a4898; }
      `}</style>

      <div className="page">
        <div className="bg" aria-hidden="true" />
        <div className="card">
          <div className="logo-wrap">
            <Link href="/">
              <img src="/brand/powderiq_logo.png" alt="PowderIQ" className="logo-img" />
            </Link>
          </div>

          <h1 className="title">Reset Password</h1>
          <p className="sub">Enter your email and we'll send you a reset link.</p>

          {sent ? (
            <>
              <div className="success-box">
                ✓ Check your inbox — we sent a password reset link to <strong>{email}</strong>.
                If it doesn't appear within a minute, check your spam folder.
              </div>
              <p className="back-row"><Link href="/auth/login">← Back to Login</Link></p>
            </>
          ) : (
            <>
              <form onSubmit={handleSubmit} noValidate>
                {error && <div role="alert" className="error-box">{error}</div>}
                <div className="field">
                  <label htmlFor="email">Email address</label>
                  <input
                    id="email" type="email" autoComplete="email" required
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="name@example.com"
                  />
                </div>
                <button type="submit" disabled={loading || !email} className="submit-btn">
                  <span className="btn-inner">
                    {loading && <span className="spinner" aria-hidden="true" />}
                    {loading ? 'Sending…' : 'Send Reset Link'}
                  </span>
                </button>
              </form>
              <p className="back-row"><Link href="/auth/login">← Back to Login</Link></p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
