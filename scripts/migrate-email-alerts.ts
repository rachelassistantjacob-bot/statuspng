#!/usr/bin/env tsx
// Run: npx tsx scripts/migrate-email-alerts.ts
// Creates the database schema for email alerts in Neon Postgres.
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
  console.log('Adding email alert schema...');

  // Add alert_enabled column to monitors table
  await sql`
    ALTER TABLE monitors ADD COLUMN IF NOT EXISTS alert_enabled BOOLEAN NOT NULL DEFAULT true
  `;

  // Create alerts table
  await sql`
    CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'email',
      event TEXT NOT NULL,
      recipient TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      success BOOLEAN NOT NULL DEFAULT true,
      error_message TEXT
    )
  `;

  // Create index on alerts for monitor_id
  await sql`CREATE INDEX IF NOT EXISTS alerts_monitor_id_idx ON alerts(monitor_id)`;

  console.log('✅ Email alert schema created successfully!');
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
