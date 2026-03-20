import { getMonitor, getUptimeDots, getUptimePercent, getAvgResponseTime, getRecentChecks } from '@/lib/monitor';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function StatusPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const monitor = await getMonitor(slug);
  if (!monitor) notFound();

  const dots = await getUptimeDots(slug, 30);
  const uptime = await getUptimePercent(slug, 30);
  const avgResponse = await getAvgResponseTime(slug, 7);
  const recentChecks = await getRecentChecks(slug, 10);

  const isUp = Boolean(monitor.is_up);

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-gray-100 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-12 flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-white" />
          </div>
          <span className="font-bold text-base text-gray-400">StatusPing</span>
        </div>

        {/* Status Card */}
        <div className={`rounded-2xl border p-8 mb-8 ${
          isUp
            ? 'bg-emerald-500/5 border-emerald-500/20'
            : 'bg-red-500/5 border-red-500/20'
        }`}>
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-4 h-4 rounded-full ${isUp ? 'bg-emerald-500' : 'bg-red-500'} ${isUp ? 'animate-pulse' : ''}`} />
            <h1 className="text-2xl font-bold">{monitor.name}</h1>
          </div>
          <p className={`text-lg font-medium ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
            {isUp ? 'All systems operational' : 'Service disruption detected'}
          </p>
          <p className="text-sm text-gray-500 mt-1 break-all">{monitor.url}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white/3 border border-white/8 rounded-xl p-5">
            <div className="text-3xl font-bold text-emerald-400">{uptime}%</div>
            <div className="text-sm text-gray-400 mt-1">Uptime (30 days)</div>
          </div>
          <div className="bg-white/3 border border-white/8 rounded-xl p-5">
            <div className="text-3xl font-bold text-blue-400">
              {avgResponse !== null ? `${avgResponse}ms` : '—'}
            </div>
            <div className="text-sm text-gray-400 mt-1">Avg response (7d)</div>
          </div>
        </div>

        {/* Uptime Dots */}
        <div className="bg-white/3 border border-white/8 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">30-Day History</h2>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> Up</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" /> Down</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gray-700 inline-block" /> No data</span>
            </div>
          </div>
          <div className="flex gap-1">
            {dots.map((dot, i) => (
              <div
                key={i}
                title={`Day ${i + 1}: ${dot}`}
                className={`flex-1 h-8 rounded-sm ${
                  dot === 'up' ? 'bg-emerald-500' :
                  dot === 'down' ? 'bg-red-500' :
                  'bg-gray-700'
                }`}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-600 mt-2">
            <span>30 days ago</span>
            <span>Today</span>
          </div>
        </div>

        {/* Recent Checks */}
        {recentChecks.length > 0 && (
          <div className="bg-white/3 border border-white/8 rounded-xl p-6">
            <h2 className="font-semibold text-sm mb-4">Recent Checks</h2>
            <div className="space-y-2">
              {recentChecks.map(check => (
                <div key={check.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${check.is_up ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className={check.is_up ? 'text-emerald-400' : 'text-red-400'}>
                      {check.is_up ? 'Up' : 'Down'}
                    </span>
                    {check.status_code && (
                      <span className="text-gray-500">HTTP {check.status_code}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-gray-500">
                    {check.response_time_ms !== null && (
                      <span>{check.response_time_ms}ms</span>
                    )}
                    <span>{new Date(check.checked_at * 1000).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 text-xs text-gray-600">
          Powered by <a href="/" className="text-gray-500 hover:text-gray-300 transition-colors">StatusPing</a>
        </div>
      </div>
    </main>
  );
}
