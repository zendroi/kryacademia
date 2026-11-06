# Backend Security

## Access Rules

- Admin can manage all academy records. Public registration never creates admin accounts.
- Admin provisions teacher credentials and an expiring single-use registration invitation. Invited teachers upload their KTP photo and bank details before admin approval in Teacher accounts. Existing accounts remain unchanged. Verify identity and email through your existing contact process: automatic email verification is not connected. See [Workflow revisions](portal-revisions.md) for private identity storage and migration requirements.
- Approval grants portal access, not a class assignment. Link an active account in the coach profile and assign that coach to the appropriate Klass separately.
- Teachers can read current rosters only for their assigned classes. They can read their own submission history and its documentation after an assignment is removed, but cannot edit it or load the latest roster.
- Data-loading functions check the session and scope themselves. Mutations also check role, ownership and current assignments server-side. Teacher writes lock the account/session during the transaction so revocation cannot race a committed save.

## Migration

Apply `database/security.sql` once to the portal database, after the existing login tables. This additive migration preserves account IDs, roles, password hashes and operational records. It marks existing accounts active; new registrations explicitly insert pending teacher accounts.

Do not rerun `database/init.sql` against an existing environment: that seed updates pilot password hashes and roles.

Sessions now require both a signed cookie and a live database entry linked to an active account. Old cookies without a session ID require a fresh login after deployment. Keep `SESSION_SECRET` at least 32 random characters and out of Git.

The database module is server-only. Remote PostgreSQL connections verify the TLS certificate and hostname; only explicit loopback database hosts disable TLS for local development.

Logout deletes the current server session. Admin can revoke all sessions of a teacher, suspend their account, or reactivate a suspended account. Reactivation never restores old sessions. Rejections and suspensions require a review note; actions reject stale revisions and store an account audit event. This audit covers account administration, not yet all academy edits.

## Abuse Limits

- Login: 10 attempts per normalized email and 60 per client address within 15 minutes. Successful attempts also count; the window does not extend when throttled.
- Registration: 3 attempts per email and 5 per client address within one hour, plus a hidden honeypot. Duplicate registrations do not replace passwords or change roles, and return the same received message.
- Client addresses are taken only from Vercel's overwritten forwarding header when running on Vercel ([request-header reference](https://vercel.com/docs/headers/request-headers)). Other hosting shares a conservative local bucket until its trusted proxy is configured; never trust arbitrary incoming forwarding headers.
- Rate-limit subjects are HMAC hashes, not stored email/IP values. Expired session/limit rows are removed during subsequent auth operations.

MFA, automated email verification/password recovery, CAPTCHA, and external email/WhatsApp delivery are not implemented in this phase. Keep pilot credentials out of operational use and complete the identity verification process before approving real teacher access.

## Verification

Page responses set anti-framing, MIME-sniffing, referrer and browser-permission headers in `next.config.ts`, independent of the hosting provider. The CSP only restricts framing, plugin objects and base URLs; it is not a complete script-source policy. Private file routes retain their stricter sandbox policy. The HTTPS reverse proxy must supply HSTS after the target domain's HTTPS setup is confirmed.

Before a Hostinger release, confirm the Node runtime, persistent private file storage, scheduled notification/cleanup/backup jobs, and trusted proxy configuration. The current non-Vercel client-address fallback shares one authentication quota bucket; configure trusted proxy handling before accepting public traffic there. A hosting move does not by itself replace the configured private Blob provider or activate scheduled jobs.

Secrets copied into reports must be redacted before sharing. Rotate exposed database/account passwords in coordination with every environment using them, revoke old sessions, and update the deployment's secret store before reopening traffic. Local `.env.local` does not prove which database production uses; do not rerun the seed or replace production secrets blindly.

```powershell
npm ci
npx playwright install chromium
npx tsc --noEmit
npm run build
npm run test:security
```

The security check creates a unique temporary PostgreSQL schema, applies the migrations there, starts its own local Next server, tests registration/approval/revocation/rate limits, and verifies cross-teacher writes, private files and read-only history. It uses a direct Neon connection and native PostgreSQL startup options to preserve schema isolation, and asserts the schema before writing fixture passwords. It then runs auth, academy, inquiry, admin and teacher browser checks against that schema. The server is stopped and only the generated test schema is removed in finally. Existing account passwords and operational records are untouched.

Browser screenshots go to the Windows temporary directory. Teacher workflow checks must run through this isolated runner because their demo assignments and semester fixtures intentionally differ from real admin configuration.

Next builds no longer ignore TypeScript errors. Phase 3 uses relational-only catalog/workflow writes and records save/review snapshots in `teaching_events`. [Phase 4](phase4.md) adds private storage, stronger upload verification, stale-write protection and encrypted backup/restore drills. External delivery providers, production scheduling and monitoring remain separate work.

## Academic Core

- Klass types are separate from running class groups. One type, such as Coding, can have multiple groups with different institutions, coaches, schedules and enrolled students.
- Semester periods belong to institutions, not one mandatory global KRYAcademia semester. Admin manages syllabus, lesson-plan and feedback deadlines.
- Preserve current group/student/coach IDs and historical submission ownership when migrating the pilot JSONB catalog to relational tables. Do not infer or invent missing semester end dates.
- Class-request deadlines have their own explicit admin settings in [Phase 5](phase5.md); an unrelated syllabus deadline is never displayed as a configured request deadline.

`database/academic-core.sql` implements this model without deleting `academy_catalog`. `npm run db:phase3` applies the next schema and copies legacy data once. From that point, relational tables supply reads and writes; JSON remains a frozen archive. Existing classes are intentionally migrated one-to-one into a type and group; consolidation into shared types requires an explicit admin decision instead of title guessing. Existing shared type links are preserved when editing a group.
