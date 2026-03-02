'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

interface User { id: string; email: string; role: string; createdAt: string }

export default function AdminUsersPage() {
  const [users, setUsers]   = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const t = data.session?.access_token || '';
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) setUsers((await res.json()).data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/admin" className="text-gray-400 hover:text-white text-sm focus-ring rounded">
            ← Admin
          </Link>
          <span className="text-lg font-bold text-white">Users</span>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-white mb-6">User Management</h1>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {loading ? (
            <p className="text-center text-gray-500 py-12">Loading…</p>
          ) : (
            <table className="w-full text-sm" aria-label="Users list">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-6 py-4 text-gray-400 font-medium">Email</th>
                  <th className="text-left px-6 py-4 text-gray-400 font-medium">Role</th>
                  <th className="text-left px-6 py-4 text-gray-400 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="px-6 py-4 text-white">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        u.role === 'admin'    ? 'bg-red-900 text-red-300' :
                        u.role === 'pro_user' ? 'bg-brand-900 text-brand-300' :
                                               'bg-gray-800 text-gray-400'
                      }`}>{u.role}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {new Date(u.createdAt).toLocaleDateString()}
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
