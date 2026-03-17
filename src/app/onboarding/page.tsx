'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

const STYLES = [
  { value: 'powder',       label: 'Powder Hunter',     emoji: '❄️', desc: 'Fresh snow is everything' },
  { value: 'all_mountain', label: 'All Mountain',       emoji: '🏔️', desc: 'Versatile skier/rider' },
  { value: 'freestyle',    label: 'Freestyle / Park',   emoji: '🛹', desc: 'Jumps, rails, terrain parks' },
  { value: 'beginner',     label: 'Learning / Groomer', emoji: '🎿', desc: 'Greens & blues, smooth runs' },
];

const LEVELS = [
  { value: 'beginner',     label: 'Beginner',      desc: 'Just starting out' },
  { value: 'intermediate', label: 'Intermediate',  desc: 'Comfortable on most runs' },
  { value: 'expert',       label: 'Expert',        desc: 'Blacks & double-blacks' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [name,    setName]    = useState('');
  const [style,   setStyle]   = useState('all_mountain');
  const [skill,   setSkill]   = useState('intermediate');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { router.push('/auth/login'); return; }

    const res = await fetch('/api/me/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ displayName: name || undefined, style, skillLevel: skill }),
    });

    if (!res.ok) { setError('Failed to save profile. Please try again.'); setLoading(false); return; }
    router.push('/dashboard');
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        :root{
          --blue:#1d6ef5;--blue-lt:#e8f1fe;
          --text:#0d1b2e;--text2:#3d5166;--text3:#6b849a;
          --bd:rgba(100,150,200,0.15);--bd2:rgba(100,150,200,0.25);
          --bg:#f0f5fb;--white:#ffffff;
          --sh:0 2px 12px rgba(15,40,80,0.08);--sh-lg:0 8px 32px rgba(15,40,80,0.12);
        }
        html,body{min-height:100%;background:#f0f5fb !important;font-family:'Inter',sans-serif;color:var(--text);}
        .page{min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:40px 16px 60px;}
        .logo{display:flex;align-items:center;margin-bottom:32px;text-decoration:none;}
        .logo img{height:44px;width:auto;filter:drop-shadow(0 4px 12px rgba(20,60,150,0.2));}
        .card{background:var(--white);border:1px solid var(--bd2);border-radius:16px;padding:36px 32px;width:100%;max-width:520px;box-shadow:var(--sh-lg);}
        .title{font-size:24px;font-weight:800;color:var(--text);text-align:center;margin-bottom:6px;}
        .subtitle{font-size:14px;color:var(--text3);text-align:center;margin-bottom:28px;}
        .error{background:#fef2f2;border:1px solid rgba(239,68,68,0.3);color:#dc2626;border-radius:10px;padding:10px 14px;font-size:13px;margin-bottom:20px;}
        .section{margin-bottom:24px;}
        .section-label{font-size:13px;font-weight:600;color:var(--text2);margin-bottom:10px;display:block;}
        .name-input{width:100%;padding:11px 14px;border:1.5px solid var(--bd2);border-radius:10px;font-size:14px;font-family:'Inter',sans-serif;color:var(--text);background:var(--bg);outline:none;transition:border-color .15s;}
        .name-input:focus{border-color:var(--blue);background:var(--white);}
        .name-input::placeholder{color:var(--text3);}
        .style-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
        .style-card{border:2px solid var(--bd2);border-radius:12px;padding:14px;cursor:pointer;transition:border-color .15s,background .15s;background:var(--white);}
        .style-card.act{border-color:var(--blue);background:var(--blue-lt);}
        .style-card:hover:not(.act){border-color:rgba(29,110,245,0.3);background:var(--bg);}
        .style-emoji{font-size:24px;margin-bottom:6px;}
        .style-name{font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px;}
        .style-desc{font-size:11.5px;color:var(--text3);}
        .level-row{display:flex;gap:10px;}
        .level-card{flex:1;border:2px solid var(--bd2);border-radius:10px;padding:12px 10px;cursor:pointer;text-align:center;transition:border-color .15s,background .15s;background:var(--white);}
        .level-card.act{border-color:var(--blue);background:var(--blue-lt);}
        .level-card:hover:not(.act){border-color:rgba(29,110,245,0.3);background:var(--bg);}
        .level-name{font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px;}
        .level-desc{font-size:11px;color:var(--text3);}
        .submit-btn{width:100%;padding:14px;border-radius:10px;border:none;background:var(--blue);color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;margin-top:8px;transition:filter .15s;}
        .submit-btn:hover:not(:disabled){filter:brightness(1.07);}
        .submit-btn:disabled{opacity:.55;cursor:not-allowed;}
        .skip{display:block;text-align:center;margin-top:14px;font-size:13px;color:var(--text3);text-decoration:none;}
        .skip:hover{color:var(--text2);}
      `}</style>

      <div className="page">
        <Link href="/" className="logo">
          <img src="/brand/powderiq_logo.png" alt="PowderIQ" />
        </Link>

        <div className="card">
          <h1 className="title">Set up your profile</h1>
          <p className="subtitle">Help us personalize your powder scores.</p>

          <form onSubmit={handleSubmit} aria-label="Profile setup form">
            {error && <div className="error" role="alert">{error}</div>}

            {/* Name */}
            <div className="section">
              <label className="section-label" htmlFor="displayName">
                Your name <span style={{color:'var(--text3)',fontWeight:400}}>(optional)</span>
              </label>
              <input
                id="displayName" className="name-input" type="text"
                value={name} onChange={e=>setName(e.target.value)}
                maxLength={50} placeholder="Shredder McPow"
              />
            </div>

            {/* Riding style */}
            <div className="section">
              <span className="section-label">Riding style</span>
              <div className="style-grid">
                {STYLES.map(s=>(
                  <div key={s.value} className={`style-card${style===s.value?' act':''}`} onClick={()=>setStyle(s.value)} role="radio" aria-checked={style===s.value} tabIndex={0} onKeyDown={e=>e.key==='Enter'&&setStyle(s.value)}>
                    <div className="style-emoji">{s.emoji}</div>
                    <div className="style-name">{s.label}</div>
                    <div className="style-desc">{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Skill level */}
            <div className="section">
              <span className="section-label">Skill level</span>
              <div className="level-row">
                {LEVELS.map(l=>(
                  <div key={l.value} className={`level-card${skill===l.value?' act':''}`} onClick={()=>setSkill(l.value)} role="radio" aria-checked={skill===l.value} tabIndex={0} onKeyDown={e=>e.key==='Enter'&&setSkill(l.value)}>
                    <div className="level-name">{l.label}</div>
                    <div className="level-desc">{l.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Saving…' : 'Go to Dashboard →'}
            </button>
          </form>

          <Link href="/dashboard" className="skip">Skip for now →</Link>
        </div>
      </div>
    </>
  );
}
