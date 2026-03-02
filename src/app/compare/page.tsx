'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import ScoreBadge from '@/components/ScoreBadge';

interface Mountain { id: string; name: string; state: string }
interface ScoreData { score: number; breakdown: Record<string, number>; explanation: string }
interface CompareResult { mountain: Mountain; scoreData: ScoreData }

const LABELS: Record<string, string> = {
  snowfall24h: '24h Snowfall', snowfall7d: '7-Day Snowfall',
  baseDepth: 'Base Depth', wind: 'Wind',
  tempStability: 'Temp Stability', crowd: 'Crowd Factor',
};

export default function ComparePage() {
  const [mountains, setMountains] = useState<Mountain[]>([]);
  const [selected, setSelected]   = useState<string[]>([]);
  const [results, setResults]     = useState<CompareResult[]>([]);
  const [isPro, setIsPro]         = useState(false);
  const [loading, setLoading]     = useState(false);
  const [token, setToken]         = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const t = data.session?.access_token || '';
      setToken(t);
      if (t) {
        const meRes = await fetch('/api/me', { headers: { Authorization: `Bearer ${t}` } });
        if (meRes.ok) {
          const me = await meRes.json();
          setIsPro(me.data?.role === 'pro_user' || me.data?.role === 'admin');
        }
      }
      const mRes = await fetch('/api/mountains');
      if (mRes.ok) setMountains((await mRes.json()).data || []);
    })();
  }, []);

  async function runCompare() {
    if (selected.length < 2) return;
    setLoading(true);
    const res = await fetch('/api/compare', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mountainIds: selected }),
    });
    if (res.ok) setResults((await res.json()).data || []);
    setLoading(false);
  }

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 4
        ? [...prev, id]
        : prev
    );
  }

  if (!isPro) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-5xl mb-4" aria-hidden="true">📊</p>
          <h1 className="text-3xl font-bold text-white mb-4">Pro Feature</h1>
          <p className="text-gray-400 mb-6">
            Mountain comparison is available on the Pro plan.
          </p>
          <Link
            href="/account"
            className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors focus-ring"
          >
            Upgrade to Pro
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
          <span className="text-lg font-bold text-white">Compare Mountains</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-white mb-6">Mountain Comparison</h1>

        <section
          className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8"
          aria-label="Mountain selector"
        >
          <p className="text-sm text-gray-400 mb-4">Select 2–4 mountains to compare</p>
          <div className="flex flex-wrap gap-3 mb-4" role="group" aria-label="Mountains">
            {mountains.map((m) => {
              const sel = selected.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggle(m.id)}
                  aria-pressed={sel}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors focus-ring ${
                    sel
                      ? 'border-brand-500 bg-brand-900/30 text-brand-300'
                      : 'border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
          <button
            onClick={runCompare}
            disabled={selected.length < 2 || loading}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors focus-ring"
          >
            {loading ? 'Comparing…' : 'Compare Selected'}
          </button>
        </section>

        {results.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" aria-label="Mountain comparison results">
              <thead>
                <tr>
                  <th className="text-left text-gray-500 text-sm py-3 pr-6 font-medium">
                    Metric
                  </th>
                  {results.map((r) => (
                    <th
                      key={r.mountain.id}
                      className="text-center text-white font-semibold py-3 px-4 min-w-[130px]"
                      scope="col"
                    >
                      {r.mountain.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-800">
                  <td className="text-gray-400 text-sm py-4 pr-6">Overall Score</td>
                  {results.map((r) => (
                    <td key={r.mountain.id} className="text-center py-4 px-4">
                      <ScoreBadge score={r.scoreData.score} />
                    </td>
                  ))}
                </tr>
                {Object.entries(LABELS).map(([key, label]) => (
                  <tr key={key} className="border-t border-gray-800">
                    <td className="text-gray-400 text-sm py-3 pr-6">{label}</td>
                    {results.map((r) => {
                      const val = r.scoreData.breakdown[key] ?? 0;
                      return (
                        <td key={r.mountain.id} className="text-center py-3 px-4 text-white text-sm tabular-nums">
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
