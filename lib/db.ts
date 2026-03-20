import { Pool } from '@neondatabase/serverless';

export type SqlRow = Record<string, unknown>;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL && process.env.NODE_ENV !== 'production') {
  console.warn('[db] DATABASE_URL is not set — queries will fail at runtime');
}

function getPool(): Pool {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return new Pool({ connectionString: DATABASE_URL });
}

export async function sql(query: string, params: unknown[] = []): Promise<SqlRow[]> {
  const pool = getPool();
  try {
    const result = await pool.query(query, params);
    return result.rows as SqlRow[];
  } finally {
    // Neon serverless pool doesn't need explicit end() per request
  }
}

export async function initSchema(): Promise<void> {
  await sql(`
    CREATE TABLE IF NOT EXISTS monitors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      email TEXT NOT NULL,
      interval_minutes INTEGER NOT NULL DEFAULT 5,
      is_up BOOLEAN NOT NULL DEFAULT TRUE,
      last_checked_at BIGINT,
      created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT)
    )
  `);

  await sql(`
    CREATE TABLE IF NOT EXISTS checks (
      id SERIAL PRIMARY KEY,
      monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      is_up BOOLEAN NOT NULL,
      response_time_ms INTEGER,
      status_code INTEGER,
      checked_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT)
    )
  `);

  await sql(`
    CREATE TABLE IF NOT EXISTS incidents (
      id SERIAL PRIMARY KEY,
      monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      started_at BIGINT NOT NULL,
      resolved_at BIGINT
    )
  `);

  await sql(`
    CREATE INDEX IF NOT EXISTS idx_checks_monitor_checked
    ON checks (monitor_id, checked_at DESC)
  `);
}
