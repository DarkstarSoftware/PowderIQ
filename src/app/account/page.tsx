'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface UserData {
  id: string; email: string; role: string;
  profile?: { displayName?: string; style?: string; skillLevel?: string };
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser]             = useState<UserData | null>(null);
  const [token, setToken]           = useState('');
  const [billingLoading, setBilling] = useState(false);
  const [exporting, setExporting]   = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [upgraded, setUpgraded]     = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push('/auth/login'); return; }
      const t = data.session.access_token;
      setToken(t);

      const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) setUser((await res.json()).data);

      if (typeof window !== 'undefined' && window.location.search.includes('upgraded=1')) {
        setUpgraded(true);
      }
    })();
  }, [router]);

  async function handleUpgrade() {
    setBilling(true);
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const stripe = await stripePromise;
      if (data.data.url) {
        window.location.href = data.data.url;
      } else {
        await stripe?.redirectToCheckout({ sessionId: data.data.sessionId });
      }
    }
    setBilling(false);
  }

  async function handleExport() {
    setExporting(true);
    const res = await fetch('/api/privacy/export', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'powderiq-data.json';
      a.click();
      URL.revokeObjectURL(url);
    }
    setExporting(false);
  }

  async function handleDelete() {
    if (
      !confirm(
        'Are you sure you want to permanently delete your account? This cannot be undone.'
      )
    )
      return;
    setDeleting(true);
    await fetch('/api/privacy/delete', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  const roleBadge =
    user?.role === 'admin'    ? { label: 'Admin',   cls: 'bg-red-900 text-red-300' } :
    user?.role === 'pro_user' ? { label: 'Pro',      cls: 'bg-brand-900 text-brand-300' } :
                                 { label: 'Free',     cls: 'bg-gray-800 text-gray-400' };

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm focus-ring rounded">
            ← Dashboard
          </Link>
          <span className="text-lg font-bold text-white">Account</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        {upgraded && (
          <div role="alert" className="bg-emerald-900/40 border border-emerald-700 text-emerald-300 rounded-xl px-5 py-4">
            🎉 Welcome to Pro! Your upgraded features are now active.
          </div>
        )}

        {/* Profile */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6" aria-labelledby="profile-heading">
          <h2 id="profile-heading" className="text-xl font-semibold text-white mb-4">Profile</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-400">Email</dt>
              <dd className="text-white">{user?.email}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-400">Plan</dt>
              <dd>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${roleBadge.cls}`}>
                  {roleBadge.label}
                </span>
              </dd>
            </div>
            {user?.profile?.displayName && (
              <div className="flex items-center justify-between">
                <dt className="text-gray-400">Name</dt>
                <dd className="text-white">{user.profile.displayName}</dd>
              </div>
            )}
            {user?.profile?.style && (
              <div className="flex items-center justify-between">
                <dt className="text-gray-400">Style</dt>
                <dd className="text-white capitalize">{user.profile.style.replace('_', ' ')}</dd>
              </div>
            )}
          </dl>
          <Link
            href="/onboarding"
            className="mt-4 inline-block text-sm text-brand-400 hover:text-brand-300 focus-ring rounded"
          >
            Edit profile →
          </Link>
        </section>

        {/* Billing */}
        {user?.role === 'user' && (
          <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6" aria-labelledby="billing-heading">
            <h2 id="billing-heading" className="text-xl font-semibold text-white mb-2">
              Upgrade to Pro
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              Unlock mountain comparison, powder alerts, and personalized scoring weights.
            </p>
            <ul className="text-sm text-gray-300 space-y-1 mb-5">
              <li>✓ Compare up to 4 mountains side-by-side</li>
              <li>✓ Powder alerts with email notifications</li>
              <li>✓ Personalized score weights for your riding style</li>
            </ul>
            <button
              onClick={handleUpgrade}
              disabled={billingLoading}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors focus-ring"
            >
              {billingLoading ? 'Loading…' : 'Upgrade to Pro — $9.99/month'}
            </button>
          </section>
        )}

        {/* Privacy */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6" aria-labelledby="privacy-heading">
          <h2 id="privacy-heading" className="text-xl font-semibold text-white mb-4">Privacy & Data</h2>
          <div className="space-y-3">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full text-left px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors focus-ring disabled:opacity-60"
            >
              {exporting ? 'Preparing export…' : '📥 Export my data (JSON)'}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-full text-left px-4 py-3 bg-red-900/20 hover:bg-red-900/40 border border-red-800/50 rounded-lg text-sm text-red-400 transition-colors focus-ring disabled:opacity-60"
            >
              {deleting ? 'Deleting account…' : '🗑️ Delete my account permanently'}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
