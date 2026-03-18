// src/app/account/security/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

const CSS = `
.card{background:#fff;border:1px solid rgba(100,150,200,0.25);border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(15,40,80,0.08);margin-bottom:20px;}
.card-hd{font-size:15px;font-weight:700;color:#0d1b2e;padding:16px 20px;border-bottom:1px solid rgba(100,150,200,0.15);}
.card-body{padding:20px;}
.form-group{margin-bottom:16px;}
.form-group:last-child{margin-bottom:0;}
.form-label{font-size:12px;font-weight:600;color:#6b849a;text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:5px;}
.form-input{width:100%;padding:10px 12px;border:1.5px solid rgba(100,150,200,0.25);border-radius:9px;font-size:13.5px;font-family:'Inter',sans-serif;color:#0d1b2e;background:#f0f5fb;outline:none;transition:border-color .15s;}
.form-input:focus{border-color:#1d6ef5;background:#fff;}
.form-row{display:flex;gap:10px;}
.form-row .form-input{flex:1;}
.action-btn{padding:10px 20px;border-radius:9px;border:none;font-size:13.5px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;transition:filter .15s;}
.action-btn.primary{background:#1d6ef5;color:#fff;}
.action-btn.primary:hover:not(:disabled){filter:brightness(1.08);}
.action-btn.sec{background:#f0f5fb;color:#3d5166;border:1.5px solid rgba(100,150,200,0.25);}
.action-btn.sec:hover{background:#e5edf5;}
.action-btn:disabled{opacity:.55;cursor:not-allowed;}
.divider{height:1px;background:rgba(100,150,200,0.15);margin:20px 0;}
.info-row{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(100,150,200,0.1);}
.info-row:last-child{border-bottom:none;}
.info-label{font-size:13px;color:#3d5166;font-weight:500;}
.info-val{font-size:13px;font-weight:600;color:#0d1b2e;}
.success-msg{background:#f0fdf4;border:1px solid rgba(34,197,94,0.3);color:#15803d;border-radius:9px;padding:10px 14px;font-size:13px;font-weight:600;margin-bottom:16px;}
.error-msg{background:#fef2f2;border:1px solid rgba(239,68,68,0.3);color:#dc2626;border-radius:9px;padding:10px 14px;font-size:13px;font-weight:600;margin-bottom:16px;}
`;

export default function SecurityPage() {
  const router = useRouter();
  const [token,   setToken]   = useState('');
  const [email,   setEmail]   = useState('');
  const [newEmail,setNewEmail]= useState('');
  const [newPw,   setNewPw]   = useState('');
  const [confirmPw,setConfirmPw]=useState('');
  const [pwSaving, setPwSaving]=useState(false);
  const [pwMsg,   setPwMsg]   = useState('');
  const [pwErr,   setPwErr]   = useState('');
  const [emailMsg,setEmailMsg]=useState('');

  useEffect(()=>{
    (async()=>{
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push('/auth/login'); return; }
      setToken(data.session.access_token);
      setEmail(data.session.user?.email||'');
    })();
  },[router]);

  async function changePassword(){
    if (!newPw) return;
    if (newPw !== confirmPw) { setPwErr("Passwords don't match."); return; }
    if (newPw.length < 8) { setPwErr("Password must be at least 8 characters."); return; }
    setPwSaving(true); setPwErr(''); setPwMsg('');
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) setPwErr(error.message);
    else { setPwMsg('Password updated successfully.'); setNewPw(''); setConfirmPw(''); }
    setPwSaving(false);
  }

  async function changeEmail(){
    if (!newEmail || newEmail === email) return;
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) setEmailMsg('Error: ' + error.message);
    else setEmailMsg('Confirmation email sent to ' + newEmail + '. Check your inbox.');
  }

  return (
    <>
      <style>{CSS}</style>
      <div style={{padding:'20px 28px 48px'}}>
        <div style={{marginBottom:20}}>
          <h1 style={{fontSize:20,fontWeight:800,color:'#0d1b2e'}}>Password &amp; Security</h1>
          <p style={{fontSize:13,color:'#6b849a',marginTop:3}}>Manage your password and account security settings.</p>
        </div>

        {/* Change Password */}
        <div className="card">
          <div className="card-hd">Change Password</div>
          <div className="card-body">
            {pwMsg && <div className="success-msg">✓ {pwMsg}</div>}
            {pwErr && <div className="error-msg">⚠ {pwErr}</div>}
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input className="form-input" type="password" value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="8+ characters"/>
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input className="form-input" type="password" value={confirmPw} onChange={e=>setConfirmPw(e.target.value)} placeholder="Repeat password"/>
            </div>
            <button className="action-btn primary" onClick={changePassword} disabled={pwSaving||!newPw}>
              {pwSaving ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </div>

        {/* Change Email */}
        <div className="card">
          <div className="card-hd">Email Address</div>
          <div className="card-body">
            {emailMsg && <div className={emailMsg.startsWith('Error') ? 'error-msg' : 'success-msg'}>{emailMsg}</div>}
            <div className="form-group">
              <label className="form-label">Current Email</label>
              <input className="form-input" type="email" value={email} readOnly style={{opacity:.6,cursor:'default'}}/>
            </div>
            <div className="form-group">
              <label className="form-label">New Email Address</label>
              <div className="form-row">
                <input className="form-input" type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="new@email.com"/>
                <button className="action-btn primary" onClick={changeEmail} disabled={!newEmail||newEmail===email}>
                  Update Email
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Account info */}
        <div className="card">
          <div className="card-hd">Account Information</div>
          <div className="card-body">
            <div className="info-row">
              <span className="info-label">Account created</span>
              <span className="info-val">—</span>
            </div>
            <div className="info-row">
              <span className="info-label">Last sign in</span>
              <span className="info-val">—</span>
            </div>
            <div className="info-row">
              <span className="info-label">Authentication</span>
              <span className="info-val">Email &amp; Password</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
