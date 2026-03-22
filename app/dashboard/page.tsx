'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Monitor {
  id: string;
  name: string;
  url: string;
  email: string;
  interval_minutes: number;
  alert_enabled: boolean;
  is_up: boolean;
  last_checked_at: number | null;
  created_at: number;
}

interface Alert {
  id: number;
  monitor_id: string;
  type: string;
  event: string;
  recipient: string;
  sent_at: number;
  success: boolean;
  error_message: string | null;
}

export default function DashboardPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', email: '', alert_enabled: true });
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [alertHistory, setAlertHistory] = useState<Record<string, Alert[]>>({});
  const [loadingAlerts, setLoadingAlerts] = useState<Set<string>>(new Set());

  async function fetchMonitors() {
    const res = await fetch('/api/monitors');
    const data = await res.json();
    setMonitors(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { fetchMonitors(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch('/api/monitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, alert_enabled: true }),
    });
    setForm({ name: '', url: '', email: '', alert_enabled: true });
    setShowForm(false);
    setSubmitting(false);
    fetchMonitors();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this monitor?')) return;
    await fetch('/api/monitors', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchMonitors();
  }

  async function handleCheck(id: string) {
    setChecking(id);
    await fetch(`/api/check?id=${id}&secret=${process.env.NEXT_PUBLIC_CRON_SECRET || 'dev-secret'}`);
    await fetchMonitors();
    setChecking(null);
  }

  async function toggleAlerts(monitor: Monitor) {
    const newEnabled = !monitor.alert_enabled;
    // Optimistic update
    setMonitors(prev => prev.map(m => m.id === monitor.id ? { ...m, alert_enabled: newEnabled } : m));
    try {
      await fetch('/api/monitors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: monitor.id, alert_enabled: newEnabled }),
      });
    } catch (e) {
      console.error('Failed to update alert settings:', e);
      // Revert on error
      setMonitors(prev => prev.map(m => m.id === monitor.id ? { ...m, alert_enabled: monitor.alert_enabled } : m));
    }
  }

  async function fetchAlertHistory(monitorId: string) {
    if (loadingAlerts.has(monitorId) || alertHistory[monitorId]) return;
    setLoadingAlerts(prev => new Set(prev).add(monitorId));
    try {
      const res = await fetch(`/api/alerts?monitor_id=${monitorId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setAlertHistory(prev => ({ ...prev, [monitorId]: data }));
      }
    } catch (e) {
      console.error('Failed to fetch alert history:', e);
    } finally {
      setLoadingAlerts(prev => {
        const next = new Set(prev);
        next.delete(monitorId);
        return next;
      });
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-white" />
              </div>
              <span className="font-bold text-base text-gray-400">StatusPing</span>
            </Link>
            <span className="text-gray-700">/</span>
            <span className="text-gray-300">Dashboard</span>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            + Add Monitor
          </button>
        </div>

        {/* Add Form */}
        {showForm && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
            <h2 className="font-semibold mb-4">New Monitor</h2>
            <form onSubmit={handleAdd} className="grid md:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="Name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
              />
              <input
                type="url"
                placeholder="https://yoursite.com"
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                required
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
              />
              <input
                type="email"
                placeholder="alert@email.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
              />
              <div className="md:col-span-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="alert_enabled"
                  checked={form.alert_enabled}
                  onChange={e => setForm(f => ({ ...f, alert_enabled: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-600 text-emerald-500 focus:ring-emerald-500/50"
                />
                <label htmlFor="alert_enabled" className="text-sm text-gray-300">Enable email alerts</label>
              </div>
              <div className="md:col-span-3 flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  {submitting ? 'Adding...' : 'Add Monitor'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="bg-white/10 hover:bg-white/15 px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Monitors List */}
        {loading ? (
          <div className="text-center text-gray-500 py-20">Loading...</div>
        ) : monitors.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📡</div>
            <p className="text-gray-400 mb-2">No monitors yet</p>
            <p className="text-gray-600 text-sm">Add your first monitor to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-gray-500 mb-2">{monitors.length} monitor{monitors.length !== 1 ? 's' : ''}</div>
            {monitors.map(m => (
              <div key={m.id} className="bg-white/3 border border-white/8 rounded-xl p-5 hover:border-white/15 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${m.is_up === true ? 'bg-emerald-500' : 'bg-red-500'} ${m.is_up ? 'animate-pulse' : ''}`} />
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{m.name}</div>
                      <div className="text-xs text-gray-500 truncate">{m.url}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleAlerts(m)}
                      title={m.alert_enabled ? "Disable alerts" : "Enable alerts"}
                      className={`text-xl transition-colors ${m.alert_enabled ? 'text-emerald-400' : 'text-gray-600 hover:text-gray-400'}`}
                    >
                      {m.alert_enabled ? '🔔' : '🔕'}
                    </button>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      m.is_up === true ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {m.is_up === true ? 'UP' : 'DOWN'}
                    </span>
                    <button
                      onClick={() => handleCheck(m.id)}
                      disabled={checking === m.id}
                      className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                      {checking === m.id ? '...' : 'Check'}
                    </button>
                    <Link
                      href={`/status/${m.id}`}
                      className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      Status
                    </Link>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-xs text-red-400/70 hover:text-red-400 px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-600">
                  <span>Every {m.interval_minutes}min</span>
                  <span>·</span>
                  <span>{m.email}</span>
                  {m.last_checked_at && (
                    <>
                      <span>·</span>
                      <span>Last checked {new Date(m.last_checked_at * 1000).toLocaleString()}</span>
                    </>
                  )}
                </div>
                {/* Alert History Section */}
                <div className="mt-3 pt-3 border-t border-white/5">
                  <button
                    onClick={() => fetchAlertHistory(m.id)}
                    disabled={loadingAlerts.has(m.id) || !!alertHistory[m.id]}
                    className="text-xs text-gray-400 hover:text-emerald-400 disabled:opacity-50 transition-colors"
                  >
                    {loadingAlerts.has(m.id) ? 'Loading alerts...' : alertHistory[m.id] ? 'View more' : '+ View alerts'}
                  </button>
                  {alertHistory[m.id] && alertHistory[m.id].length > 0 && (
                    <div className="mt-2 space-y-1">
                      {alertHistory[m.id]!.slice(0, 5).map(alert => (
                        <div key={alert.id} className="flex items-center gap-2 text-xs text-gray-500">
                          <span className={alert.event === 'down' ? 'text-red-400' : 'text-emerald-400'}>
                            {alert.event === 'down' ? '⬇️' : '⬆️'}
                          </span>
                          <span>{new Date(alert.sent_at * 1000).toLocaleString()}</span>
                          <span className={alert.success ? 'text-emerald-600' : 'text-red-500'}>
                            {alert.success ? '✓ sent' : '✗ failed'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
