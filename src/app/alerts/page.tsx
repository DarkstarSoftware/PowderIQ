'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

interface Alert {
  id: string; threshold: number; active: boolean;
  mountain: { id: string; name: string; state: string };
}
interface Mountain { id: string; name: string }

export default function AlertsPage() {
  const [alerts, setAlerts]             = useState<Alert[]>([]);
  const [mountains, setMountains]       = useState<Mountain[]>([]);
  const [isPro, setIsPro]               = useState(false);
  const [token, setToken]               = useState('');
  const [selectedMountain, setSelected] = useState('');
  const [threshold, setThreshold]       = useState(70);
  const [saving, setSaving]             = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const t = data.session?.access_token || '';
      setToken(t);
      if (!t) return;

      const meRes = await fetch('/api/me', { headers: { Authorization: `Bearer ${t}` } });
      if (meRes.ok) {
        const me = await meRes.json();
        setIsPro(me.data?.role === 'pro_user' || me.data?.role === 'admin');
      }

      const [aRes, mRes] = await Promise.all([
        fetch('/api/alerts', { headers: { Authorization: `Bearer ${t}` } }),
        fetch('/api/mountains'),
      ]);
      if (aRes.ok) setAlerts((await aRes.json()).data || []);
      if (mRes.ok) setMountains((await mRes.json()).data || []);
    })();
  }, []);

  async function createAlert(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMountain) return;
    setSaving(true);
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mountainId: selectedMountain, threshold }),
    });
    if (res.ok) {
      const data = await res.json();
      setAlerts((prev) => {
        const exists = prev.find((a) => a.id === data.data.id);
        return exists ? prev.map((a) => (a.id === data.data.id ? data.data : a)) : [...prev, data.data];
      });
      setSelected('');
    }
    setSaving(false);
  }

  async function deleteAlert(id: string) {
    await fetch('/api/alerts', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId: id }),
    });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  if (!isPro) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-5xl mb-4" aria-hidden="true">🔔</p>
          <h1 className="text-3xl font-bold text-white mb-4">Pro Feature</h1>
          <p className="text-gray-400 mb-6">
            Powder alerts are available on the Pro plan.
          </p>
          <Link
            href="/account"
            className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors focus-ring"
          >
            Upgrade to Pro
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm focus-ring rounded">
            ← Dashboard
          </Link>
          <span className="text-lg font-bold text-white">Powder Alerts</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-white mb-6">Powder Alerts</h1>

        <form
          onSubmit={createAlert}
          className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8 space-y-5"
          aria-label="Create alert form"
        >
          <h2 className="text-lg font-semibold text-white">New Alert</h2>

          <div>
            <label htmlFor="alert-mountain" className="block text-sm font-medium text-gray-300 mb-2">
              Mountain
            </label>
            <select
              id="alert-mountain"
              value={selectedMountain}
              onChange={(e) => setSelected(e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus-ring"
            >
              <option value="">Select a mountain…</option>
              {mountains.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="alert-threshold" className="block text-sm font-medium text-gray-300 mb-2">
              Score threshold:{' '}
              <span className="text-brand-400 font-bold">{threshold}</span>
              <span className="text-gray-500"> — alert when score reaches or exceeds this</span>
            </label>
            <input
              id="alert-threshold"
              type="range"
              min={30}
              max={95}
              step={5}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-brand-500 focus-ring rounded"
              aria-valuemin={30}
              aria-valuemax={95}
              aria-valuenow={threshold}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>30</span><span>95</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || !selectedMountain}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors focus-ring"
          >
            {saving ? 'Saving…' : 'Create Alert'}
          </button>
        </form>

        <section aria-label="Your alerts">
          <h2 className="text-lg font-semibold text-white mb-3">Active Alerts</h2>
          <div className="space-y-3">
            {alerts.map((a) => (
              <div
                key={a.id}
                className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-white font-medium">{a.mountain.name}</p>
                  <p className="text-gray-400 text-sm">
                    Notify when score ≥ {a.threshold}
                  </p>
                </div>
                <button
                  onClick={() => deleteAlert(a.id)}
                  aria-label={`Delete alert for ${a.mountain.name}`}
                  className="text-gray-500 hover:text-red-400 transition-colors focus-ring rounded p-1 text-lg"
                >
                  🗑️
                </button>
              </div>
            ))}
            {alerts.length === 0 && (
              <p className="text-gray-500 text-center py-10">
                No alerts yet. Create one above.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
