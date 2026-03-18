'use client';
import Link from 'next/link';
import { useState } from 'react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ slug?: string; error?: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/monitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url, email }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ slug: data.id });
        setUrl(''); setEmail(''); setName('');
      } else {
        setResult({ error: data.error || 'Something went wrong' });
      }
    } catch {
      setResult({ error: 'Network error' });
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
          </div>
          <span className="font-bold text-lg tracking-tight">StatusPing</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-gray-400">
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          <a href="#features" className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-1.5 rounded-full hover:bg-emerald-500/20 transition-colors">
            Start Free
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-sm text-emerald-400 mb-8">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Free uptime monitoring
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
          Know when your site<br />
          <span className="text-emerald-400">goes down.</span>
        </h1>
        <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
          Simple uptime monitoring for developers and small businesses. Get instant email alerts and share a beautiful status page with your users.
        </p>

        {/* Quick Add Form */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 max-w-lg mx-auto">
          <h2 className="text-lg font-semibold mb-6 text-left">Start monitoring in 30 seconds</h2>
          {result?.slug ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">✓</span>
              </div>
              <p className="text-emerald-400 font-semibold mb-2">Monitor created!</p>
              <p className="text-gray-400 text-sm mb-4">Your status page is live at:</p>
              <Link
                href={`/status/${result.slug}`}
                className="text-emerald-400 hover:underline break-all text-sm"
              >
                /status/{result.slug}
              </Link>
              <div className="mt-6 flex gap-3">
                <Link href={`/status/${result.slug}`} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-2 px-4 rounded-lg transition-colors text-sm">
                  View Status Page
                </Link>
                <button
                  onClick={() => setResult(null)}
                  className="flex-1 bg-white/10 hover:bg-white/15 py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  Add Another
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Monitor name (e.g. My Blog)"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:bg-white/8 transition-colors"
              />
              <input
                type="url"
                placeholder="https://yoursite.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:bg-white/8 transition-colors"
              />
              <input
                type="email"
                placeholder="you@example.com (for alerts)"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:bg-white/8 transition-colors"
              />
              {result?.error && (
                <p className="text-red-400 text-sm">{result.error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-semibold py-3 rounded-lg transition-colors"
              >
                {loading ? 'Creating...' : 'Start Monitoring Free →'}
              </button>
              <p className="text-xs text-gray-500 text-center">No credit card. No account needed.</p>
            </form>
          )}
        </div>
      </section>

      {/* Stats bar */}
      <div className="border-y border-white/5 bg-white/2 py-8">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-8 text-center">
          {[
            { value: '99.9%', label: 'Avg uptime tracked' },
            { value: '<1min', label: 'Alert delivery time' },
            { value: '30 days', label: 'Free history' },
          ].map(s => (
            <div key={s.label}>
              <div className="text-2xl font-bold text-emerald-400">{s.value}</div>
              <div className="text-sm text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-24">
        <h2 className="text-3xl font-bold text-center mb-4">Everything you need to stay online</h2>
        <p className="text-gray-400 text-center mb-16">Simple, powerful, and free for indie developers</p>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: '⚡',
              title: 'Instant Alerts',
              desc: 'Get notified the moment your site goes down. Email alerts with full incident details.',
            },
            {
              icon: '📊',
              title: 'Public Status Pages',
              desc: 'Auto-generated status pages show 30-day uptime history and current response times.',
            },
            {
              icon: '🌐',
              title: 'Global Checks',
              desc: 'We check your site every 5 minutes from multiple locations to eliminate false positives.',
            },
            {
              icon: '📈',
              title: 'Response Time Tracking',
              desc: 'Monitor average response times and spot performance degradation before users notice.',
            },
            {
              icon: '🔒',
              title: 'No Setup Required',
              desc: 'Just paste your URL and email. Your status page is live in under a minute.',
            },
            {
              icon: '📱',
              title: 'Incident History',
              desc: 'See every downtime incident with start/end times and duration in your dashboard.',
            },
          ].map(f => (
            <div key={f.title} className="bg-white/3 border border-white/8 rounded-xl p-6 hover:border-white/15 transition-colors">
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Status Page Preview */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="bg-white/3 border border-white/10 rounded-2xl p-8">
          <h3 className="text-xl font-bold mb-2">Status page preview</h3>
          <p className="text-gray-400 text-sm mb-8">This is what your users see when they check status</p>
          <div className="space-y-4">
            {['API Server', 'Web App', 'CDN'].map((service, i) => (
              <div key={service} className="flex items-center gap-4 bg-white/3 rounded-xl p-4">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${i === 1 ? 'bg-red-500' : 'bg-emerald-500'}`} />
                <span className="flex-1 font-medium text-sm">{service}</span>
                <div className="flex gap-1">
                  {Array.from({ length: 30 }, (_, j) => (
                    <div
                      key={j}
                      className={`w-2 h-6 rounded-sm ${
                        i === 1 && j === 22 ? 'bg-red-500' :
                        j < 3 ? 'bg-gray-700' :
                        'bg-emerald-500'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-gray-400 w-14 text-right">{i === 1 ? '99.2%' : '100%'}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-5xl mx-auto px-6 pb-24">
        <h2 className="text-3xl font-bold text-center mb-4">Simple pricing</h2>
        <p className="text-gray-400 text-center mb-16">Start free. Upgrade when you need more.</p>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              name: 'Free',
              price: '$0',
              period: 'forever',
              features: ['1 monitor', '5-minute checks', 'Email alerts', 'Public status page', '30-day history'],
              cta: 'Get Started',
              highlight: false,
            },
            {
              name: 'Pro',
              price: '$5',
              period: '/month',
              features: ['10 monitors', '1-minute checks', 'Slack & Discord webhooks', 'Custom domain', '90-day history'],
              cta: 'Coming Soon',
              highlight: true,
            },
            {
              name: 'Business',
              price: '$15',
              period: '/month',
              features: ['Unlimited monitors', '30-second checks', 'SMS alerts', 'Team access', '1-year history'],
              cta: 'Coming Soon',
              highlight: false,
            },
          ].map(plan => (
            <div
              key={plan.name}
              className={`rounded-2xl p-8 border ${
                plan.highlight
                  ? 'bg-emerald-500/10 border-emerald-500/40 relative'
                  : 'bg-white/3 border-white/10'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-black text-xs font-bold px-3 py-1 rounded-full">
                  MOST POPULAR
                </div>
              )}
              <div className="mb-6">
                <div className="text-gray-400 text-sm mb-1">{plan.name}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-gray-400 text-sm">{plan.period}</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                    <span className="text-emerald-400">✓</span> {f}
                  </li>
                ))}
              </ul>
              <button
                className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                  plan.highlight
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                    : 'bg-white/10 hover:bg-white/15 text-white'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>
            <span>StatusPing</span>
          </div>
          <span>© 2024 StatusPing. Simple uptime monitoring.</span>
        </div>
      </footer>
    </main>
  );
}
