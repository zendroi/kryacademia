# KRYAcademia

The KRYAcademia landing page and portal, built with Laravel 13, Inertia 3 and React 19 on PHP 8.4.

The portal covers invitation-based teacher registration with private KTP and bank details, an admin workspace for the class catalog, teacher accounts, the inquiry inbox and notification jobs, and a teacher workspace for syllabuses, lesson plans, meeting journals and attendance feedback.

This is a rewrite of an earlier Next.js application, made because the hosting plan is PHP shared hosting with no Node.js runtime. React is compiled to static assets on a developer machine; the server runs PHP only.

## Where to start

- [AGENTS.md](AGENTS.md): what this project is and the rules that must not be broken. Read first.
- [docs/INDEX.md](docs/INDEX.md): the document map.
- [docs/worklog.md](docs/worklog.md): what changed recently and what is still open.
- [docs/hostinger-readiness-audit.md](docs/hostinger-readiness-audit.md): open findings between here and a working deployment.
- [HOSTINGER_DEPLOYMENT.md](HOSTINGER_DEPLOYMENT.md): the deployment procedure.

## Local development

```sh
composer install
npm ci --ignore-scripts
npm run build
php artisan test --compact
```

`npm run build` type-checks before Vite runs. PHP needs GD with JPEG, PNG and WebP support; some minimal Windows PHP builds ship without WebP.

## Data

Company data is never committed. `storage/app/private/` and `database/*.sqlite` are gitignored and hold teacher identity images, encrypted snapshots and the imported company database. `BACKUP_KEY` is the source export key and is kept outside this repository and outside this machine — without it no encrypted snapshot can be read.
