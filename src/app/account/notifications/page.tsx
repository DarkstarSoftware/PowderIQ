// src/app/account/notifications/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

const CSS = `
.card{background:#fff;border:1px solid rgba(100,150,200,0.25);border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(15,40,80,0.08);margin-bottom:20px;}
.card-hd{font-size:15px;font-weight:700;color:#0d1b2e;padding:16px 20px;border-bottom:1px solid rgba(100,150,200,0.15);}
.notif-row{display:flex;align-items:center;padding:14px 20px;border-bottom:1px solid rgba(100,150,200,0.1);}
.notif-row:last-child{border-bottom:none;}
.notif-ico{font-size:18px;margin-right:12px;flex-shrink:0;}
.notif-info{flex:1;}
.notif-label{font-size:13.5px;font-weight:600;color:#0d1b2e;}
.notif-desc{font-size:12px;color:#6b849a;margin-top:2px;}
.toggle{position:relative;width:42px;height:24px;flex-shrink:0;}
.toggle input{opacity:0;width:0;height:0;position:absolute;}
.toggle-track{position:absolute;inset:0;border-radius:12px;background:#d1d5db;cursor:pointer;transition:background .2s;}
.toggle input:checked ~ .toggle-track{background:#0d9488;}
.toggle-thumb{position:absolute;top:3px;left:3px;width:18px;height:18px;background:#fff;border-radius:50%;transition:transform .2s;pointer-events:none;}
.toggle input:checked ~ .toggle-track .toggle-thumb{transform:translateX(18px);}
.save-btn{padding:11px 28px;background:#1d6ef5;color:#fff;border:none;border-radius:9px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;transition:filter .15s;}
.save-btn:hover{filter:brightness(1.08);}
.success-msg{background:#f0fdf4;border:1px solid rgba(34,197,94,0.3);color:#15803d;border-radius:9px;padding:10px 14px;font-size:13px;font-weight:600;margin-bottom:16px;}
`;

const NOTIF_OPTIONS = [
  { key:'email',     icon:'📧', label:'Email powder alerts',     desc:'Get notified when new snow falls at your saved resorts' },
  { key:'sms',       icon:'📱', label:'SMS powder alerts',       desc:'Text message alerts for major snowfall events' },
  { key:'weekly',    icon:'📊', label:'Weekly snow report',      desc:'Summary of conditions every Monday morning' },
  { key:'newResort', icon:'🏔️', label:'New resort alerts',       desc:'When a resort you might like gets added' },
  { key:'forecast',  icon:'🌨️', label:'Storm forecast alerts',   desc:'48-hour warning before incoming storms' },
];

export default function NotificationsPage() {
  const router = useRouter();
  const [token,  setToken]  = useState('');
  const [notifs, setNotifs] = useState({ email:true, sms:false, weekly:true, newResort:false, forecast:true });
  const [saved,  setSaved]  = useState(false);

  useEffect(()=>{
    (async()=>{
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push('/auth/login'); return; }
      setToken(data.session.access_token);
    })();
  },[router]);

  function save() {
    setSaved(true);
    setTimeout(()=>setSaved(false),3000);
  }

  return (
    <>
      <style>{CSS}</style>
      <div style={{padding:'20px 28px 48px'}}>
        <div style={{marginBottom:20}}>
          <h1 style={{fontSize:20,fontWeight:800,color:'#0d1b2e'}}>Notifications</h1>
          <p style={{fontSize:13,color:'#6b849a',marginTop:3}}>Choose what you want to be notified about.</p>
        </div>

        {saved && <div className="success-msg">✓ Notification preferences saved.</div>}

        <div className="card">
          <div className="card-hd">Alert Preferences</div>
          {NOTIF_OPTIONS.map(n=>(
            <div className="notif-row" key={n.key}>
              <span className="notif-ico">{n.icon}</span>
              <div className="notif-info">
                <div className="notif-label">{n.label}</div>
                <div className="notif-desc">{n.desc}</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={notifs[n.key as keyof typeof notifs]} onChange={e=>setNotifs(p=>({...p,[n.key]:e.target.checked}))}/>
                <div className="toggle-track"><div className="toggle-thumb"/></div>
              </label>
            </div>
          ))}
        </div>

        <button className="save-btn" onClick={save}>Save Preferences</button>
      </div>
    </>
  );
}
