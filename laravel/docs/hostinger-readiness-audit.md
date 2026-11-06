---
title: Hostinger readiness audit
date: 2026-11-06
tags: [audit, hostinger, deployment, open]
aliases: [audit, readiness audit]
---

# Hostinger readiness audit — 6 November 2026

A read-only review of this project against Hostinger PHP shared hosting. No code was changed. Twelve findings, none of them fixed yet. Tick them off here as they are closed, and record the closing in [worklog.md](worklog.md).

The architecture itself is sound for shared hosting: Vite assets are built on a developer machine, `QUEUE_CONNECTION` is `sync`, session and cache live in the database, and private files are served through a controller instead of `storage:link`. Nothing requires a Node process on the server. Access control on private files is correct — `identity` is admin-only, `teaching` is admin or the owning teacher, and both responses carry `nosniff` and a sandbox CSP.

## Blockers — before any upload

- [ ] **1. PHP 8.4 applies to the whole hosting plan, not one subdomain.** `composer.json` requires `php: ^8.4`. Hostinger offers 8.2–8.5, but the version applies to every website on the plan; per-directory `.htaccess` overrides are documented only as a temporary troubleshooting workaround. Raising the plan to 8.4 therefore moves the live krya.global site too. Verify that site on 8.4 first. This is a risk to production, not only to the LMS.
- [ ] **2. `public/index.php` is still the stock file.** The three `__DIR__.'/../'` references have not been repointed at the backend directory as [HOSTINGER_DEPLOYMENT.md](../HOSTINGER_DEPLOYMENT.md) requires. `release-manifest.json` also records `publicEntryPointPathPending: true`.
- [ ] **3. `public_path()` resolves to `laravel/public`, not `public_html`.** `bootstrap/app.php` never calls `usePublicPath()`, so `build/manifest.json` has to exist in two places and stay in sync. One missed copy produces "Unable to locate file in Vite manifest". Setting `usePublicPath()` once is safer than relying on the copy step.
- [ ] **4. No trusted proxies and no forced HTTPS.** `bootstrap/app.php` has no `trustProxies()` and nothing calls `URL::forceScheme('https')`. If TLS terminates at a proxy or CDN, Laravel builds `http://` URLs — mixed content and redirect loops. Worse, `$request->ip()` may return the proxy address, which collapses the 30-per-minute login limiter in `AppServiceProvider` into a single shared bucket and locks out legitimate users. The same risk is already documented for the Next.js app but was not carried across.

## Bugs and gaps

- [ ] **5. Queue setting contradicts the deployment note.** `.env.example` sets `QUEUE_CONNECTION=database`; [HOSTINGER_DEPLOYMENT.md](../HOSTINGER_DEPLOYMENT.md) specifies `sync`. With `database` and no worker, jobs accumulate in the table and never run, silently.
- [ ] **6. Semester variables are missing from the production `.env` template.** `config/academy.php` defaults `semester_start` to `2027-01-11`, and `semester_configured` is false unless `TEACHING_SEMESTER_START` and `TEACHING_SUBMISSION_DEADLINE` are set — which makes the teacher dashboard render with `sample: true`. The `.env` block in the deployment note lists neither, nor `TEACHING_CANVA_TEMPLATE`. Production could go live in sample mode.
- [ ] **7. KTP upload can exhaust memory instead of failing validation.** `App\Services\PrivateFiles::store` allows up to 20 million pixels, then runs `imagecreatefromstring` and `imagescale`. A 20 MP truecolor image is roughly 80 MB in GD with two copies alive at once. On a 128 MB `memory_limit` that is a fatal error and a 500, not a validation message. Lower the pixel cap, or confirm the plan's `memory_limit`.
- [ ] **8. `/api/academy-images/{id}` is public and unthrottled.** It is the only route that serves file bytes without authentication and without a rate limiter (`routes/web.php`). On shared hosting that is a cheap way to burn bandwidth and CPU.
- [ ] **9. `utf8mb4_bin` makes email lookups case-sensitive.** `config/database.php` sets that collation and the deployment note repeats it. Login lowercases its input, so any legacy account whose stored email contains uppercase can never sign in. Check the 284 imported rows and normalise during import if needed.
- [ ] **10. `withoutOverlapping()` has no expiry.** `routes/console.php` schedules `academy:notifications` every minute with an unbounded lock, which defaults to 24 hours. One run that dies mid-flight stops notifications silently for a day. Pass a timeout, for example `withoutOverlapping(10)`.
- [ ] **11. The invitation token travels in a query string.** `/register?invitation=<64 hex>` lands in browser history, `Referer` headers and hosting access logs. The token is hashed at rest and expires in 48 hours, so the exposure is limited — but access logs on shared hosting are not solely yours.
- [ ] **12. The response `Content-Type` comes straight from the database.** `WorkspaceController::file` passes `$entry->mime` through for `image` and `teaching` objects. Rows written by `PrivateFiles` are constrained to WebP or PDF, but rows carried over by the legacy import are not. `nosniff` and the sandbox CSP contain the risk; a whitelist on output would remove it.

## To verify, not yet findings

- `.phpunit.result.cache` (3 Nov 23:06 WIB) records five tests with a non-success status: `ExampleTest`, `LegacyImportTest`, and two `PortalWorkflowTest` cases including the login/throttle one. The status code in that cache most likely means *warning* rather than *failure*, but that is a reading of the file format, not a test run. Run `php artisan test --compact` and replace this paragraph with the result.
- Every-minute cron: Hostinger's documentation lists `* * * * *` among its schedules, but states no minimum interval. Confirm in hPanel for this plan.
- Leftover scaffolding not yet removed: `resources/views/welcome.blade.php` (72 KB, the default Laravel page) and `resources/js/app.js` (3 bytes).

## Suggested order

Blockers 1–4, then 5, 6, 10 (small and low risk), then 7, 8, 9, 12. Re-run the test suite, deploy to the preview subdomain against an empty database, and only then exercise the checklist in [HOSTINGER_DEPLOYMENT.md](../HOSTINGER_DEPLOYMENT.md). Cutover last.

Related: [HOSTINGER_DEPLOYMENT.md](../HOSTINGER_DEPLOYMENT.md), [worklog.md](worklog.md)
