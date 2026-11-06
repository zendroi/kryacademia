# KRYAcademia — landing page and portal

The public KRYAcademia landing page and the portal behind it, built with Next.js and PostgreSQL, deployed on Vercel.

The portal covers invitation-based teacher registration with private identity and bank details, an admin workspace for the class catalog, teacher accounts, the inquiry inbox and notification jobs, and a teacher workspace for submissions and private attachments.

## Where to start

- [AGENTS.md](AGENTS.md): what this project is and the rules that must not be broken. Read first.
- [docs/INDEX.md](docs/INDEX.md): the document map.
- [docs/worklog.md](docs/worklog.md): what changed recently and what is still open.
- [docs/PRD-landing-page.md](docs/PRD-landing-page.md): what the public page is for, section by section.

## Migration status

A rewrite of this application in Laravel exists in a separate repository, built because the Hostinger plan runs PHP without a Node.js runtime. This application is the migration **source**: `scripts/hostinger-data.mjs` produces the encrypted export the Laravel project imports. See [docs/hostinger-migration.md](docs/hostinger-migration.md).

## Data

`.env*` is gitignored and holds `DATABASE_URL`, `SESSION_SECRET` and `BACKUP_KEY`. `BACKUP_KEY` is kept outside this repository and outside this machine — without it no encrypted export can be read. `media/` stays local; only the optimised WebP files the site serves belong in the repo.
