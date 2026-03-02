'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import ScoreBadge from '@/components/ScoreBadge';

interface Mountain {
  id: string; name: string; state: string; country: string;
  baseElevFt: number; topElevFt: number; totalTrails: number;
  imageUrl?: string;
}

export default function MountainsPage() {
  const [mountains, setMountains]  = useState<Mountain[]>([]);
  const [scores, setScores]        = useState<Record<string, number>>({});
  const [favorites, setFavorites]  = useState<Set<string>>(new Set());
  const [search, setSearch]        = useState('');
  const [loading, setLoading]      = useState(true);
  const [token, setToken]          = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const t = data.session?.access_token || '';
      setToken(t);

      const [mRes, fRes] = await Promise.all([
        fetch('/api/mountains'),
        t
          ? fetch('/api/favorites', { headers: { Authorization: `Bearer ${t}` } })
          : Promise.resolve(null),
      ]);

      if (mRes.ok) setMountains((await mRes.json()).data || []);
      if (fRes?.ok) {
        const fData = await fRes.json();
        setFavorites(
          new Set((fData.data || []).map((f: { mountain: Mountain }) => f.mountain.id))
        );
      }
      setLoading(false);
    })();
  }, []);

  async function toggleFavorite(mountainId: string) {
    if (!token) return;
    const isFav = favorites.has(mountainId);

    if (isFav) {
      await fetch('/api/favorites', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mountainId }),
      });
      setFavorites((prev) => { const s = new Set(prev); s.delete(mountainId); return s; });
    } else {
      await fetch('/api/favorites', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mountainId }),
      });
      setFavorites((prev) => new Set(prev).add(mountainId));

      // Load score lazily
      if (!scores[mountainId]) {
        const sRes = await fetch(`/api/mountains/${mountainId}/score`);
        if (sRes.ok) {
          const s = await sRes.json();
          setScores((prev) => ({ ...prev, [mountainId]: s.data?.score }));
        }
      }
    }
  }

  const filtered = mountains.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.state.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-lg font-bold text-white focus-ring rounded">
            PowderIQ
          </Link>
          <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors focus-ring rounded">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-3xl font-bold text-white mb-6">All Mountains</h1>

        <div className="relative mb-8">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true">
            🔍
          </span>
          <input
            type="search"
            placeholder="Search mountains or states…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-500 focus-ring focus:border-brand-500 transition-colors"
            aria-label="Search mountains"
          />
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl h-52 animate-pulse" aria-hidden="true" />
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((m) => (
              <div
                key={m.id}
                className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"
              >
                {m.imageUrl && (
                  <Link href={`/mountains/${m.id}`} tabIndex={-1} aria-hidden="true">
                    <div className="h-36 bg-gray-800 overflow-hidden">
                      <img
                        src={m.imageUrl}
                        alt=""
                        aria-hidden="true"
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  </Link>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <Link
                        href={`/mountains/${m.id}`}
                        className="text-white font-semibold hover:text-brand-400 transition-colors focus-ring rounded"
                      >
                        {m.name}
                      </Link>
                      <p className="text-gray-400 text-sm">
                        {m.state}, {m.country}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {scores[m.id] !== undefined && (
                        <ScoreBadge score={scores[m.id]} size="sm" />
                      )}
                      {token && (
                        <button
                          onClick={() => toggleFavorite(m.id)}
                          aria-label={
                            favorites.has(m.id)
                              ? `Remove ${m.name} from favorites`
                              : `Add ${m.name} to favorites`
                          }
                          aria-pressed={favorites.has(m.id)}
                          className="p-1.5 rounded-lg focus-ring transition-colors text-xl"
                        >
                          {favorites.has(m.id) ? '⭐' : '☆'}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    {m.totalTrails} trails · Base {m.baseElevFt.toLocaleString()} ft · Top{' '}
                    {m.topElevFt.toLocaleString()} ft
                  </p>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-3 text-center text-gray-500 py-16">
                No mountains match &ldquo;{search}&rdquo;
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
