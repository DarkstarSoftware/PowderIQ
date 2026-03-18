// src/app/account/privacy/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

const CSS = `
.card{background:#fff;border:1px solid rgba(100,150,200,0.25);border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(15,40,80,0.08);margin-bottom:20px;}
.card-hd{font-size:15px;font-weight:700;color:#0d1b2e;padding:16px 20px;border-bottom:1px solid rgba(100,150,200,0.15);}
.card-body{padding:20px;}
.action-row{display:flex;align-items:flex-start;justify-content:space-between;padding:14px 0;border-bottom:1px solid rgba(100,150,200,0.1);gap:16px;}
.action-row:last-child{border-bottom:none;}
.action-info .action-label{font-size:13.5px;font-weight:600;color:#0d1b2e;}
.action-info .action-desc{font-size:12px;color:#6b849a;margin-top:3px;max-width:340px;line-height:1.5;}
.action-btn{padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;white-space:nowrap;flex-shrink:0;transition:all .15s;}
.action-btn.neutral{background:#f0f5fb;border:1.5px solid rgba(100,150,200,0.25);color:#3d5166;}
.action-btn.neutral:hover{background:#e5edf5;}
.action-btn.danger{background:#fef2f2;border:1.5px solid rgba(239,68,68,0.25);color:#dc2626;}
.action-btn.danger:hover{background:#fee2e2;}
.action-btn:disabled{opacity:.55;cursor:not-allowed;}
.danger-zone{border:1.5px solid rgba(239,68,68,0.25);}
.danger-zone .card-hd{color:#dc2626;background:#fef2f2;}
`;

export default function PrivacyPage() {
  const router    = useRouter();
  const [token,   setToken]   = useState('');
  const [exporting,setExporting]=useState(false);
  const [deleting,setDeleting]=useState(false);

  useEffect(()=>{
    (async()=>{
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push('/auth/login'); return; }
      setToken(data.session.access_token);
    })();
  },[router]);

  async function handleExport(){
    setExporting(true);
    const res = await fetch('/api/privacy/export',{method:'POST',headers:{Authorization:`Bearer ${token}`}});
    if (res.ok){
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href=url; a.download='powderiq-data.json'; a.click();
      URL.revokeObjectURL(url);
    }
    setExporting(false);
  }

  async function handleDelete(){
    if (!confirm('Permanently delete your account and all data? This cannot be undone.')) return;
    setDeleting(true);
    await fetch('/api/privacy/delete',{method:'POST',headers:{Authorization:`Bearer ${token}`}});
    await supabase.auth.signOut();
    window.location.href='/';
  }

  return (
    <>
      <style>{CSS}</style>
      <div style={{padding:'20px 28px 48px'}}>
        <div style={{marginBottom:20}}>
          <h1 style={{fontSize:20,fontWeight:800,color:'#0d1b2e'}}>Data &amp; Privacy</h1>
          <p style={{fontSize:13,color:'#6b849a',marginTop:3}}>Control your data and account privacy settings.</p>
        </div>

        <div className="card">
          <div className="card-hd">Your Data</div>
          <div className="card-body">
            <div className="action-row">
              <div className="action-info">
                <div className="action-label">Export My Data</div>
                <div className="action-desc">Download a copy of all your PowderIQ data including saved resorts, preferences, and activity history.</div>
              </div>
              <button className="action-btn neutral" onClick={handleExport} disabled={exporting}>
                {exporting ? 'Preparing…' : '📥 Export Data'}
              </button>
            </div>
            <div className="action-row">
              <div className="action-info">
                <div className="action-label">Privacy Policy</div>
                <div className="action-desc">Learn how we collect, use, and protect your personal information.</div>
              </div>
              <a href="/privacy" className="action-btn neutral" style={{textDecoration:'none',display:'inline-block'}}>View Policy →</a>
            </div>
          </div>
        </div>

        <div className="card danger-zone">
          <div className="card-hd">Danger Zone</div>
          <div className="card-body">
            <div className="action-row">
              <div className="action-info">
                <div className="action-label" style={{color:'#dc2626'}}>Delete Account</div>
                <div className="action-desc">Permanently delete your account and all associated data. This action cannot be reversed.</div>
              </div>
              <button className="action-btn danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : '🗑️ Delete Account'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
