# Email Alerts Architecture Research

## 1. Current `monitors` Table Fields

```sql
id TEXT PK, name TEXT, url TEXT, email TEXT, interval_minutes INT (default 5),
is_up BOOLEAN (default true), last_checked_at TIMESTAMPTZ, created_at TIMESTAMPTZ
```

**`alert_enabled` is missing.** The `email` field exists (collected on creation) but there's no toggle to disable/enable alerts per monitor. Every status change triggers `sendAlert` unconditionally.

## 2. `alerts` Table — Does Not Exist

No alerts table exists. Current tables: `monitors`, `checks`, `incidents`. Need an `alerts` table to record sent notifications:

```sql
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'email',        -- future: slack, webhook
  event TEXT NOT NULL,                        -- 'down' | 'up'
  recipient TEXT NOT NULL,                    -- email address
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS alerts_monitor_id_idx ON alerts(monitor_id);
```

## 3. `sendAlert` Function — Fire-and-Forget

Location: `app/api/check/route.ts` lines 74-103.

**What it does:** Logs to console, optionally calls Resend API if `RESEND_API_KEY` is set. Catches errors but only `console.error`s them.

**What's missing:**
- No DB record of the alert (no audit trail)
- No check of `alert_enabled` before sending
- No cooldown/dedup (if cron runs twice quickly, could double-send)
- Resend errors are silently swallowed — no retry, no record of failure
- Should insert into `alerts` table with success/failure status after each send attempt

## 4. Changes Needed in `lib/monitor.ts`

- **Add `alert_enabled` to `Monitor` interface** (default `true`)
- **Update `rowToMonitor`** to include `alert_enabled: row.alert_enabled ?? true`
- **Add `updateMonitorAlertEnabled(id, enabled)`** function
- **Add `Alert` interface** and `rowToAlert` mapper
- **Add `recordAlert(monitorId, event, recipient, success, errorMessage?)`** — INSERT into alerts table
- **Add `getAlertHistory(monitorId, limit?)`** — SELECT recent alerts for a monitor
- **Update `createMonitor`** to accept optional `alert_enabled` param (default true)

## 5. Safest Migration Approach (Neon Postgres, No ORM)

Neon serverless uses standard Postgres. Safest approach:

1. **Create a `scripts/migrate-alerts.ts`** script (like existing pattern — comment at bottom of `monitor.ts` references `scripts/migrate.ts`)
2. **Use `ALTER TABLE` — not `CREATE TABLE IF NOT EXISTS` in `initSchema`** for existing columns:
   ```sql
   ALTER TABLE monitors ADD COLUMN IF NOT EXISTS alert_enabled BOOLEAN NOT NULL DEFAULT true;
   ```
3. **Add the new `alerts` table** via `CREATE TABLE IF NOT EXISTS` (safe, idempotent)
4. **Also add to `initSchema()`** in `db.ts` so fresh deploys get everything
5. **Run migration once** via `npx tsx scripts/migrate-alerts.ts` before deploying updated code

`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` is Postgres 9.6+ (Neon supports it) — idempotent and safe to re-run.

## 6. Dashboard Changes Needed

- **Alert toggle per monitor:** Add a toggle/switch in each monitor card (near the email display) that calls `PATCH /api/monitors` to flip `alert_enabled`. Show visual state (green = alerts on, gray = off).
- **Alert history view:** Add an "Alerts" tab or expandable section per monitor showing recent alerts (time, event type, recipient, success/fail). Fetch from `GET /api/alerts?monitor_id=X`.
- **Form update:** Optionally add `alert_enabled` checkbox to the "Add Monitor" form (default checked).
- **New API routes needed:** `PATCH /api/monitors` (update alert_enabled), `GET /api/alerts` (fetch history).

## 7. TypeScript Gotchas

- **Unix seconds, not milliseconds or Dates.** `rowToMonitor` and `rowToCheck` convert `TIMESTAMPTZ` → `Math.floor(new Date(x).getTime() / 1000)` (Unix seconds). The dashboard multiplies by 1000 for display: `new Date(m.last_checked_at * 1000)`. New `Alert` interface must follow the same pattern — use `number` for `sent_at`, convert in `rowToAlert`.
- **`any` row types.** All row mappers use `row: any`. No runtime validation. New mappers should stay consistent (use `any` for now, but be careful with nulls).
- **Boolean handling.** Postgres booleans come through Neon as JS booleans — no conversion needed. `alert_enabled` will work the same as `is_up`.
- **Null coalescing.** `rowToMonitor` uses ternary for nullable timestamps. New fields should follow the same `row.x ? convert(row.x) : null` pattern.
