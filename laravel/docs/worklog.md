---
title: Work log
date: 2026-11-06
tags: [worklog, handover, kryacademia, laravel]
aliases: [handover]
---

# Work log

Handover between the people and the agents working on this repo (Claude and Codex). Newest entry first. One entry per working session: what changed, what was decided, what is still open. Keep entries short; detail belongs in the document the entry links to.

Rule: do not run two agents in this working tree at the same time. Commit before handing over, then add an entry here.

## 2026-11-06 — readiness audit, no code changed

Reviewed the project against Hostinger PHP shared hosting. Nothing in the source tree was modified. Twelve findings, all open: [hostinger-readiness-audit.md](hostinger-readiness-audit.md).

Where this code lives:

- The Laravel source is tracked in `zendroi/kryacademia` on branch **`otw-hosting`**, under `laravel/`, as commit `f62010b` "Save Laravel port and backend revisions for Hostinger" (6 Nov, ~12:41 WIB). That commit also carries roughly three weeks of backend work on the Next.js side.
- `main` is still at `21cab4b` (16 Oct). Nothing from `otw-hosting` has been merged into it.
- The pushed tree was checked and is clean: no `.env`, no `*.sqlite`, no `*.enc`, no `vendor/`, no `node_modules/`, and nothing under `storage/app/private/` beyond the stock `.gitignore`. The nested `laravel/.gitignore` is what keeps it that way — do not remove it when the folder is nested inside another repo.
- `public/build` is deliberately untracked. Built assets are uploaded separately, as [HOSTINGER_DEPLOYMENT.md](../HOSTINGER_DEPLOYMENT.md) describes.

**Open: two working copies of this project exist.** The tracked one is `Kryacademia - landing page/laravel/`. A second, `kryacademia-laravel/`, has its own git repository (one commit on `master`, no remote). Their code is byte-identical apart from line endings. Pick one as canonical before editing either, or the two will diverge without anything warning you.

Also recorded:

- `CLAUDE.md` was an 8,638-byte duplicate of `AGENTS.md`. It is now a pointer (`@AGENTS.md`) so both agents read one file. If Laravel Boost regenerates it as a full copy, restore the pointer.
- `README.md` was the stock Laravel readme and has been replaced with a project readme.
- The release package in `kryacademia-hostinger-20261104-6d57545e` passed its rehearsal (37 tables, 284 rows, 6,828 code files) but `release-manifest.json` still records `serverDeploymentPending: true` and `publicEntryPointPathPending: true`. Nothing is deployed yet.

Open decision, shared with the Next.js side: both implement the same product. This one is the migration target, but nothing records whether the Next.js app is to be retired.

## Handover — next session, for Codex

Decided 6 Nov: GitHub is the source of truth, and this project moves to its own repository, `zendroi/kryacademia-laravel`, with the Laravel app at the repository root so `public/` can serve as the document root directly.

Why not a branch: a branch shares one working tree, so a Laravel-only branch would replace the Next.js checkout every time it is used, and any change touching both projects would have to be made twice.

Prepared: branch **`laravel-only`** in `zendroi/kryacademia`, created with `git subtree split --prefix=laravel`. Its root is this project, so it can be pushed straight into an empty repository.

The remaining steps need GitHub credentials, which the Claude session does not have:

1. Create an empty private repository `zendroi/kryacademia-laravel` — no README, no `.gitignore`, no licence.
2. From the `Kryacademia - landing page` clone:
   `git remote add laravel https://github.com/zendroi/kryacademia-laravel.git`
   `git push laravel laravel-only:main`
3. Clone the new repository into its own working folder and use that from then on.
4. Only after step 3 is verified, remove the nested copy: `git rm -r laravel`, commit, push `otw-hosting`.
5. Retire `Downloads\kryacademia-laravel\`. **Do not push it.** Its single commit `3128962` is a stale snapshot — 71 paths differ from its own working tree, including `AdminController.php` and `TeacherController.php`, which were consolidated into `WorkspaceController`. The working tree itself is byte-identical to the tracked copy apart from line endings, so nothing is lost by dropping that folder.
6. Delete the unused branch `laravel-migration`; it sits at `21cab4b` and contains none of this work.
