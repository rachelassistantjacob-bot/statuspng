import { getDb } from './db';
import { nanoid } from 'nanoid';

export interface Monitor {
  id: string;
  name: string;
  url: string;
  email: string;
  interval_minutes: number;
  is_up: number;
  last_checked_at: number | null;
  created_at: number;
}

export interface Check {
  id: number;
  monitor_id: string;
  is_up: number;
  response_time_ms: number | null;
  status_code: number | null;
  checked_at: number;
}

export function createMonitor(data: { name: string; url: string; email: string; interval_minutes?: number }): Monitor {
  const db = getDb();
  const id = nanoid(10);
  const stmt = db.prepare(`
    INSERT INTO monitors (id, name, url, email, interval_minutes)
    VALUES (@id, @name, @url, @email, @interval_minutes)
  `);
  stmt.run({ id, name: data.name, url: data.url, email: data.email, interval_minutes: data.interval_minutes ?? 5 });
  return getMonitor(id)!;
}

export function getMonitor(id: string): Monitor | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM monitors WHERE id = ?').get(id) as Monitor | undefined;
}

export function getAllMonitors(): Monitor[] {
  const db = getDb();
  return db.prepare('SELECT * FROM monitors ORDER BY created_at DESC').all() as Monitor[];
}

export function updateMonitorStatus(id: string, isUp: boolean) {
  const db = getDb();
  db.prepare('UPDATE monitors SET is_up = ?, last_checked_at = unixepoch() WHERE id = ?')
    .run(isUp ? 1 : 0, id);
}

export function recordCheck(monitorId: string, isUp: boolean, responseTimeMs: number | null, statusCode: number | null) {
  const db = getDb();
  db.prepare(`
    INSERT INTO checks (monitor_id, is_up, response_time_ms, status_code)
    VALUES (?, ?, ?, ?)
  `).run(monitorId, isUp ? 1 : 0, responseTimeMs, statusCode);
}

export function getRecentChecks(monitorId: string, limit = 100): Check[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM checks WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT ?
  `).all(monitorId, limit) as Check[];
}

export function getUptimeDots(monitorId: string, days = 30): ('up' | 'down' | 'nodata')[] {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const dots: ('up' | 'down' | 'nodata')[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = now - (i + 1) * 86400;
    const dayEnd = now - i * 86400;
    const rows = db.prepare(`
      SELECT is_up FROM checks
      WHERE monitor_id = ? AND checked_at >= ? AND checked_at < ?
    `).all(monitorId, dayStart, dayEnd) as { is_up: number }[];

    if (rows.length === 0) {
      dots.push('nodata');
    } else {
      const hasDown = rows.some(r => r.is_up === 0);
      dots.push(hasDown ? 'down' : 'up');
    }
  }
  return dots;
}

export function getUptimePercent(monitorId: string, days = 30): number {
  const db = getDb();
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const rows = db.prepare(`
    SELECT is_up FROM checks WHERE monitor_id = ? AND checked_at >= ?
  `).all(monitorId, since) as { is_up: number }[];
  if (rows.length === 0) return 100;
  const upCount = rows.filter(r => r.is_up === 1).length;
  return Math.round((upCount / rows.length) * 1000) / 10;
}

export function getAvgResponseTime(monitorId: string, days = 7): number | null {
  const db = getDb();
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const row = db.prepare(`
    SELECT AVG(response_time_ms) as avg FROM checks
    WHERE monitor_id = ? AND checked_at >= ? AND response_time_ms IS NOT NULL
  `).get(monitorId, since) as { avg: number | null };
  return row?.avg ? Math.round(row.avg) : null;
}

export function deleteMonitor(id: string) {
  const db = getDb();
  db.prepare('DELETE FROM monitors WHERE id = ?').run(id);
}
