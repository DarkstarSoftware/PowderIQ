// src/app/account/profile/page.tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

const STYLES = [
  { value: 'powder',       label: 'Powder Hunter',     emoji: '❄️' },
  { value: 'all_mountain', label: 'All Mountain',       emoji: '🏔️' },
  { value: 'freestyle',    label: 'Freestyle / Park',   emoji: '🛹' },
  { value: 'beginner',     label: 'Learning / Groomer', emoji: '🎿' },
];
const LEVELS = [
  { value: 'beginner',     label: 'Beginner'     },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'expert',       label: 'Expert'       },
];

const CSS = `
.card{background:#fff;border:1px solid rgba(100,150,200,0.25);border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(15,40,80,0.08);margin-bottom:20px;}
.card-hd{font-size:15px;font-weight:700;color:#0d1b2e;padding:16px 20px;border-bottom:1px solid rgba(100,150,200,0.15);}
.card-body{padding:20px;}
.avatar-section{display:flex;align-items:center;gap:20px;margin-bottom:24px;}
.avatar-circle{width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#dbeafe,#bfdbfe);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#1d6ef5;overflow:hidden;flex-shrink:0;}
.avatar-circle img{width:100%;height:100%;object-fit:cover;}
.upload-btn{padding:7px 14px;background:#fff;border:1.5px solid rgba(100,150,200,0.25);border-radius:8px;font-size:12.5px;font-weight:600;color:#3d5166;cursor:pointer;font-family:'Inter',sans-serif;transition:background .15s;}
.upload-btn:hover{background:#f0f5fb;}
.avatar-hint{font-size:11.5px;color:#6b849a;margin-top:4px;}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;}
.form-row.full{grid-template-columns:1fr;}
.form-group{display:flex;flex-direction:column;gap:5px;}
.form-label{font-size:12px;font-weight:600;color:#6b849a;text-transform:uppercase;letter-spacing:.04em;}
.form-input{padding:10px 12px;border:1.5px solid rgba(100,150,200,0.25);border-radius:9px;font-size:13.5px;font-family:'Inter',sans-serif;color:#0d1b2e;background:#f0f5fb;outline:none;transition:border-color .15s;}
.form-input:focus{border-color:#1d6ef5;background:#fff;}
.style-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:6px;}
.style-btn{border:2px solid rgba(100,150,200,0.25);border-radius:10px;padding:12px 8px;cursor:pointer;background:#fff;text-align:center;transition:all .15s;}
.style-btn.act{border-color:#1d6ef5;background:#e8f1fe;}
.style-btn:hover:not(.act){border-color:rgba(29,110,245,0.3);background:#f0f5fb;}
.style-emoji{font-size:22px;margin-bottom:4px;}
.style-label{font-size:12px;font-weight:600;color:#0d1b2e;}
.level-row{display:flex;gap:10px;margin-top:6px;}
.level-btn{flex:1;border:2px solid rgba(100,150,200,0.25);border-radius:9px;padding:10px;cursor:pointer;background:#fff;text-align:center;font-size:13px;font-weight:600;color:#3d5166;transition:all .15s;}
.level-btn.act{border-color:#1d6ef5;background:#e8f1fe;color:#1d6ef5;}
.level-btn:hover:not(.act){border-color:rgba(29,110,245,0.3);background:#f0f5fb;}
.save-btn{padding:11px 28px;background:#1d6ef5;color:#fff;border:none;border-radius:9px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;transition:filter .15s;}
.save-btn:hover:not(:disabled){filter:brightness(1.08);}
.save-btn:disabled{opacity:.55;cursor:not-allowed;}
.success-msg{background:#f0fdf4;border:1px solid rgba(34,197,94,0.3);color:#15803d;border-radius:9px;padding:10px 14px;font-size:13px;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:7px;}
@media(max-width:640px){.form-row{grid-template-columns:1fr;}.style-grid{grid-template-columns:1fr 1fr;}}
`;

