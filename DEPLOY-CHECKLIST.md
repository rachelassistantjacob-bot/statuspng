# StatusPing Deploy Checklist

Everything is ready. This is a verification checklist, not a setup guide.

## Already Done ✅
- [x] Code: SQLite → Neon Postgres swap (committed `1dfe7a1`)
- [x] Neon project: `muddy-art-73719060` (aws-us-east-1)
- [x] DATABASE_URL: Set in Vercel env vars (production, preview, development)
- [x] Vercel redeploy: Triggered with new env var (deploy `dpl_EJuESJYSuvQgBUxSnXay67P1SUus`)
- [x] Schema: Auto-creates on first request via `ensureSchema()`

## Verify It Works (2 minutes)
1. Go to https://statuspng-gamma.vercel.app
2. Create a test monitor (e.g., monitor https://google.com)
3. Wait 5 minutes for the cron to run
4. Refresh — check that the monitor shows uptime data
5. If it works, the DB is persisting correctly

## If Something's Wrong
- Check Vercel logs: https://vercel.com/jacobblackmer-2974s-projects/statuspng/logs
- Verify DATABASE_URL in Vercel env vars matches Neon connection string
- Neon dashboard: https://console.neon.tech (logged in as rachelassistantjacob-bot GitHub)

## Next Steps (After Verification)
1. Email alerts (Resend API) — notify when monitors go down
2. Stripe payment integration — $5/mo Pro, $15/mo Business
3. Custom domain (statuspng.com or similar)
4. Reddit soft launch in r/selfhosted or r/webdev

## Credentials Reference
- **Vercel project:** `prj_codYDH0yJwwjV4N6DhSOwP0iwTLk`
- **Neon project:** `muddy-art-73719060`
- **GitHub repo:** https://github.com/rachelassistantjacob-bot/statuspng
- **Live URL:** https://statuspng-gamma.vercel.app
