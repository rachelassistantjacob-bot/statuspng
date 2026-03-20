import { sql, initSchema } from './db';
import { nanoid } from 'nanoid';

export interface Monitor {
  id: string;
  name: string;
  url: string;
  email: string;
  interval_minutes: number;
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

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  await initSchema();
  schemaReady = true;
}

export async function createMonitor(data: {
  name: string;
  url: string;
  email: string;
  interval_minutes?: number;
}): Promise<Monitor> {
  await ensureSchema();
  const id = nanoid(10);
  await sql(
    `INSERT INTO monitors (id, name, url, email, interval_minutes)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, data.name, data.url, data.email, data.interval_minutes ?? 5],
  );
  return (await getMonitor(id))!;
}

export async function getMonitor(id: string): Promise<Monitor | undefined> {
  await ensureSchema();
  const rows = await sql('SELECT * FROM monitors WHERE id = $1', [id]);
  return rows[0] as unknown as Monitor | undefined;
}

export async function getAllMonitors(): Promise<Monitor[]> {
  await ensureSchema();
  const rows = await sql('SELECT * FROM monitors ORDER BY created_at DESC');
  return rows as unknown as Monitor[];
}

export async function updateMonitorStatus(id: string, isUp: boolean) {
  await ensureSchema();
  await sql(
    `UPDATE monitors SET is_up = $1, last_checked_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $2`,
    [isUp, id],
  );
}

export async function recordCheck(
  monitorId: string,
  isUp: boolean,
  responseTimeMs: number | null,
  statusCode: number | null,
) {
  await ensureSchema();
  await sql(
    `INSERT INTO checks (monitor_id, is_up, response_time_ms, status_code)
     VALUES ($1, $2, $3, $4)`,
    [monitorId, isUp, responseTimeMs, statusCode],
  );
}

export async function getRecentChecks(monitorId: string, limit = 100): Promise<Check[]> {
  await ensureSchema();
  const rows = await sql(
    `SELECT * FROM checks WHERE monitor_id = $1 ORDER BY checked_at DESC LIMIT $2`,
    [monitorId, limit],
  );
  return rows as unknown as Check[];
}

export async function getUptimeDots(
  monitorId: string,
  days = 30,
): Promise<('up' | 'down' | 'nodata')[]> {
  await ensureSchema();
  const now = Math.floor(Date.now() / 1000);
  const since = now - days * 86400;

  // Fetch all checks for the period in one query
  const rows = await sql(
    `SELECT is_up, checked_at FROM checks
     WHERE monitor_id = $1 AND checked_at >= $2
     ORDER BY checked_at`,
    [monitorId, since],
  );

  const dots: ('up' | 'down' | 'nodata')[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = now - (i + 1) * 86400;
    const dayEnd = now - i * 86400;
    const dayChecks = rows.filter(
      (r: any) => Number(r.checked_at) >= dayStart && Number(r.checked_at) < dayEnd,
    );

    if (dayChecks.length === 0) {
      dots.push('nodata');
    } else {
      const hasDown = dayChecks.some((r: any) => r.is_up === false);
      dots.push(hasDown ? 'down' : 'up');
    }
  }
  return dots;
}

export async function getUptimePercent(monitorId: string, days = 30): Promise<number> {
  await ensureSchema();
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const rows = await sql(
    `SELECT is_up FROM checks WHERE monitor_id = $1 AND checked_at >= $2`,
    [monitorId, since],
  );
  if (rows.length === 0) return 100;
  const upCount = rows.filter((r: any) => r.is_up === true).length;
  return Math.round((upCount / rows.length) * 1000) / 10;
}

export async function getAvgResponseTime(monitorId: string, days = 7): Promise<number | null> {
  await ensureSchema();
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const rows = await sql(
    `SELECT AVG(response_time_ms) as avg FROM checks
     WHERE monitor_id = $1 AND checked_at >= $2 AND response_time_ms IS NOT NULL`,
    [monitorId, since],
  );
  const avg = (rows[0] as any)?.avg;
  return avg ? Math.round(Number(avg)) : null;
}

export async function deleteMonitor(id: string) {
  await ensureSchema();
  await sql('DELETE FROM monitors WHERE id = $1', [id]);
}
