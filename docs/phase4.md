# Phase 4: Private Files And Data Safety

## Implemented

- New admin images and teacher attachments use private Vercel Blob. Postgres stores UUID references, verified size and SHA-256, not new file bodies or public download URLs. The existing authenticated routes enforce ownership/admin access before reading the object, check integrity, and send uncached responses with `nosniff` and a restrictive CSP. Former teachers can still read their own history, not other teachers' files.
- Local storage is an explicit development/test setting outside `public/`, forbidden when `VERCEL=1`. Missing cloud configuration fails closed; it never silently writes files to an ephemeral deployment filesystem.
- Server-side image decoding checks the declared format, rejects animated/malformed inputs, strips metadata and re-encodes WebP at up to 1440px. The server does not trust browser compression. Existing upload counts and payload limits remain.
- Teacher uploads pass assignment, record version/editability and draft validation before parsing or storage, with the same checks repeated when attaching files. All files must verify before staging starts. Teacher file-upload and admin image-upload requests are limited to 20 per account per 15 minutes; admin uploads also check record existence/version before processing. Saves without new files do not consume this quota. Failed final saves can leave staged objects for the existing cleanup job.
- PDFs are parsed and rewritten in a worker with an 8-second timeout, 96 MB JavaScript heap limit, object/depth/page limits and a 1 MB output limit. Encrypted/malformed files, actions, JavaScript, forms and embedded media/files are rejected, including escaped names and compressed object dictionaries. Uploaded instructions are data, never executed. This is structural validation, **not an antivirus guarantee**; a dedicated malware scanner and quarantine service remain future hardening.
- Teacher saves and admin reviews require the revision loaded by the editor. Stale requests fail without changing the document, attachments, audit trail or notifications. Refresh and reopen the latest record before retrying; unsaved text is not silently discarded.
- Upload reservations are durable before calling Blob and are staged outside the document transaction to avoid connection-pool starvation under concurrent saves. Assignment/revision checks run again inside the transaction before attachment. Retained-file metadata comes from the server, not editable client claims, and duplicate attachment IDs are rejected. Failed saves leave unreferenced reservations rather than broken document links. Cleanup only removes unreferenced objects older than 24 hours and takes a database lock coordinated with backups. References are protected by foreign keys.

## Cloud Setup

The `kryacademia-private-files` store was created with private access in `sin1` and linked to development/preview. Production was deliberately not changed by this implementation. Use the project's `BLOB_READ_WRITE_TOKEN` or supported Vercel OIDC + `BLOB_STORE_ID`; never expose these through `NEXT_PUBLIC_` variables. Raw object URLs are not UI links. See [private storage](https://vercel.com/docs/vercel-blob/private-storage) and [Blob SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk).

For local-only development, set `PORTAL_LOCAL_FILE_DIR` to an absolute private directory. Leave it unset to exercise the real private Blob store.

## Migration And Release

1. Run the checks below and create/verify a release backup. Stop old application writes for the Phase 3 relational cutover; do not mix old/new writers.
2. Run `npm run db:phase3` against the intended database. Never rerun the destructive pilot seed `database/init.sql` on operational data.
3. Link the private store to the production project environment before deploying the new file writers.
4. Run `npm run db:phase4` against that same database. This applies additive schema changes and verifies/re-encodes legacy files. It uploads and reads back each object before conditionally replacing the original database bytes. IDs, ownership and ordering stay intact. Sanitization may change names, MIME and size; original file bodies are recoverable from the encrypted pre-release backup.
5. A nonzero exit lists legacy files that failed verification. Their original bytes remain in Postgres, but the authenticated route will not serve unverified contents. Replace those files with valid uploads. A successful rerun skips already migrated files.
6. Deploy and smoke-test actual production uploads, teacher isolation and reviews before reopening writes. Rolling back old code after new object-only uploads requires restoring the coordinated database/file backup, not merely reverting JavaScript.

Run `npm run files:cleanup` from a trusted environment with database and storage credentials. Schedule it daily on a suitable job runner before operational usage; no public cleanup endpoint or automatic schedule has been enabled. The 24-hour delay also protects in-progress reservations. Run repeatedly if more than 100 orphan objects are queued.

## Encrypted Backup And Restore Drill

Use trusted PostgreSQL clients matching or newer than the database server. `PG_BIN` optionally points to their directory. Set `BACKUP_KEY` to 32 cryptographically random bytes encoded as 64 hex characters, stored separately from the backups and Git. Locally, `.env.backup.local` holds the generated key and client directory; it is ignored by Git. Loss of this key makes the encrypted backup unusable.

```powershell
npm run db:backup -- backups/release-YYYYMMDD
npm run db:restore-check -- backups/release-YYYYMMDD
```

Backup uses a consistent exported PostgreSQL snapshot and native custom-format `pg_dump`, captures per-table counts/hashes, and copies referenced private objects with integrity checks. AES-256-GCM encrypts the dump, manifest and each attachment. Temporary plaintext is removed in `finally`. The snapshot is scoped to the active schema, so unrelated schemas are not copied. Roles, other databases and infrastructure credentials are not included. See [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html).

The active `DATABASE_URL` is the only backup/restore connection source; Neon pooler hostnames are converted to their direct equivalent without changing the database, credentials or schema options. A stale `DATABASE_URL_UNPOOLED` cannot redirect a backup. A single connection acquires the session-level cleanup lock before starting the snapshot and holds it until disconnect.

Restore-check authenticates the encrypted archive, creates a uniquely named `krya_restore_*` database, restores with `pg_restore`, verifies every table's counts/hashes and password functions, and checks file contents from the backup without relying on live Blob objects. It removes only that newly created database afterwards. It cannot overwrite production and only accepts backups you created and trust; database dumps contain SQL. This is a recovery drill, not an automated production disaster-recovery switch.

Copy encrypted backups **and a separate key copy** to protected off-machine storage. Scheduled backups, off-machine retention, provider-level point-in-time recovery and restore monitoring are not enabled by this local tooling. Pilot backup handling currently buffers a dump in memory; use streaming archive encryption for large production databases.

## Verification

```powershell
npm run test:uploads
npm run build
node --env-file=.env.local --env-file=.env.backup.local tests/security-check.mjs
npm audit --omit=dev
```

The security runner uses its own schema, local private directory and random backup key. Phase 4 checks cover migration reruns, integrity failures, safe orphan cleanup, encrypted backup/isolated restore and backup tampering. Browser tests cover six simultaneous image uploads, stale teacher saves, stale admin reviews, file access isolation and the existing admin/teacher workflows at desktop/mobile sizes. Native PostgreSQL clients and permission to create a temporary database are required for restore checks.

Audit regressions also cover rejected uploads creating no objects, upload quotas, shared Klass type edits invalidating sibling forms, note-only reviews preserving their status, stale direct-URL settings and cleanup committing while backup waits for its lock.

Next/React/Sharp were updated to resolve reported runtime advisories. Development-only dependency advisories are separate from the runtime audit and have not all been remediated. Local Node 22.11 is below the repository's declared minimum 22.13; update local Node before standardizing CI/development.

Request deadlines and dashboard delivery jobs follow in [Phase 5](phase5.md). Email/WhatsApp delivery, password recovery/MFA, the student portal and a new frontend design remain separate work.
