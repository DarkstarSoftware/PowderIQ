'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

interface Log {
  id: string; action: string; entity?: string; entityId?: string;
  ip?: string; createdAt: string; user?: { email: string };
}

export default function AdminAuditPage() {
  const [logs, setLogs]     = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const t = data.session?.access_token || '';
      const res = await fetch('/api/admin/audit', {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) setLogs((await res.json()).data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/admin" className="text-gray-400 hover:text-white text-sm focus-ring rounded">← Admin</Link>
          <span className="text-lg font-bold text-white">Audit Logs</span>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-white mb-6">Audit Logs</h1>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-x-auto">
          {loading ? (
            <p className="text-center text-gray-500 py-12">Loading…</p>
          ) : (
            <table className="w-full text-sm" aria-label="Audit log entries">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Time', 'User', 'Action', 'Entity', 'IP'].map((h) => (
                    <th key={h} className="text-left px-6 py-4 text-gray-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="px-6 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(l.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-white">{l.user?.email || '—'}</td>
                    <td className="px-6 py-3 text-brand-300 font-mono">{l.action}</td>
                    <td className="px-6 py-3 text-gray-400">
                      {l.entity ? `${l.entity}:${l.entityId}` : '—'}
                    </td>
                    <td className="px-6 py-3 text-gray-500">{l.ip || '—'}</td>
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
