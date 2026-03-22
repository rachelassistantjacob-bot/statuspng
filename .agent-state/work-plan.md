# Work Plan — Email Alert System (feature/email-alerts)
# Stack: Next.js 16 / React 19 / TypeScript / Neon Postgres (serverless)

## Goal
Add per-monitor email alerts (via Resend) that fire on status transitions (UP→DOWN and DOWN→UP), with alert history stored in Neon Postgres and shown in the dashboard.

## Current State
- `monitors` table: id, name, url, email, interval_minutes, is_up, last_checked_at, created_at
- `sendAlert()` in check/route.ts handles transitions but: no alert_enabled check, no DB record, no error tracking
- Missing: `alert_enabled` column, `alerts` table, lib/email.ts, alert history UI
- Existing migration pattern: `scripts/migrate.mjs` (plain JS) — use `tsx` for new migration

---

## Tasks

### Task 1: DB Migration + Update initSchema
**Files:** `scripts/migrate-email-alerts.ts`, `lib/db.ts`

1a. Create `scripts/migrate-email-alerts.ts`:
```sql
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS alert_enabled BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'email',
  event TEXT NOT NULL,          -- 'down' | 'up'
  recipient TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS alerts_monitor_id_idx ON alerts(monitor_id);
```

1b. Update `initSchema()` in `lib/db.ts`:
- Add `alert_enabled BOOLEAN NOT NULL DEFAULT true` to the monitors CREATE TABLE statement
- Add the full `alerts` CREATE TABLE statement (with all columns above) so fresh deploys work

**Verification:** `npx tsx scripts/migrate-email-alerts.ts` — no errors

---

### Task 2: Update `lib/monitor.ts`
**Files:** `lib/monitor.ts`

2a. Add `alert_enabled: boolean` to Monitor interface.

2b. Update `rowToMonitor()` to include `alert_enabled: row.alert_enabled ?? true`.

2c. Update `createMonitor()`:
- Accept optional `alert_enabled?: boolean` param (default true)
- Include `alert_enabled` in the INSERT SQL

2d. Add `updateMonitorAlertEnabled(id: string, alertEnabled: boolean)` function.

2e. Add Alert interface:
```typescript
export interface Alert {
  id: number;
  monitor_id: string;
  type: string;        // 'email'
  event: string;       // 'down' | 'up'
  recipient: string;
  sent_at: number;     // UNIX seconds (convert with Math.floor(new Date(row.sent_at).getTime() / 1000))
  success: boolean;
  error_message: string | null;
}
```

2f. Add `rowToAlert(row: any): Alert` mapper — convert `sent_at` TIMESTAMPTZ to Unix seconds.

2g. Add `recordAlert(monitorId: string, event: 'down' | 'up', recipient: string, success: boolean, errorMessage?: string)` — INSERT into alerts table, type='email'.

2h. Add `getAlertHistory(monitorId: string, limit?: number): Promise<Alert[]>` — SELECT recent alerts ORDER BY sent_at DESC, LIMIT (default 10).

**Verification:** `npx tsc --noEmit` — no errors

---

### Task 3: Update API routes
**Files:** `app/api/monitors/route.ts`

3a. POST handler: accept `alert_enabled?: boolean` in body, pass to `createMonitor`.

3b. Add PATCH handler:
- Request body: `{ id: string, alert_enabled: boolean }`
- Calls `updateMonitorAlertEnabled(id, alert_enabled)`
- Returns `{ ok: true }`
- Validates: id and alert_enabled must be present

**Verification:** `npx tsc --noEmit`

---

### Task 4: Create `lib/email.ts` — shared email service
**Files:** `lib/email.ts` (NEW)

Use raw `fetch()` to Resend API (no resend npm package — match existing pattern).

4a. `sendDownAlert(to, monitorName, url, statusCode, responseTimeMs)`:
- Subject: `🔴 ${monitorName} is down`
- HTML: red-toned, shows status code, response time, timestamp, monitor URL
- Returns `{ ok: boolean, error?: string }`

4b. `sendRecoveredAlert(to, monitorName, url, statusCode, responseTimeMs)`:
- Subject: `✅ ${monitorName} is back online`
- HTML: green-toned, shows recovery info
- Returns `{ ok: boolean, error?: string }`

Both functions:
- Use `process.env.RESEND_API_KEY` — if not set, log to console and return `{ ok: false, error: 'no RESEND_API_KEY' }`
- From: `process.env.FROM_EMAIL || 'onboarding@resend.dev'`

