#!/usr/bin/env node
// Run: node scripts/migrate.mjs
// Creates the database schema in Neon Postgres.
// Requires DATABASE_URL environment variable.

import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required. Set it in .env.local or as an env var.');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function migrate() {
  console.log('Creating schema...');

  await sql`
    CREATE TABLE IF NOT EXISTS monitors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      email TEXT NOT NULL,
      interval_minutes INTEGER NOT NULL DEFAULT 5,
      is_up BOOLEAN NOT NULL DEFAULT true,
      last_checked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS checks (
      id SERIAL PRIMARY KEY,
      monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      is_up BOOLEAN NOT NULL,
      response_time_ms INTEGER,
      status_code INTEGER,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS incidents (
      id SERIAL PRIMARY KEY,
      monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      started_at TIMESTAMPTZ NOT NULL,
      resolved_at TIMESTAMPTZ
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS checks_monitor_id_idx ON checks(monitor_id)`;
  await sql`CREATE INDEX IF NOT EXISTS checks_checked_at_idx ON checks(checked_at)`;
  await sql`CREATE INDEX IF NOT EXISTS incidents_monitor_id_idx ON incidents(monitor_id)`;

  console.log('✅ Schema created successfully!');
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
