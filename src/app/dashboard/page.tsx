'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import ScoreBadge from '@/components/ScoreBadge';

interface Mountain { id: string; name: string; state: string; imageUrl?: string }
interface FavoriteItem { id: string; mountain: Mountain; score?: number }

export default function DashboardPage() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [userRole, setUserRole]   = useState<string>('user');
  const [userName, setUserName]   = useState<string>('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push('/auth/login'); return; }
      const token = data.session.access_token;

      const [meRes, favRes] = await Promise.all([
        fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/favorites', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (meRes.ok) {
        const me = await meRes.json();
        setUserRole(me.data?.role || 'user');
        setUserName(me.data?.profile?.displayName || '');
      }

      if (favRes.ok) {
        const favData = await favRes.json();
        const items: FavoriteItem[] = favData.data || [];

        const withScores = await Promise.all(
          items.map(async (f) => {
            try {
              const sRes = await fetch(`/api/mountains/${f.mountain.id}/score`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (sRes.ok) {
                const s = await sRes.json();
                return { ...f, score: s.data?.score };
              }
            } catch {}
            return f;
          })
        );
        setFavorites(withScores);
      }
      setLoading(false);
    })();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span aria-hidden="true">❄️</span>
            <span className="text-lg font-bold text-white">PowderIQ</span>
          </div>
          <nav className="flex items-center gap-4" aria-label="App navigation">
            {userRole === 'admin' && (
              <Link href="/admin" className="text-gray-400 hover:text-white text-sm transition-colors focus-ring rounded">
                Admin
              </Link>
            )}
            <Link href="/mountains" className="text-gray-400 hover:text-white text-sm transition-colors focus-ring rounded">
              Mountains
            </Link>
            {(userRole === 'pro_user' || userRole === 'admin') && (
              <>
                <Link href="/compare" className="text-gray-400 hover:text-white text-sm transition-colors focus-ring rounded">
                  Compare
                </Link>
                <Link href="/alerts" className="text-gray-400 hover:text-white text-sm transition-colors focus-ring rounded">
                  Alerts
                </Link>
              </>
            )}
            {(userRole === 'resort_operator' || userRole === 'resort_admin') && (
              <Link href="/resort/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors focus-ring rounded">
                🏔️ Resort Ops
              </Link>
            )}
            <Link href="/account" className="text-gray-400 hover:text-white text-sm transition-colors focus-ring rounded" aria-label="Account settings">
              ⚙️
            </Link>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white text-sm transition-colors focus-ring rounded px-2 py-1"
              aria-label="Sign out"
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-3xl font-bold text-white mb-1">
          {userName ? `Welcome back, ${userName}` : 'Dashboard'}
        </h1>
        <p className="text-gray-400 mb-8">Your favorite mountains and today&apos;s powder windows.</p>

        {userRole === 'user' && (
          <div className="mb-8 bg-gradient-to-r from-brand-900/40 to-blue-900/40 border border-brand-700/50 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-white">📊 Upgrade to Pro</p>
              <p className="text-gray-400 text-sm mt-1">
                Unlock Compare, Alerts, and personalized scoring weights.
              </p>
            </div>
            <Link
              href="/account"
              className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors focus-ring whitespace-nowrap"
            >
              Upgrade Now
            </Link>
          </div>
        )}

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" aria-label="Loading favorites">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl h-48 animate-pulse" aria-hidden="true" />
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4" aria-hidden="true">⭐</p>
            <h2 className="text-xl font-semibold text-gray-400 mb-2">No favorites yet</h2>
            <p className="text-gray-500 mb-6">Add mountains to track your powder windows.</p>
            <Link
              href="/mountains"
              className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors focus-ring"
            >
              Browse Mountains
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((f) => (
              <Link
                key={f.id}
                href={`/mountains/${f.mountain.id}`}
                className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-2xl overflow-hidden transition-colors group focus-ring"
                aria-label={`${f.mountain.name}, ${f.mountain.state}${f.score !== undefined ? `, score ${f.score}` : ''}`}
              >
                {f.mountain.imageUrl && (
                  <div className="h-36 bg-gray-800 overflow-hidden">
                    <img
                      src={f.mountain.imageUrl}
                      alt=""
                      aria-hidden="true"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-5 flex items-start justify-between">
                  <div>
                    <h2 className="text-white font-semibold">{f.mountain.name}</h2>
                    <p className="text-gray-400 text-sm">{f.mountain.state}</p>
                  </div>
                  {f.score !== undefined && <ScoreBadge score={f.score} />}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}