// Shared email service for StatusPing
// Uses raw fetch() to Resend API (no resend npm package)

const DEFAULT_FROM = 'onboarding@resend.dev';

async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[Email] RESEND_API_KEY not set');
    return { ok: false, error: 'no RESEND_API_KEY' };
  }

  const from = process.env.FROM_EMAIL || DEFAULT_FROM;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error('[Email] Failed to send:', errorData);
      return { ok: false, error: errorData?.message || 'resend api error' };
    }

    return { ok: true };
  } catch (e: any) {
    console.error('[Email] Send error:', e);
    return { ok: false, error: e?.message || 'network error' };
  }
}

export async function sendDownAlert(to: string, monitorName: string, url: string, statusCode: number | null, responseTimeMs: number | null) {
  const statusText = statusCode ? `HTTP ${statusCode}` : 'No status code';
  const responseTimeText = responseTimeMs !== null ? `${responseTimeMs}ms` : 'N/A';
  const timestamp = new Date().toLocaleString();

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #ef4444;">🔴 ${monitorName} is down</h1>
      <p>The monitor for <strong>${monitorName}</strong> has detected that the site is currently unreachable.</p>
      <div style="background: #1f2937; padding: 16px; border-radius: 8px; margin: 16px 0; font-family: monospace;">
        <div><strong>URL:</strong> <a href="${url}" style="color: #60a5fa;">${url}</a></div>
        <div><strong>Status:</strong> ${statusText}</div>
        <div><strong>Response Time:</strong> ${responseTimeText}</div>
        <div><strong>Time:</strong> ${timestamp}</div>
      </div>
      <p style="color: #9ca3af; font-size: 14px;">This alert was sent by StatusPing. You will receive another alert when the site recovers.</p>
    </div>
  `;

  return sendEmail(to, `🔴 ${monitorName} is down`, html);
}

export async function sendRecoveredAlert(to: string, monitorName: string, url: string, statusCode: number | null, responseTimeMs: number | null) {
  const statusText = statusCode ? `HTTP ${statusCode}` : 'No status code';
  const responseTimeText = responseTimeMs !== null ? `${responseTimeMs}ms` : 'N/A';
  const timestamp = new Date().toLocaleString();

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #22c55e;">✅ ${monitorName} is back online</h1>
      <p>Great news! The monitor for <strong>${monitorName}</strong> has detected that the site is now responding.</p>
      <div style="background: #1f2937; padding: 16px; border-radius: 8px; margin: 16px 0; font-family: monospace;">
        <div><strong>URL:</strong> <a href="${url}" style="color: #60a5fa;">${url}</a></div>
        <div><strong>Status:</strong> ${statusText}</div>
        <div><strong>Response Time:</strong> ${responseTimeText}</div>
        <div><strong>Time:</strong> ${timestamp}</div>
      </div>
      <p style="color: #9ca3af; font-size: 14px;">This alert was sent by StatusPing. Your monitor is back online!</p>
    </div>
  `;

  return sendEmail(to, `✅ ${monitorName} is back online`, html);
}

export default {
  sendDownAlert,
  sendRecoveredAlert,
};