**Verification:** `npx tsc --noEmit`

---

### Task 5: Update `app/api/check/route.ts`
**Files:** `app/api/check/route.ts`

5a. Import `recordAlert` from `@/lib/monitor`.
5b. Import `sendDownAlert`, `sendRecoveredAlert` from `@/lib/email`.
5c. Remove the old inline `sendAlert()` function.

5d. After each monitor check, when `wasUp !== isUp`:
- Check `monitor.alert_enabled === true` before sending
- Call appropriate function from `lib/email.ts`
- Call `recordAlert(monitor.id, isUp ? 'up' : 'down', monitor.email, result.ok, result.error)`

5e. Apply same logic to BOTH the POST handler loop AND the GET handler (single-monitor check).

5f. No dedup for v1 — document as known limitation in a comment.

**Verification:** `npx tsc --noEmit`

---

### Task 6: Add `app/api/alerts/route.ts`
**Files:** `app/api/alerts/route.ts` (NEW)

6a. GET handler:
- Accept `monitor_id` query param
- Call `getAlertHistory(monitor_id, 10)`
- Return JSON array of alerts
- Return 400 if `monitor_id` missing

**Verification:** `npx tsc --noEmit`

---

### Task 7: Update `app/dashboard/page.tsx`
**Files:** `app/dashboard/page.tsx`

7a. Update the local `Monitor` interface to add `alert_enabled: boolean`. (Keep local — can't import from lib/monitor.ts in client component since it uses server-only sql imports.)

7b. Update `handleAdd` form state to include `alert_enabled: true` by default.

7c. Add checkbox to the "New Monitor" form for alert_enabled (default checked).

7d. Add toggle button/switch on each monitor card:
- Shows "🔔" (alerts on) or "🔕" (alerts off)
- Calls PATCH /api/monitors with `{ id, alert_enabled: !m.alert_enabled }`
- Optimistic update then refetch

7e. Add alert history section per monitor card (expandable or always visible):
- State: `alertHistory: Record<string, Alert[]>` and `loadingAlerts: Set<string>`
- Add "View Alerts" button per monitor; on click, fetch GET /api/alerts?monitor_id=X
- Display last 5 alerts: time, event (⬇️ down / ⬆️ recovered), success indicator

7f. Add local Alert interface (matching lib/monitor.ts Alert interface, no imports).

**Verification:** `npm run build` — no errors or type issues

---

### Task 8: Final build check
Run `npm run build` — must pass with 0 errors, 0 type errors.

---

## Files to Modify
- `lib/db.ts` — update initSchema (alerts table + alert_enabled column)
- `lib/monitor.ts` — Monitor interface, createMonitor, alert CRUD
- `app/api/monitors/route.ts` — PATCH handler + alert_enabled in POST
- `app/api/check/route.ts` — use lib/email.ts, record alerts, alert_enabled check (both POST and GET handlers)
- `app/dashboard/page.tsx` — alert toggle, alert history

## Files to Create
- `scripts/migrate-email-alerts.ts` — DB migration
- `lib/email.ts` — Resend email service + HTML templates
- `app/api/alerts/route.ts` — alerts history endpoint

## Pitfalls
- **Neon sql is a template tag** — use `sql\`...\`` only, never `sql(params)`
- **Timestamps**: All TIMESTAMPTZ → Unix seconds via `Math.floor(new Date(x).getTime() / 1000)`. Alert.sent_at must be number, not Date
- **alert_enabled**: Postgres boolean → JS boolean (no conversion needed)
- **Client component lib isolation**: Dashboard cannot import from lib/monitor.ts (server-only sql). Use local interfaces
- **tsx not ts-node**: Use `npx tsx` for migration scripts
- **Resend from address**: Use `onboarding@resend.dev` as default (works without domain verification on Resend free tier)
- **ON DELETE CASCADE**: alerts are auto-cleaned when monitor deleted — no extra code needed
- **Both handlers**: Both POST (bulk) and GET (single) in check/route.ts must guard with alert_enabled

## Dependencies
- Task 1 (DB migration) must run before deploying any code changes
- Tasks 2, 4 can be done in parallel
- Task 3 depends on Task 2 (updateMonitorAlertEnabled)
- Task 5 depends on Tasks 2 and 4
- Task 6 depends on Task 2 (getAlertHistory)
- Task 7 depends on Task 6 (alerts API)
- Task 8 is last
