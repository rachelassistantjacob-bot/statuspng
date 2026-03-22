import { NextRequest, NextResponse } from 'next/server';
import { getAllMonitors, updateMonitorStatus, recordCheck, recordAlert, getMonitor } from '@/lib/monitor';
import { sendDownAlert, sendRecoveredAlert } from '@/lib/email';

const CRON_SECRET = process.env.CRON_SECRET || 'dev-secret';

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

export async function POST(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get('authorization');
  const secret = req.headers.get('x-cron-secret');
  if (auth !== `Bearer ${CRON_SECRET}` && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const monitors = await getAllMonitors();
  const now = Math.floor(Date.now() / 1000);
  const results = [];

  for (const monitor of monitors) {
    // Check if it's time to check this monitor
    const lastChecked = monitor.last_checked_at || 0;
    const intervalSeconds = monitor.interval_minutes * 60;
    if (now - lastChecked < intervalSeconds) {
      results.push({ id: monitor.id, skipped: true });
      continue;
    }

    const { isUp, responseTimeMs, statusCode } = await checkUrl(monitor.url);
    const wasUp = monitor.is_up;

    await recordCheck(monitor.id, isUp, responseTimeMs, statusCode);
    await updateMonitorStatus(monitor.id, isUp);

    // Send alert if status changed (only if alerts are enabled)
    if (wasUp !== isUp && monitor.alert_enabled) {
      const alertResult = isUp
        ? await sendRecoveredAlert(monitor.email, monitor.name, monitor.url, statusCode, responseTimeMs)
        : await sendDownAlert(monitor.email, monitor.name, monitor.url, statusCode, responseTimeMs);
      // Record the alert in the database (success tracks whether email actually sent)
      await recordAlert(monitor.id, isUp ? 'up' : 'down', monitor.email, alertResult.ok, alertResult.error);
    }

    results.push({ id: monitor.id, isUp, responseTimeMs, statusCode });
  }

  return NextResponse.json({ checked: results.length, results });
}

export async function GET(req: NextRequest) {
  // Allow GET for single monitor check (by id param)
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const secret = searchParams.get('secret');

  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!id) {
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
    // Record the alert in the database (success tracks whether email actually sent)
    await recordAlert(id, isUp ? 'up' : 'down', monitor.email, alertResult.ok, alertResult.error);
  }

  return NextResponse.json({ id, isUp, responseTimeMs, statusCode });
}
