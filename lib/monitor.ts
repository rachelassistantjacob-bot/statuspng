import { sql, initSchema } from './db';
import { nanoid } from 'nanoid';

export interface Monitor {
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

export interface Check {
  id: number;
  monitor_id: string;
  is_up: boolean;
  response_time_ms: number | null;
  status_code: number | null;
  checked_at: number;
}

export interface Alert {
  id: number;
  monitor_id: string;
  type: string;
  event: string;
  recipient: string;
  sent_at: number;
  success: boolean;
  error_message: string | null;
}

export async function createMonitor(data: { name: string; url: string; email: string; interval_minutes?: number; alert_enabled?: boolean }): Promise<Monitor> {
  const id = nanoid(10);
  const alertEnabled = data.alert_enabled ?? true;
  await sql`
    INSERT INTO monitors (id, name, url, email, interval_minutes, alert_enabled)
    VALUES (${id}, ${data.name}, ${data.url}, ${data.email}, ${data.interval_minutes ?? 5}, ${alertEnabled})
  `;
  const monitor = await getMonitor(id);
  if (!monitor) throw new Error('Failed to create monitor');
  return monitor;
}

export async function getMonitor(id: string): Promise<Monitor | undefined> {
  const rows = await sql`SELECT * FROM monitors WHERE id = ${id}`;
  const row = rows[0];
  if (!row) return undefined;
  return rowToMonitor(row);
}

export async function getAllMonitors(): Promise<Monitor[]> {
  const rows = await sql`SELECT * FROM monitors ORDER BY created_at DESC`;
  return rows.map(rowToMonitor);
}

export async function updateMonitorStatus(id: string, isUp: boolean) {
  await sql`
    UPDATE monitors 
    SET is_up = ${isUp}, last_checked_at = NOW() 
    WHERE id = ${id}
  `;
}

export async function updateMonitorAlertEnabled(id: string, alertEnabled: boolean) {
  await sql`
    UPDATE monitors 
    SET alert_enabled = ${alertEnabled}
    WHERE id = ${id}
  `;
}

export async function recordCheck(monitorId: string, isUp: boolean, responseTimeMs: number | null, statusCode: number | null) {
  await sql`
    INSERT INTO checks (monitor_id, is_up, response_time_ms, status_code)
    VALUES (${monitorId}, ${isUp}, ${responseTimeMs}, ${statusCode})
  `;
}

export async function getRecentChecks(monitorId: string, limit = 100): Promise<Check[]> {
  const rows = await sql`
    SELECT * FROM checks 
    WHERE monitor_id = ${monitorId} 
    ORDER BY checked_at DESC 
    LIMIT ${limit}
  `;
  return rows.map(rowToCheck);
}

export async function getUptimeDots(monitorId: string, days = 30): Promise<('up' | 'down' | 'nodata')[]> {
  const dots: ('up' | 'down' | 'nodata')[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - (i + 1));
    const dayEnd = new Date(now);
    dayEnd.setDate(dayEnd.getDate() - i);

    const rows = await sql`
      SELECT is_up FROM checks
      WHERE monitor_id = ${monitorId} 
        AND checked_at >= ${dayStart} 
        AND checked_at < ${dayEnd}
    `;

    if (rows.length === 0) {
      dots.push('nodata');
    } else {
      const hasDown = rows.some(r => !r.is_up);
      dots.push(hasDown ? 'down' : 'up');
    }
  }
  return dots;
}

export async function getUptimePercent(monitorId: string, days = 30): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await sql`
    SELECT is_up FROM checks 
    WHERE monitor_id = ${monitorId} 
      AND checked_at >= ${since}
  `;

  if (rows.length === 0) return 100;
  const upCount = rows.filter(r => r.is_up).length;
  return Math.round((upCount / rows.length) * 1000) / 10;
}

export async function getAvgResponseTime(monitorId: string, days = 7): Promise<number | null> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await sql`
    SELECT AVG(response_time_ms) as avg FROM checks
    WHERE monitor_id = ${monitorId} 
      AND checked_at >= ${since} 
      AND response_time_ms IS NOT NULL
  `;

  const avg = rows[0]?.avg;
  return avg ? Math.round(Number(avg)) : null;
}

export async function deleteMonitor(id: string) {
  await sql`DELETE FROM monitors WHERE id = ${id}`;
}

function rowToMonitor(row: any): Monitor {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    email: row.email,
    interval_minutes: row.interval_minutes,
    alert_enabled: row.alert_enabled ?? true,
    is_up: row.is_up,
    last_checked_at: row.last_checked_at ? Math.floor(new Date(row.last_checked_at).getTime() / 1000) : null,
    created_at: row.created_at ? Math.floor(new Date(row.created_at).getTime() / 1000) : 0,
  };
}

function rowToCheck(row: any): Check {
  return {
    id: row.id,
    monitor_id: row.monitor_id,
    is_up: row.is_up,
    response_time_ms: row.response_time_ms,
    status_code: row.status_code,
    checked_at: row.checked_at ? Math.floor(new Date(row.checked_at).getTime() / 1000) : 0,
  };
}

export async function recordAlert(monitorId: string, event: 'down' | 'up', recipient: string, success: boolean, errorMessage?: string) {
  await sql`
    INSERT INTO alerts (monitor_id, type, event, recipient, success, error_message)
    VALUES (${monitorId}, 'email', ${event}, ${recipient}, ${success}, ${errorMessage ?? null})
  `;
}

export async function getAlertHistory(monitorId: string, limit = 10): Promise<Alert[]> {
  const rows = await sql`
    SELECT * FROM alerts
    WHERE monitor_id = ${monitorId}
    ORDER BY sent_at DESC
    LIMIT ${limit}
  `;
  return rows.map(rowToAlert);
}

function rowToAlert(row: any): Alert {
  return {
    id: row.id,
    monitor_id: row.monitor_id,
    type: row.type,
    event: row.event,
    recipient: row.recipient,
    sent_at: row.sent_at ? Math.floor(new Date(row.sent_at).getTime() / 1000) : 0,
    success: row.success,
    error_message: row.error_message,
  };
}

// Schema must be initialized before first use.
// Run `node scripts/migrate.ts` or call initSchema() manually.
// In production, schema is pre-created via migration.
