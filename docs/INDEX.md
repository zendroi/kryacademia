---
title: KRYAcademia docs index
date: 2026-11-06
tags: [index, kryacademia, nextjs]
---

# KRYAcademia docs (Next.js app)

Map of this folder. Every document here is linked below; add new documents to this list so nothing becomes unreachable.

## Start here

- [Work log](worklog.md): what changed, who changed it, what is still open. Read first, write to it last.
- [Product Requirements Document](PRD-landing-page.md): what the public landing page is for, section by section.
- [September 2026 Revisions](revision-sources.md): the official KRYAcademia sources the content was verified against.

## Portal

- [Backend Security](backend-security.md): access rules, teacher invitation and approval, session policy. Read before touching auth.
- [Admin Management](admin-management.md): admin setup, which SQL files to apply, and which never to rerun.
- [Teacher Workspace](teacher-workspace.md): scope and styling of the teacher portal, submissions and private attachments.
- [Landing Page Inquiries](inquiries.md): how the public form reaches the admin inbox.

## Build phases

- [Phase 3: Relational Catalog And Teacher Workflow](phase3.md): the storage contract and the one-time relational import.
- [Phase 4: Private Files And Data Safety](phase4.md): private file objects, ownership checks and integrity.
- [Phase 5: Deadlines And Dashboard Delivery Jobs](phase5.md): deadlines, notifications and delivery jobs.
- [Teacher Workflow Revisions](portal-revisions.md): onboarding storage and meeting material fields; run `npm run db:revisions` first.

## Migration to Hostinger

- [Migrasi Hostinger / MySQL dan MariaDB](hostinger-migration.md): the MySQL/MariaDB adapter, export/import, backup and cutover plan. This app is the migration **source**.
- [Company catalog import](company-data-import.md): what may and may not be read from the company workbook.

Up: [AGENTS.md](../AGENTS.md)
