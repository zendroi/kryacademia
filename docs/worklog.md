---
title: Work log
date: 2026-11-06
tags: [worklog, handover, kryacademia]
aliases: [handover, changelog]
---

# Work log

Handover between the people and the agents working on this repo (Claude and Codex). Newest entry first. One entry per working session: what changed, what was decided, what is still open. Keep entries short; detail belongs in the document the entry links to.

Rule: do not run two agents in this working tree at the same time. Commit before handing over, then add an entry here.

## 2026-11-06 — branch `otw-hosting` created; docs restructured

Repository state at the end of the day:

- This working tree is on branch **`otw-hosting`** at `f62010b` "Save Laravel port and backend revisions for Hostinger" (~12:41 WIB). That commit carries roughly three weeks of backend work — the MySQL/MariaDB adapter (`lib/mysql-connection.mjs`, `lib/mysql-tag.mjs`, `lib/sql-dialect.mjs`, `scripts/hostinger-data.mjs`, `scripts/mysql-runtime.mjs`), `scripts/backup.mjs`, notification jobs, `lib/upload-validation.mjs`, `lib/pdf-check.mjs`, the admin/teacher/login/register action updates and [hostinger-migration.md](hostinger-migration.md) — plus the whole Laravel port under `laravel/`.
- `main` is still at `21cab4b` (16 Oct). Nothing from `otw-hosting` has been merged into it, so `main` does not yet contain any of the migration work.
- Uncommitted after that commit: this file, [INDEX.md](INDEX.md), [../README.md](../README.md), [../AGENTS.md](../AGENTS.md) and the new `laravel/docs/` set.

Documentation was restructured so both agents start from the same place: a root readme, an `AGENTS.md` carrying the project rules, and this folder's [INDEX.md](INDEX.md) as the map. Every document is now reachable from the readme in two hops. The generated `<!-- BEGIN:nextjs-agent-rules -->` block in `AGENTS.md` was preserved as-is.

Open decision: this app and the Laravel port now implement the same product. Per [hostinger-migration.md](hostinger-migration.md) this app is the migration **source** and Laravel is the **target**, but nothing records whether this app is to be retired. Decide before more work lands in both.

## Handover — next session, for Codex

The Laravel port moves out of this repository into `zendroi/kryacademia-laravel`, with the app at that repository's root. Branch `laravel-only` here was created with `git subtree split --prefix=laravel` as the thing to push into it. Full steps, including what must not be pushed: [../laravel/docs/worklog.md](../laravel/docs/worklog.md).

Until that is done and verified, `laravel/` stays where it is. Nothing is deployed yet.
