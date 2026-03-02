'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import ScoreBadge from '@/components/ScoreBadge';
import ForecastBreakdown from '@/components/ForecastBreakdown';

interface Mountain {
  id: string; name: string; state: string; country: string;
  baseElevFt: number; topElevFt: number;
  totalTrails: number; totalLifts: number;
  imageUrl?: string; websiteUrl?: string;
}
interface ScoreData {
  score: number;
  breakdown: Record<string, number>;
  explanation: string;
}

export default function MountainDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [mountain, setMountain]   = useState<Mountain | null>(null);
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [isFav, setIsFav]         = useState(false);
  const [loading, setLoading]     = useState(true);
  const [token, setToken]         = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const t = data.session?.access_token || '';
      setToken(t);

      const [mRes, sRes, fRes] = await Promise.all([
        fetch(`/api/mountains/${id}`),
        fetch(`/api/mountains/${id}/score`, t ? { headers: { Authorization: `Bearer ${t}` } } : {}),
        t
          ? fetch('/api/favorites', { headers: { Authorization: `Bearer ${t}` } })
          : Promise.resolve(null),
      ]);

      if (mRes.ok) setMountain((await mRes.json()).data);
      if (sRes.ok) setScoreData((await sRes.json()).data);
      if (fRes?.ok) {
        const fData = await fRes.json();
        setIsFav((fData.data || []).some((f: { mountain: { id: string } }) => f.mountain.id === id));
      }
      setLoading(false);
    })();
  }, [id]);

  async function toggleFavorite() {
    if (!token) return;
    if (isFav) {
      await fetch('/api/favorites', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mountainId: id }),
      });
      setIsFav(false);
    } else {
      await fetch('/api/favorites', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mountainId: id }),
      });
      setIsFav(true);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div
          className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label="Loading mountain details"
        />
      </div>
    );
  }

  if (!mountain) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        Mountain not found.{' '}
        <Link href="/mountains" className="text-brand-400 ml-2 focus-ring rounded">
          Browse mountains
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/mountains" className="text-gray-400 hover:text-white text-sm transition-colors focus-ring rounded">
            ← Mountains
          </Link>
          <Link href="/dashboard" className="text-lg font-bold text-white focus-ring rounded">
            PowderIQ
          </Link>
        </div>
      </header>

      {mountain.imageUrl && (
        <div className="h-64 sm:h-80 relative overflow-hidden" aria-hidden="true">
          <img
            src={mountain.imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent" />
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 -mt-16 relative">
        {/* Title row */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white">{mountain.name}</h1>
            <p className="text-gray-400 mt-1">
              {mountain.state}, {mountain.country}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {scoreData && <ScoreBadge score={scoreData.score} size="lg" />}
            {token && (
              <button
                onClick={toggleFavorite}
                aria-pressed={isFav}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors focus-ring ${
                  isFav
                    ? 'border-yellow-600 text-yellow-400 bg-yellow-900/20'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                {isFav ? '⭐ Favorited' : '☆ Favorite'}
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Base Elev.', value: `${mountain.baseElevFt.toLocaleString()} ft` },
            { label: 'Top Elev.',  value: `${mountain.topElevFt.toLocaleString()} ft` },
            { label: 'Trails',     value: mountain.totalTrails },
            { label: 'Lifts',      value: mountain.totalLifts },
          ].map((stat) => (
            <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Score breakdown */}
        {scoreData && (
          <section
            className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6"
            aria-labelledby="score-heading"
          >
            <h2 id="score-heading" className="text-xl font-semibold text-white mb-3">
              Today&apos;s Powder Score
            </h2>
            <p className="text-gray-300 leading-relaxed mb-6">{scoreData.explanation}</p>
            <ForecastBreakdown breakdown={scoreData.breakdown} />
          </section>
        )}

        {mountain.websiteUrl && (
          <a
            href={mountain.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-brand-400 hover:text-brand-300 transition-colors focus-ring rounded text-sm"
          >
            Visit Resort Website ↗
          </a>
        )}
      </main>
    </div>
  );
}
