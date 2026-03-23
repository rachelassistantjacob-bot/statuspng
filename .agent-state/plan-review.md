# Plan Review — Email Alert System

## Verdict: NEEDS_REVISION

The plan is solid structurally — tasks are well-ordered, the DB schema is sound, and most files are correctly identified. However, there are several issues that will cause build failures or runtime bugs if not addressed.

---

## Critical Issues (will break build or runtime)

### 1. Next.js version is 16, not 14
The task spec says "Next.js 14, TypeScript strict" but `package.json` shows `"next": "16.1.7"`. This matters because:
- Next.js 16 uses React 19 (confirmed: `"react": "19.2.3"`)
- Some patterns (e.g. route handler signatures, client component conventions) may differ
- The plan should note this to avoid the coder targeting Next.js 14 idioms

**Fix:** Update plan header to say Next.js 16 / React 19. No code changes needed — the existing patterns in the codebase are already Next.js 16-compatible.

### 2. Alerts table schema mismatch between plan and research
The plan's `alerts` table has:
```sql
type TEXT NOT NULL, -- 'down' | 'recovered'
sent_at, status_code, response_time_ms, email_to
```
The research recommends:
```sql
type TEXT NOT NULL DEFAULT 'email',  -- future: slack, webhook
event TEXT NOT NULL,                  -- 'down' | 'up'
recipient TEXT, success BOOLEAN, error_message TEXT
```

The research schema is better because:
- It separates notification channel (`type`) from event (`event`) — future-proof for Slack/webhooks
- It tracks `success` and `error_message` — critical for debugging failed sends (research §3 specifically calls out that Resend errors are silently swallowed)
- The plan's schema loses error tracking entirely

**Fix:** Adopt the research schema. Add `success BOOLEAN NOT NULL DEFAULT true` and `error_message TEXT` columns. Rename `type` to `event` and add `type` for notification channel.

### 3. Migration script uses `ts-node` but project has no `ts-node` dependency
Plan says: `npx ts-node -e "require('./scripts/migrate-email-alerts')"`. The existing migration is `migrate.mjs` (plain JS). The project doesn't have `ts-node` in devDependencies.

**Fix:** Either use `npx tsx scripts/migrate-email-alerts.ts` (tsx works without install) or write it as `.mjs` to match existing pattern. The research correctly suggests `npx tsx`.

### 4. `createMonitor` needs updating but isn't listed in Task 2 changes
The plan says Task 2 should add `alert_enabled` to the Monitor interface, but `createMonitor()` in `lib/monitor.ts` doesn't accept or INSERT `alert_enabled`. Task 3 says "POST: accept alert_enabled in body, pass to createMonitor" but never says to update `createMonitor`'s SQL INSERT.

**Fix:** Task 2 must explicitly include updating `createMonitor()` to accept `alert_enabled` param and include it in the INSERT statement.

### 5. `initSchema()` in `db.ts` not listed for update
The research (§5) correctly says: "Also add to `initSchema()` in `db.ts` so fresh deploys get everything." The plan lists `lib/db.ts` in "Files to Modify" but no task actually modifies it. Fresh deployments would miss the `alert_enabled` column and `alerts` table.

**Fix:** Add explicit step in Task 1 to update `initSchema()` in `db.ts` — add `alert_enabled` column to the monitors CREATE TABLE and add the full `alerts` CREATE TABLE statement.

---

## Moderate Issues (edge cases, correctness)

### 6. Timestamp gotcha acknowledged but not enforced in Alert interface
The plan's Pitfalls section mentions the timestamp issue, but Task 2 doesn't explicitly state that `Alert.sent_at` must be `number` (Unix seconds) with conversion in `rowToAlert()`. The coder could easily use `Date` or `string` and break dashboard consistency.

**Fix:** Task 2 should explicitly specify: `sent_at: number` (Unix seconds), with `rowToAlert` converting via `Math.floor(new Date(row.sent_at).getTime() / 1000)` — matching `rowToMonitor` pattern.

### 7. No alert dedup / cooldown mechanism
Research §3 flags: "if cron runs twice quickly, could double-send." The plan has no protection against this. If the cron endpoint is hit twice within seconds (e.g., Vercel retry), duplicate alerts fire.

**Fix:** Add a note in Task 4 to check: before sending, query `alerts` table for same monitor + same event type within last N minutes. Or at minimum, document this as a known limitation for v1.

### 8. PATCH handler placement is unclear
Task 3 says add PATCH to `app/api/monitors/route.ts`. That file currently handles GET/POST/DELETE. Adding PATCH there works, but the plan should specify whether it updates only `alert_enabled` or is a general update endpoint. The coder needs clarity on the request body shape.

**Fix:** Specify: PATCH accepts `{ id: string, alert_enabled: boolean }`, updates only `alert_enabled`. Keep it narrow for now.

### 9. GET check route also needs `alert_enabled` guard
Task 4 mentions checking `alert_enabled` before sending alerts, but only in the context of the POST handler. The GET handler in `check/route.ts` (lines ~70-90) also calls `sendAlert()` and needs the same guard.

**Fix:** Task 4 should explicitly list both POST and GET handlers in `check/route.ts` as needing the `alert_enabled` check.

### 10. `deleteMonitor` in monitor.ts exists but isn't shown
The `tail` of monitor.ts shows `deleteMonitor` exists. The `ON DELETE CASCADE` on alerts will handle cleanup, but the plan should note this — no extra deletion code needed for alerts when a monitor is deleted.

---

## Minor Issues (nice-to-haves, polish)

### 11. No `resend` npm package — using raw fetch
The existing code uses raw `fetch()` to the Resend API. The plan's Task 5 (`lib/email.ts`) should continue this pattern rather than importing a `resend` package. This is fine but should be explicit.

### 12. Dashboard page has a local `Monitor` interface
`app/dashboard/page.tsx` defines its own `Monitor` interface (not imported from `lib/monitor.ts`). Task 6 needs to either update this local interface OR import from lib. The plan should specify which approach — importing is cleaner but may require the interface to be exported differently for client components.

**Note:** Since `lib/monitor.ts` uses server-only `sql` imports, the client component can't import from it directly. The plan should specify: create a shared `types.ts` file, or just update the local interface in the dashboard. Updating locally is simpler for v1.

### 13. Verification steps should include `npm run build` earlier
Only Task 8 runs `npm run build`. Since this is Next.js with strict TypeScript, a full build catches things `tsc --noEmit` misses (like client/server boundary issues). Consider running build after Task 5 (before UI work) to catch issues early.

---

## Summary of Required Changes

1. **Fix Next.js version** in plan header (16, not 14)
2. **Adopt research alerts schema** (add `success`, `error_message`, separate `type`/`event`)
3. **Fix migration runner** (`tsx` not `ts-node`)
4. **Add `createMonitor()` SQL update** to Task 2
5. **Add `initSchema()` update** as explicit step in Task 1
6. **Enforce Unix seconds** for `Alert.sent_at` in Task 2 spec
7. **Add `alert_enabled` check** to GET handler in Task 4
8. **Specify PATCH body shape** in Task 3
9. **Address dashboard's local Monitor interface** in Task 6

Once these 9 items are addressed, the plan is ready for implementation.
