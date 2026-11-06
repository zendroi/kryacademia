# KRYAcademia — landing page and portal (Next.js)

Read this before changing anything in this repo. Document map: [docs/INDEX.md](docs/INDEX.md). Handover log: [docs/worklog.md](docs/worklog.md) — read it first and add an entry when you finish.

## What this is

A Next.js application for KRYAcademia: the public landing page plus a portal behind it — login and invitation-based registration, an admin dashboard with a catalog editor and inquiry inbox, a teacher workspace for submissions and private attachments, and scheduled notification jobs. It runs on Vercel against PostgreSQL. Remote: `origin` → `zendroi/kryacademia`. A second design option lives on remote `option2` → `zendroi/kryacademia-2`; do not push over it.

## Rules

- **Never commit secrets.** `.env*` is gitignored and holds `DATABASE_URL`, `SESSION_SECRET` and `BACKUP_KEY`. Losing `BACKUP_KEY` makes every encrypted export unreadable, so it is kept outside this machine as well. Never paste these values into a chat.
- **Never run the PostgreSQL phase migrations against MySQL.** `db:phase3`, `db:phase4`, `db:phase5` and `db:revisions` are PostgreSQL-only; guards reject them on MySQL. Do not bypass a guard.
- **Importers preview by default.** `import-company`, `import-class-request` and `archive-pilot` show a preview; changes require `--apply`. Never edit a manifest to force an import through.
- **Do not seed demo data over company data,** and do not rerun `database/init.sql` — it resets the pilot login accounts.
- **`media/` stays local.** Only the optimised WebP files the site actually serves belong in the repo.
- Export and import limits: 128 MiB per table, 256 MiB total payload, 1 MiB per file object.

## Working with the other agent

Claude and Codex both read this file and both edit this working tree. Do not run them at the same time — there is no lock, and an uncommitted tree gives no safe point to fall back to. Commit before handing over, and record the handover in [docs/worklog.md](docs/worklog.md).

## Related

- The Laravel rewrite lives in the private [zendroi/kryacademia-laravel](https://github.com/zendroi/kryacademia-laravel) repository. This app is the migration **source**; see [docs/hostinger-migration.md](docs/hostinger-migration.md).
- Design notes: [design.md](design.md).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
