'use client';
// src/app/resort/onboard/page.tsx

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

interface Mountain {
  id: string;
  name: string;
  state: string;
  topElevFt: number;
  baseElevFt: number;
  totalLifts: number;
  totalTrails: number;
}

const PLANS = [
  {
    key: 'starter' as const,
    name: 'Starter',
    price: '$199/mo',
    features: ['Lift & trail status management', 'Multi-elevation weather', 'Push notifications', 'Up to 3 operators'],
    color: 'border-gray-700',
    highlight: false,
  },
  {
    key: 'pro' as const,
    name: 'Pro',
    price: '$499/mo',
    features: ['Everything in Starter', 'AI snow report generation', 'Analytics dashboard', 'Unlimited operators', 'Guest status page'],
    color: 'border-sky-500',
    highlight: true,
  },
  {
    key: 'enterprise' as const,
    name: 'Enterprise',
    price: 'Custom',
    features: ['Everything in Pro', 'SkiData / OnTheSnow integration', 'API access for your apps', 'Snowmaking dashboard', 'Dedicated support'],
    color: 'border-violet-500',
    highlight: false,
  },
] as const;

export default function ResortOnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [token, setToken] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [mountains, setMountains] = useState<Mountain[]>([]);
  const [selectedMountain, setSelectedMountain] = useState<Mountain | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'pro' | 'enterprise'>('pro');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [liftieSlug, setLiftieSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push('/auth/login'); return; }
      setToken(data.session.access_token);
      const me = await fetch('/api/me', { headers: { Authorization: `Bearer ${data.session.access_token}` } }).then(r => r.json());
      setContactEmail(me.data?.email ?? '');
      setContactName(me.data?.profile?.displayName ?? '');
    })();
  }, [router]);

  useEffect(() => {
    if (!search || search.length < 2 || !token) return;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/mountains?search=${encodeURIComponent(search)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMountains(data.data ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [search, token]);

  async function handleSubmit() {
    if (!selectedMountain || !token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/resort', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mountainId: selectedMountain.id,
          plan: selectedPlan,
          contactName,
          contactEmail,
          phone: phone || undefined,
          liftieSlug: liftieSlug || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create resort');
      router.push('/resort/dashboard');
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <header className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">❄️ PowderIQ</span>
          </Link>
          <p className="text-gray-500 text-sm">Resort Operator Onboarding</p>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-4 py-12 w-full">
        {/* Steps */}
        <div className="flex items-center gap-2 mb-10">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step >= s ? 'bg-sky-600 text-white' : 'bg-gray-800 text-gray-500'
              }`}>{s}</div>
              <span className={`text-sm ${step >= s ? 'text-gray-300' : 'text-gray-600'}`}>
                {s === 1 ? 'Find Your Mountain' : s === 2 ? 'Choose Plan' : 'Contact Info'}
              </span>
              {s < 3 && <div className={`h-px w-8 ${step > s ? 'bg-sky-600' : 'bg-gray-800'}`} />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Mountain Search ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Find your mountain</h2>
              <p className="text-gray-400">Search for the ski resort you operate.</p>
            </div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="e.g. Vail, Steamboat, Stowe…"
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sky-500 placeholder-gray-600"
            />
            {mountains.length > 0 && (
              <div className="space-y-2">
                {mountains.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedMountain(m); setSearch(m.name); setMountains([]); }}
                    className={`w-full text-left bg-gray-900 border rounded-xl px-4 py-4 transition-colors ${
                      selectedMountain?.id === m.id ? 'border-sky-500' : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{m.name}</p>
                        <p className="text-gray-500 text-sm">{m.state} · {m.baseElevFt.toLocaleString()}–{m.topElevFt.toLocaleString()} ft</p>
                      </div>
                      <div className="text-right text-xs text-gray-600">
                        <p>{m.totalLifts} lifts</p>
                        <p>{m.totalTrails} trails</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedMountain && (
              <div className="bg-sky-950/30 border border-sky-500/30 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sky-300 font-medium">✓ {selectedMountain.name} selected</p>
                  <p className="text-gray-500 text-sm">{selectedMountain.state}</p>
                </div>
                <button onClick={() => setSelectedMountain(null)} className="text-gray-600 hover:text-gray-400 text-sm">Change</button>
              </div>
            )}
            <button
              onClick={() => setStep(2)}
              disabled={!selectedMountain}
              className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── Step 2: Plan Selection ── */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Choose your plan</h2>
              <p className="text-gray-400">All plans include a 14-day free trial. No credit card required to start.</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {PLANS.map(plan => (
                <button
                  key={plan.key}
                  onClick={() => setSelectedPlan(plan.key)}
                  className={`text-left p-5 rounded-2xl border-2 transition-all ${
                    selectedPlan === plan.key ? plan.color + ' bg-gray-900' : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
                  }`}
                >
                  {plan.highlight && (
                    <span className="text-xs bg-sky-600 text-white px-2 py-0.5 rounded-full mb-2 inline-block">Most Popular</span>
                  )}
                  <p className="text-white font-bold text-lg">{plan.name}</p>
                  <p className="text-sky-400 font-semibold text-xl mb-4">{plan.price}</p>
                  <ul className="space-y-1.5">
                    {plan.features.map(f => (
                      <li key={f} className="text-gray-400 text-sm flex gap-2">
                        <span className="text-emerald-400 mt-0.5">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-3 rounded-xl transition-colors">
                ← Back
              </button>
              <button onClick={() => setStep(3)} className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-semibold py-3 rounded-xl transition-colors">
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Contact Info ── */}
        {step === 3 && (
          <div className="space-y-6 max-w-lg">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Contact details</h2>
              <p className="text-gray-400">We'll use this to reach you about your account.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1.5">Your name</label>
                <input
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sky-500"
                  placeholder="Operations Manager"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1.5">Contact email</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1.5">Phone (optional)</label>
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sky-500"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1.5">
                  Liftie.info slug (optional)
                  <span className="text-gray-600 ml-2 font-normal">overrides auto-detection for lift seeding</span>
                </label>
                <input
                  value={liftieSlug}
                  onChange={e => setLiftieSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sky-500 font-mono"
                  placeholder="e.g. vail, breck, steamboat"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Mountain</span>
                <span className="text-white">{selectedMountain?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Plan</span>
                <span className="text-white capitalize">{selectedPlan} — {PLANS.find(p => p.key === selectedPlan)?.price}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Trial</span>
                <span className="text-emerald-400">14 days free · no card needed</span>
              </div>
            </div>

            {error && (
              <div className="bg-red-950/30 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-3 rounded-xl transition-colors">
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !contactName || !contactEmail}
                className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                {loading ? 'Creating…' : '🏔️ Launch Resort Dashboard'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
