import { NextRequest, NextResponse } from 'next/server';
import { getMonitor, updateMonitorStatus, recordCheck, recordAlert } from '@/lib/monitor';
import { sendDownAlert, sendRecoveredAlert } from '@/lib/email';

async function checkUrl(url: string): Promise<{ isUp: boolean; responseTimeMs: number | null; statusCode: number | null }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'StatusPing/1.0 Uptime Monitor' },
    });
    clearTimeout(timeout);
    const responseTimeMs = Date.now() - start;
    const isUp = res.status < 500;
    return { isUp, responseTimeMs, statusCode: res.status };
  } catch {
    return { isUp: false, responseTimeMs: null, statusCode: null };
  }
}

// Manual check endpoint — no cron secret required, for dashboard use only.
// Only allows checking a single monitor at a time (by id).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { id } = body;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const monitor = await getMonitor(id);
  if (!monitor) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { isUp, responseTimeMs, statusCode } = await checkUrl(monitor.url);
  const wasUp = monitor.is_up;

  await recordCheck(id, isUp, responseTimeMs, statusCode);
  await updateMonitorStatus(id, isUp);

  // Send alert if status changed (only if alerts are enabled)
  if (wasUp !== isUp && monitor.alert_enabled) {
    const alertResult = isUp
      ? await sendRecoveredAlert(monitor.email, monitor.name, monitor.url, statusCode, responseTimeMs)
      : await sendDownAlert(monitor.email, monitor.name, monitor.url, statusCode, responseTimeMs);
    await recordAlert(id, isUp ? 'up' : 'down', monitor.email, alertResult.ok, alertResult.error);
  }

  return NextResponse.json({ id, isUp, responseTimeMs, statusCode });
}
