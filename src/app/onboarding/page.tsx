'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

const STYLES = [
  { value: 'powder',      label: 'Powder Hunter',      emoji: '❄️' },
  { value: 'all_mountain',label: 'All Mountain',        emoji: '🏔️' },
  { value: 'freestyle',   label: 'Freestyle / Park',    emoji: '🛹' },
  { value: 'beginner',    label: 'Learning / Groomer',  emoji: '🎿' },
];

const LEVELS = [
  { value: 'beginner',     label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'expert',       label: 'Expert' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName]   = useState('');
  const [style, setStyle] = useState('all_mountain');
  const [skill, setSkill] = useState('intermediate');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      router.push('/auth/login');
      return;
    }

    const res = await fetch('/api/me/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        displayName: name || undefined,
        style,
        skillLevel: skill,
      }),
    });

    if (!res.ok) {
      setError('Failed to save profile. Please try again.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <h1 className="text-4xl font-bold text-white text-center mb-2">
          Set up your profile
        </h1>
        <p className="text-gray-400 text-center mb-8">
          Help us personalize your powder scores.
        </p>

        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-8"
          aria-label="Profile setup form"
        >
          {error && (
            <div role="alert" className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-300 mb-2">
              Your name <span className="text-gray-500">(optional)</span>
            </label>
            <input
              id="displayName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus-ring focus:border-brand-500 transition-colors"
              placeholder="Shredder McPow"
            />
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-gray-300 mb-3">
              Riding style
            </legend>
            <div className="grid grid-cols-2 gap-3">
              {STYLES.map((s) => (
                <label
                  key={s.value}
                  className={`cursor-pointer flex items-center gap-3 p-4 rounded-xl border-2 transition-colors ${
                    style === s.value
                      ? 'border-brand-500 bg-brand-900/30'
                      : 'border-gray-700 hover:border-gray-500'
                  }`}
                >
                  <input
                    type="radio"
                    name="style"
                    value={s.value}
                    checked={style === s.value}
                    onChange={() => setStyle(s.value)}
                    className="sr-only"
                  />
                  <span className="text-2xl" aria-hidden="true">{s.emoji}</span>
                  <span className="text-sm font-medium text-white">{s.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-300 mb-3">
              Skill level
            </legend>
            <div className="flex gap-3">
              {LEVELS.map((l) => (
                <label
                  key={l.value}
                  className={`flex-1 cursor-pointer text-center p-3 rounded-lg border-2 transition-colors text-sm font-medium ${
                    skill === l.value
                      ? 'border-brand-500 bg-brand-900/30 text-white'
                      : 'border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <input
                    type="radio"
                    name="skill"
                    value={l.value}
                    checked={skill === l.value}
                    onChange={() => setSkill(l.value)}
                    className="sr-only"
                  />
                  {l.label}
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white py-3 rounded-lg font-semibold transition-colors focus-ring"
          >
            {loading ? 'Saving…' : 'Go to Dashboard →'}
          </button>
        </form>
      </div>
    </div>
  );
}
