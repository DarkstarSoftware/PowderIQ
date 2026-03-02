'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

interface MountainUsage {
  id: string; name: string; state: string;
  _count: { favorites: number; alerts: number };
}

export default function AdminMountainsPage() {
  const [data, setData]       = useState<MountainUsage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: sd } = await supabase.auth.getSession();
      const t = sd.session?.access_token || '';
      const res = await fetch('/api/admin/mountains/usage', {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) setData((await res.json()).data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/admin" className="text-gray-400 hover:text-white text-sm focus-ring rounded">← Admin</Link>
          <span className="text-lg font-bold text-white">Mountain Usage</span>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-white mb-6">Mountain Usage</h1>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {loading ? (
            <p className="text-center text-gray-500 py-12">Loading…</p>
          ) : (
            <table className="w-full text-sm" aria-label="Mountain usage statistics">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-6 py-4 text-gray-400 font-medium">Mountain</th>
                  <th className="text-center px-6 py-4 text-gray-400 font-medium">Favorites</th>
                  <th className="text-center px-6 py-4 text-gray-400 font-medium">Alert Subscribers</th>
                </tr>
              </thead>
              <tbody>
                {data
                  .sort((a, b) => b._count.favorites - a._count.favorites)
                  .map((m) => (
                    <tr key={m.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="px-6 py-3 text-white">
                        {m.name}{' '}
                        <span className="text-gray-500">({m.state})</span>
                      </td>
                      <td className="px-6 py-3 text-center text-gray-300 tabular-nums">
                        {m._count.favorites}
                      </td>
                      <td className="px-6 py-3 text-center text-gray-300 tabular-nums">
                        {m._count.alerts}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
