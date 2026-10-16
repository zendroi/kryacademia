# Phase 5: Deadlines And Dashboard Delivery Jobs

## Admin Deadlines

Klass editing now includes a semester class-needs deadline and a class-needs deadline per meeting, alongside the existing syllabus, lesson-plan and feedback deadlines. Request deadlines must be strictly before the semester/meeting date. They appear in the teacher editor, notifications and the coach outstanding-task list. No deadline is invented when admin leaves a field empty.

The existing request contract is one request per teacher, Klass group and date. Combine semester and first-meeting needs when they share a date; admin cannot configure both request deadlines for that date. Separate request instances require a future workflow change. Existing unscoped request deadlines are preserved in the database but excluded from reminders until their timing is explicitly configured; migration reports their count. Older clients omitting the new fields preserve the stored values.

## Delivery Rules

- Submission/review confirmations remain immediate. Their delivery job and inbox entry commit in the same transaction as the business change; failures roll back together.
- The scheduler plans H-3, H-1 and one overdue reminder per teacher/deadline/due-date/stage using Asia/Jakarta dates. It does not backfill missed advance reminders. Changing a due date creates a new reminder identity.
- Before delivery, the worker rechecks active account, current assignment, current deadline, reminder stage and unfinished submission. Stale jobs are cancelled, including delayed advance reminders whose H-3/H-1 day has passed. A cancelled, never-delivered reminder can resume if the same task becomes eligible again; a delivered reminder is never sent twice.
- A unique job key plus unique inbox source ID prevents duplicates. Workers claim jobs with `FOR UPDATE SKIP LOCKED`; dashboard delivery is an atomic database transaction, with assignment/submission locks coordinated with existing writers.
- Failures wait at least 1, 2, 4 and 8 minutes before becoming eligible again; after five attempts the job is failed. Actual retry happens on the next worker invocation, not on an in-process timer. Admin can inspect up to 100 jobs in **Delivery jobs**, with failed jobs prioritized, and retry a failed job. Retrying records the admin and timestamp and rejects stale/repeated requests.
- One invocation plans up to 100 reminders and processes at most 100 jobs within a 40-second processing budget. The result reports due pending work. Run the trusted CLI again or increase scheduler frequency before higher-volume use.

Delivery is **dashboard-only**. No email or WhatsApp provider is configured or called. External delivery will need provider idempotency and leased claims before adding network calls; do not hold these database transactions open around an external sender.

## Migration And Activation

1. Back up and verify the intended database. Phase 3/4 release prerequisites still apply; see [Phase 4](phase4.md). Never rerun `database/init.sql` on operational data.
2. Apply `npm run db:phase5` with the intended `DATABASE_URL`. The additive/idempotent migration preserves the catalog archive and existing inbox entries. Current `db:phase3` also installs the compatible Phase 5 schema before running the current academic-core reader; it does not activate scheduling.
3. Set a random, server-only `CRON_SECRET` of at least 32 characters in the deployment environment. Keep it separate from `SESSION_SECRET`; never use a `NEXT_PUBLIC_` prefix.
4. Deploy the matching code/schema and smoke-test admin deadlines, teacher notifications and the authenticated worker. The unauthenticated endpoint returns 401; missing/short scheduler configuration returns 503 before any database connection.

`vercel.json` configures `GET /api/internal/notification-jobs` daily at `0 2 * * *` (02:00 UTC, around 09:00 WIB). Vercel cron uses the production deployment and supplies `Authorization: Bearer <CRON_SECRET>`. A dashboard login cookie cannot authorize this endpoint. The endpoint returns aggregate counts only, uses `no-store`, and does not accept POST. See [Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs) and [cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing). Hobby scheduling has hourly precision; daily scheduling means a backoff-eligible retry can wait until the next day. Use a more frequent supported scheduler if shorter delivery latency is required.

For a trusted manual run:

```powershell
npm run jobs:run
```

This implementation does not enable a production deployment or set real production secrets. Backup, restore monitoring and orphan-file cleanup schedules are separate and are not activated by this reminder cron.

## Verification

```powershell
npm run build
npx tsc --noEmit
node --env-file=.env.local --env-file-if-exists=.env.backup.local tests/security-check.mjs
```

The security runner creates its own schema and random scheduler secret; operational records remain untouched. Phase 5 covers migration reruns, new deadline round-trips, Jakarta planning, atomic notification rollback, duplicate protection, changed assignments/deadlines/submissions, suspension/reactivation, retry backoff/exhaustion, manual retry authorization, concurrent workers and desktop/mobile layouts. Catalog browser tests also check deadline validation and compatibility with older clients.
