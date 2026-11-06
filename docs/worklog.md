---
title: Work log
date: 2026-11-06
tags: [worklog, handover, kryacademia]
aliases: [handover, changelog]
---

# Work log

Handover between the people and the agents working on this repo (Claude and Codex). Newest entry first. One entry per working session: what changed, what was decided, what is still open. Keep entries short; detail belongs in the document the entry links to.

Rule: do not run two agents in this working tree at the same time. Commit before handing over, then add an entry here.

## 2026-11-06 — Laravel moved to its private repository (Codex)

- Created and verified [zendroi/kryacademia-laravel](https://github.com/zendroi/kryacademia-laravel) as a private repository with branch `main`. The prepared subtree history starts the new repository at `550f9c8`; its initial clone matches the previous `laravel/` Git tree exactly.
- The canonical Laravel clone is `C:\Users\refy karta\Downloads\kryacademia-laravel-github`. Continue Laravel work there. The nested `laravel/` copy was removed only after verification and is ignored to prevent accidental reintroduction.
- Removed the unused local `laravel-migration` branch at `21cab4b`, which contains no unique migration work. The `laravel-only` split branch remains for traceability.
- The old standalone `Downloads\kryacademia-laravel` folder remains a private data/rollback source and was not pushed. All 51 checked configuration, database, export, and private object files remain unchanged.
- Source code is preserved in the new repository and earlier commits. Checks covered repository privacy, cloned history/tree equality, and private-file exclusions; application tests were not repeated for this repository/documentation change. Nothing was deployed.

## 2026-11-06 — branch `otw-hosting` created; docs restructured

Repository state at the end of the day:

- This working tree is on branch **`otw-hosting`** at `f62010b` "Save Laravel port and backend revisions for Hostinger" (~12:41 WIB). That commit carries roughly three weeks of backend work — the MySQL/MariaDB adapter (`lib/mysql-connection.mjs`, `lib/mysql-tag.mjs`, `lib/sql-dialect.mjs`, `scripts/hostinger-data.mjs`, `scripts/mysql-runtime.mjs`), `scripts/backup.mjs`, notification jobs, `lib/upload-validation.mjs`, `lib/pdf-check.mjs`, the admin/teacher/login/register action updates and [hostinger-migration.md](hostinger-migration.md) — plus the whole Laravel port under `laravel/`.
- `main` is still at `21cab4b` (16 Oct). Nothing from `otw-hosting` has been merged into it, so `main` does not yet contain any of the migration work.
- Uncommitted after that commit: this file, [INDEX.md](INDEX.md), [../README.md](../README.md), [../AGENTS.md](../AGENTS.md) and the new `laravel/docs/` set.

Documentation was restructured so both agents start from the same place: a root readme, an `AGENTS.md` carrying the project rules, and this folder's [INDEX.md](INDEX.md) as the map. Every document is now reachable from the readme in two hops. The generated `<!-- BEGIN:nextjs-agent-rules -->` block in `AGENTS.md` was preserved as-is.

Open decision: this app and the Laravel port now implement the same product. Per [hostinger-migration.md](hostinger-migration.md) this app is the migration **source** and Laravel is the **target**, but nothing records whether this app is to be retired. Decide before more work lands in both.

## Handover — next session, for Codex

The Laravel move is complete. The app now lives at the root of [zendroi/kryacademia-laravel](https://github.com/zendroi/kryacademia-laravel). Branch `laravel-only` here preserves the original `git subtree split --prefix=laravel` result. The Laravel handover continues in its [work log](https://github.com/zendroi/kryacademia-laravel/blob/main/docs/worklog.md).

Use the canonical clone above for Laravel work; this working tree continues to hold the Next.js migration source. Nothing is deployed yet.
