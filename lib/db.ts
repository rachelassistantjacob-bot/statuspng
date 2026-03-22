import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

export const sql = neon(DATABASE_URL);

export async function initSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS monitors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      email TEXT NOT NULL,
      interval_minutes INTEGER NOT NULL DEFAULT 5,
      alert_enabled BOOLEAN NOT NULL DEFAULT true,
      is_up BOOLEAN NOT NULL DEFAULT true,
      last_checked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS checks (
      id SERIAL PRIMARY KEY,
      monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      is_up BOOLEAN NOT NULL,
      response_time_ms INTEGER,
      status_code INTEGER,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id SERIAL PRIMARY KEY,
      monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      started_at TIMESTAMPTZ NOT NULL,
      resolved_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS checks_monitor_id_idx ON checks(monitor_id);
    CREATE INDEX IF NOT EXISTS checks_checked_at_idx ON checks(checked_at);
    CREATE INDEX IF NOT EXISTS incidents_monitor_id_idx ON incidents(monitor_id);

    CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'email',
      event TEXT NOT NULL,
      recipient TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      success BOOLEAN NOT NULL DEFAULT true,
      error_message TEXT
    );

    CREATE INDEX IF NOT EXISTS alerts_monitor_id_idx ON alerts(monitor_id);
  `;
}
