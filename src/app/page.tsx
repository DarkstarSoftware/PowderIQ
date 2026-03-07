import Link from 'next/link';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-blue-950/20 to-gray-950">
      {/* Nav */}
      <nav
        className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50"
        aria-label="Main navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2" aria-label="PowderIQ logo">
            <span className="text-2xl" aria-hidden="true">❄️</span>
            <span className="text-xl font-bold text-white">PowderIQ</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/auth/login"
              className="text-gray-400 hover:text-white transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-2 py-1"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-900/40 border border-blue-700/50 rounded-full px-4 py-1.5 text-sm text-blue-300 mb-6">
          <span aria-hidden="true">❄️</span>
          <span>Real-time powder intelligence</span>
        </div>
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-tight mb-6">
          Know before you go.
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-300">
            Score the powder.
          </span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          PowderIQ aggregates snowfall, weather, and resort data into one
          intelligent score — personalized for your riding style.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/auth/signup"
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Start Free Today
          </Link>
          <Link
            href="/auth/login"
            className="border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white px-8 py-4 rounded-xl text-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Feature Cards */}
      <section
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24"
        aria-label="Features"
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              emoji: '🏔️',
              title: 'Powder Score',
              desc: 'Real-time 0–100 score based on snowfall, wind, base depth, and more.',
            },
            {
              emoji: '📊',
              title: 'Mountain Compare',
              desc: 'Side-by-side comparison of multiple resorts to pick your best day.',
            },
            {
              emoji: '🔔',
              title: 'Powder Alerts',
              desc: 'Get notified when your favorites hit your score threshold.',
            },
            {
              emoji: '🗺️',
              title: 'Lift Planning',
              desc: 'Detailed forecast breakdown helps you plan which runs to hit first.',
            },
          ].map((f) => (
            <article
              key={f.title}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-6"
            >
              <span className="text-3xl mb-4 block" aria-hidden="true">
                {f.emoji}
              </span>
              <h3 className="text-white font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>
            <span aria-hidden="true">❄️ </span>PowderIQ ©{' '}
            {new Date().getFullYear()}
          </p>
          <nav aria-label="Footer links" className="flex gap-6">
            <Link
              href="/auth/signup"
              className="hover:text-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 rounded"
            >
              Sign Up
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
