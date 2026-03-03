'use client';

/**
 * src/app/resort/onboard/page.tsx
 *
 * Self-serve onboarding flow for resort operators.
 * Step 1: Find mountain → Step 2: Configure resort → Step 3: Add staff → Done
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

interface Mountain {
  id: string;
  name: string;
  state: string;
  baseElevFt: number;
  topElevFt: number;
  latitude: number;
  longitude: number;
}

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$199/mo',
    description: 'Perfect for small and independent resorts',
    features: [
      'Summit / Mid / Base weather dashboard',
      'Lift & trail status management',
      'Guest-facing status page',
      'Daily snow report (manual)',
      'Email alerts to staff',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$499/mo',
    description: 'For mid-size resorts ready to grow',
    highlight: true,
    features: [
      'Everything in Starter',
      'AI-generated morning snow reports',
      'Guest push notifications',
      'Crowd & demand analytics',
      'Dynamic pricing recommendations',
      'Multi-channel report publishing',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large resorts and resort groups',
    features: [
      'Everything in Pro',
      'White-label guest app',
      'Snowmaking management dashboard',
      'REST API access',
      'Multi-resort management',
      'Dedicated account manager',
      'SLA + priority support',
    ],
  },
];

export default function ResortOnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [token, setToken] = useState('');
  const [mountains, setMountains] = useState<Mountain[]>([]);
  const [selectedMountain, setSelectedMountain] = useState<Mountain | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [resortName, setResortName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push('/auth/login'); return; }
      setToken(data.session.access_token);
      setContactEmail(data.session.user.email || '');
    })();
  }, [router]);

  useEffect(() => {
    if (searchQuery.length < 2) return;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/mountains?search=${encodeURIComponent(searchQuery)}&limit=8`);
      if (res.ok) {
        const d = await res.json();
        setMountains(d.data || []);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  async function handleCreateResort() {
    if (!selectedMountain) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/resort', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mountainId: selectedMountain.id,
          name: resortName || selectedMountain.name,
          plan: selectedPlan,
          email: contactEmail,
          phone,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to create resort');
      }
      router.push('/resort/dashboard?onboarded=1');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Header */}
      <header className="border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>❄️</span>
            <span className="font-bold">PowderIQ</span>
            <span className="text-gray-600 mx-2">·</span>
            <span className="text-gray-400 text-sm">Resort Setup</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step >= s ? 'bg-sky-600 text-white' : 'bg-gray-800 text-gray-500'
                }`}>
                  {s}
                </div>
                {s < 3 && <div className={`w-8 h-px ${step > s ? 'bg-sky-600' : 'bg-gray-700'}`} />}
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">

        {/* ── Step 1: Choose Mountain ─────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h1 className="text-3xl font-bold mb-2">Find your mountain</h1>
            <p className="text-gray-400 mb-8">Search for the ski resort you operate.</p>

            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search mountains… (e.g. Vail, Whistler, Stowe)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
              <span className="absolute right-4 top-3.5 text-gray-500">🔍</span>
            </div>

            <div className="space-y-2">
              {mountains.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedMountain(m);
                    setResortName(m.name);
                  }}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    selectedMountain?.id === m.id
                      ? 'border-sky-500 bg-sky-950/40'
                      : 'border-gray-800 bg-gray-900/60 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">{m.name}</p>
                      <p className="text-gray-400 text-sm">{m.state} · Base {m.baseElevFt.toLocaleString()}ft · Summit {m.topElevFt.toLocaleString()}ft</p>
                    </div>
                    {selectedMountain?.id === m.id && (
                      <span className="text-sky-400 text-xl">✓</span>
                    )}
                  </div>
                </button>
              ))}
              {searchQuery.length > 1 && mountains.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-8">No mountains found. Contact us to add your resort.</p>
              )}
            </div>

            <div className="mt-8">
              <button
                disabled={!selectedMountain}
                onClick={() => setStep(2)}
                className="px-8 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-colors"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Choose Plan ─────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <h1 className="text-3xl font-bold mb-2">Choose your plan</h1>
            <p className="text-gray-400 mb-8">
              Setting up <span className="text-white font-medium">{selectedMountain?.name}</span>. All plans include a 14-day free trial.
            </p>

            <div className="grid md:grid-cols-3 gap-4 mb-8">
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`text-left p-6 rounded-2xl border transition-all relative ${
                    selectedPlan === plan.id
                      ? 'border-sky-500 bg-sky-950/30'
                      : 'border-gray-800 bg-gray-900/60 hover:border-gray-700'
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-sky-600 rounded-full text-xs font-bold whitespace-nowrap">
                      Most Popular
                    </div>
                  )}
                  <p className="font-bold text-lg text-white mb-0.5">{plan.name}</p>
                  <p className="text-sky-400 font-semibold text-xl mb-1">{plan.price}</p>
                  <p className="text-gray-400 text-xs mb-4">{plan.description}</p>
                  <ul className="space-y-1.5">
                    {plan.features.map((f) => (
                      <li key={f} className="text-gray-300 text-xs flex gap-2">
                        <span className="text-sky-500 shrink-0">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {selectedPlan === plan.id && (
                    <div className="mt-4 text-sky-400 text-sm font-semibold">✓ Selected</div>
                  )}
                </button>
              ))}
            </div>

            {/* Contact info */}
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <div>
                <label className="block text-gray-400 text-sm mb-1.5">Resort Name</label>
                <input
                  value={resortName}
                  onChange={(e) => setResortName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1.5">Contact Phone (optional)</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 000 0000"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {error && (
              <div className="mb-4 p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="px-6 py-3 rounded-xl border border-gray-700 text-gray-300 hover:text-white hover:border-gray-600 transition-colors">
                ← Back
              </button>
              <button
                onClick={handleCreateResort}
                disabled={loading || !resortName}
                className="px-8 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white font-semibold transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating…
                  </>
                ) : (
                  'Start Free Trial →'
                )}
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
