'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

interface Metrics {
  totalUsers: number; proUsers: number;
  totalFavorites: number; totalAlerts: number;
}

export default function AdminPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [denied, setDenied]   = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const t = data.session?.access_token || '';
      const res = await fetch('/api/admin/metrics', {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 403 || res.status === 401) { setDenied(true); return; }
      if (res.ok) setMetrics((await res.json()).data);
    })();
  }, []);

  if (denied) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center" role="alert">
        <div className="text-center">
          <p className="text-5xl mb-4" aria-hidden="true">🔒</p>
          <p className="text-gray-400">Access denied. Admin only.</p>
          <Link href="/dashboard" className="text-brand-400 mt-4 inline-block focus-ring rounded">
            Back to Dashboard
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
          <span className="text-lg font-bold text-white">Admin</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-white mb-8">Admin Overview</h1>

        {/* Metrics */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {metrics
            ? Object.entries({
                'Total Users': metrics.totalUsers,
                'Pro Users':   metrics.proUsers,
                'Favorites':   metrics.totalFavorites,
                'Alerts':      metrics.totalAlerts,
              }).map(([label, val]) => (
                <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                  <p className="text-3xl font-bold text-white">{val}</p>
                  <p className="text-gray-400 text-sm mt-1">{label}</p>
                </div>
              ))
            : [...Array(4)].map((_, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl h-24 animate-pulse" aria-hidden="true" />
              ))}
        </div>

        {/* Nav links */}
        <nav className="flex flex-wrap gap-4" aria-label="Admin sections">
          {[
            { href: '/admin/users',     label: '👤 User Management' },
            { href: '/admin/audit',     label: '📋 Audit Logs' },
            { href: '/admin/mountains', label: '🏔️ Mountain Usage' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="bg-gray-900 border border-gray-800 hover:border-gray-600 px-6 py-3 rounded-xl text-white font-medium transition-colors focus-ring"
            >
              {l.label} →
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