export default function ProfilePage() {
  const router  = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [token,    setToken]    = useState('');
  const [email,    setEmail]    = useState('');
  const [name,     setName]     = useState('');
  const [username, setUsername] = useState('');
  const [style,    setStyle]    = useState('all_mountain');
  const [skill,    setSkill]    = useState('intermediate');
  const [avatar,   setAvatar]   = useState('');
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [uploading,setUploading]= useState(false);
  const [uploadErr,setUploadErr]= useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push('/auth/login'); return; }
      const t = data.session.access_token;
      setToken(t); setEmail(data.session.user?.email || '');
      const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) {
        const me = await res.json();
        setName(me.data?.profile?.displayName || '');
        setUsername(me.data?.profile?.username || '');
        setStyle(me.data?.profile?.style || 'all_mountain');
        setSkill(me.data?.profile?.skillLevel || 'intermediate');
        setAvatar(me.data?.profile?.avatarUrl || '');
      }
    })();
  }, [router]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    if (!['image/jpeg','image/png','image/gif','image/webp'].includes(file.type)) {
      setUploadErr('Please select a JPG, PNG, GIF or WebP image.'); return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadErr('Image must be under 2MB.'); return;
    }

    setUploading(true); setUploadErr('');

    try {
      // Upload to Supabase Storage
      const ext      = file.name.split('.').pop();
      const fileName = `avatars/${token.slice(-12)}-${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(fileName, file, { upsert: true, contentType: file.type });

      if (uploadError) throw new Error(uploadError.message);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('user-avatars')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;
      setAvatar(publicUrl);
      // Persist to localStorage so topnav updates immediately across all pages
      localStorage.setItem('powderiq_avatar', publicUrl);
      window.dispatchEvent(new Event('powderiq_avatar_changed'));

      // Save to profile
      await fetch('/api/me/profile', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: publicUrl }),
      });
    } catch (err: any) {
      // Fallback: show local preview even if storage upload fails
      const localUrl = URL.createObjectURL(file);
      setAvatar(localUrl);
      setUploadErr('Photo saved locally. Storage upload failed: ' + (err.message || 'unknown error'));
    }

    setUploading(false);
    // Reset input so same file can be re-selected
    if (fileRef.current) fileRef.current.value = '';
  }

  async function save() {
    setSaving(true);
    const res = await fetch('/api/me/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: name, style, skillLevel: skill, avatarUrl: avatar || undefined }),
    });
    setSaving(false);
    if (res.ok) {
      // Persist avatar to localStorage so topnav reflects it immediately
      if (avatar) {
        localStorage.setItem('powderiq_avatar', avatar);
        window.dispatchEvent(new Event('powderiq_avatar_changed'));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }
    }
  }

  const avatarLetter = email?.[0]?.toUpperCase() || 'U';

  return (
    <>
      <style>{CSS}</style>
      <div style={{padding:'20px 28px 48px'}}>
        <div style={{marginBottom:20}}>
          <h1 style={{fontSize:20,fontWeight:800,color:'#0d1b2e'}}>Profile</h1>
          <p style={{fontSize:13,color:'#6b849a',marginTop:3}}>Manage your personal information and riding preferences.</p>
        </div>

        {saved && <div className="success-msg">✓ Profile saved successfully.</div>}

        {/* Avatar + basic info */}
        <div className="card">
          <div className="card-hd">Personal Information</div>
          <div className="card-body">
            <div className="avatar-section">
              <div className="avatar-circle">
                {avatar ? <img src={avatar} alt="avatar"/> : avatarLetter}
              </div>
              <div>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" style={{display:'none'}} onChange={handleFileChange}/>
                <button className="upload-btn" onClick={()=>fileRef.current?.click()} disabled={uploading}>
                  {uploading ? '⏳ Uploading…' : '📷 Upload Photo'}
                </button>
                <div className="avatar-hint">JPG, PNG, GIF or WebP. Max 2MB.</div>
                {uploadErr && <div style={{fontSize:12,color:'#dc2626',marginTop:4}}>{uploadErr}</div>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input className="form-input" type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Shredder McPow"/>
              </div>
              <div className="form-group">
                <label className="form-label">Username (optional)</label>
                <input className="form-input" type="text" value={username} onChange={e=>setUsername(e.target.value)} placeholder="shredder_pow"/>
              </div>
            </div>
            <div className="form-row full">
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className="form-input" type="email" value={email} readOnly style={{cursor:'default',opacity:.7}}/>
              </div>
            </div>
          </div>
        </div>

        {/* Riding style */}
        <div className="card">
          <div className="card-hd">Riding Style</div>
          <div className="card-body">
            <p style={{fontSize:13,color:'#6b849a',marginBottom:12}}>We use this to personalize your powder scores.</p>
            <div className="style-grid">
              {STYLES.map(s=>(
                <div key={s.value} className={`style-btn${style===s.value?' act':''}`} onClick={()=>setStyle(s.value)}>
                  <div className="style-emoji">{s.emoji}</div>
                  <div className="style-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Skill level */}
        <div className="card">
          <div className="card-hd">Skill Level</div>
          <div className="card-body">
            <div className="level-row">
              {LEVELS.map(l=>(
                <button key={l.value} className={`level-btn${skill===l.value?' act':''}`} onClick={()=>setSkill(l.value)}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button className="save-btn" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>
    </>
  );
}
