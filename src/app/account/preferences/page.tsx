// src/app/account/preferences/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

const CSS = `
.card{background:#fff;border:1px solid rgba(100,150,200,0.25);border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(15,40,80,0.08);margin-bottom:20px;}
.card-hd{font-size:15px;font-weight:700;color:#0d1b2e;padding:16px 20px;border-bottom:1px solid rgba(100,150,200,0.15);}
.card-body{padding:20px;}
.pref-row{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(100,150,200,0.1);}
.pref-row:last-child{border-bottom:none;}
.pref-label{font-size:13.5px;font-weight:600;color:#0d1b2e;}
.pref-desc{font-size:12px;color:#6b849a;margin-top:2px;}
.pref-select{padding:7px 12px;border:1.5px solid rgba(100,150,200,0.25);border-radius:8px;font-size:13px;font-family:'Inter',sans-serif;color:#0d1b2e;background:#f0f5fb;outline:none;cursor:pointer;}
.pref-select:focus{border-color:#1d6ef5;}
.save-btn{padding:11px 28px;background:#1d6ef5;color:#fff;border:none;border-radius:9px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;transition:filter .15s;}
.save-btn:hover{filter:brightness(1.08);}
.success-msg{background:#f0fdf4;border:1px solid rgba(34,197,94,0.3);color:#15803d;border-radius:9px;padding:10px 14px;font-size:13px;font-weight:600;margin-bottom:16px;}
`;

export default function PreferencesPage() {
  const router = useRouter();
  const [units,    setUnits]    = useState('imperial');
  const [tempUnit, setTempUnit] = useState('f');
  const [language, setLanguage] = useState('en');
  const [saved,    setSaved]    = useState(false);

  useEffect(()=>{
    (async()=>{
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push('/auth/login'); return; }
    })();
  },[router]);

  return (
    <>
      <style>{CSS}</style>
      <div style={{padding:'20px 28px 48px'}}>
        <div style={{marginBottom:20}}>
          <h1 style={{fontSize:20,fontWeight:800,color:'#0d1b2e'}}>Preferences</h1>
          <p style={{fontSize:13,color:'#6b849a',marginTop:3}}>Customize your PowderIQ experience.</p>
        </div>

        {saved && <div className="success-msg">✓ Preferences saved.</div>}

        <div className="card">
          <div className="card-hd">Display Settings</div>
          <div className="card-body">
            {[
              { label:'Measurement Units', desc:'Imperial (inches/feet) or Metric (cm/m)', val:units, set:setUnits, opts:[{v:'imperial',l:'Imperial (in/ft)'},{v:'metric',l:'Metric (cm/m)'}] },
              { label:'Temperature', desc:'Fahrenheit or Celsius', val:tempUnit, set:setTempUnit, opts:[{v:'f',l:'Fahrenheit (°F)'},{v:'c',l:'Celsius (°C)'}] },
              { label:'Language', desc:'Display language', val:language, set:setLanguage, opts:[{v:'en',l:'English'},{v:'fr',l:'French'},{v:'de',l:'German'}] },
            ].map(p=>(
              <div className="pref-row" key={p.label}>
                <div>
                  <div className="pref-label">{p.label}</div>
                  <div className="pref-desc">{p.desc}</div>
                </div>
                <select className="pref-select" value={p.val} onChange={e=>p.set(e.target.value)}>
                  {p.opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        <button className="save-btn" onClick={()=>{setSaved(true);setTimeout(()=>setSaved(false),3000);}}>
          Save Preferences
        </button>
      </div>
    </>
  );
}
