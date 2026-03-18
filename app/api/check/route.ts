import { NextRequest, NextResponse } from 'next/server';
import { getAllMonitors, updateMonitorStatus, recordCheck, getMonitor } from '@/lib/monitor';

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

  const monitors = getAllMonitors();
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
    const wasUp = monitor.is_up === 1;

    recordCheck(monitor.id, isUp, responseTimeMs, statusCode);
    updateMonitorStatus(monitor.id, isUp);

    // Send alert if status changed
    if (wasUp !== isUp) {
      await sendAlert(monitor.email, monitor.name, monitor.url, isUp);
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

  const monitor = getMonitor(id);
  if (!monitor) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { isUp, responseTimeMs, statusCode } = await checkUrl(monitor.url);
  const wasUp = monitor.is_up === 1;
  recordCheck(id, isUp, responseTimeMs, statusCode);
  updateMonitorStatus(id, isUp);

  if (wasUp !== isUp) {
    await sendAlert(monitor.email, monitor.name, monitor.url, isUp);
  }

  return NextResponse.json({ id, isUp, responseTimeMs, statusCode });
}

async function sendAlert(email: string, name: string, url: string, isUp: boolean) {
  // Log to console in dev; in prod wire up Resend or Nodemailer
  console.log(`[ALERT] ${name} (${url}) is now ${isUp ? 'UP ✓' : 'DOWN ✗'} → ${email}`);

  if (process.env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.FROM_EMAIL || 'alerts@statusping.app',
          to: email,
          subject: isUp ? `✅ ${name} is back online` : `🔴 ${name} is down`,
          html: isUp
            ? `<p><strong>${name}</strong> is back online. <a href="${url}">${url}</a></p>`
            : `<p><strong>${name}</strong> is down. <a href="${url}">${url}</a> is not responding.</p><p>We'll let you know when it recovers.</p>`,
        }),
      });
    } catch (e) {
      console.error('Failed to send alert email:', e);
    }
  }
}
