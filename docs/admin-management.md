# Admin Management

## Setup

Apply `database/academy.sql`, `database/academic-core.sql` and `database/security.sql` to the same PostgreSQL database used for login and teacher submissions. Do not rerun `database/init.sql`: that file resets the pilot login accounts. See [Backend Security](backend-security.md) for account approval and session policies.

Run `npm run db:phase3` after the additive migrations and before starting the Phase 3 application. It initializes the relational catalog once and migrates historical teacher documents transactionally. Re-running it preserves relational edits. Seed names, images and enrollment assignments are examples, not verified operational records. The existing pilot teacher login is linked to the three coach profiles covering its previous three demo classes; admin should replace these links with the correct teacher accounts.

The academic core separates institutions, periods, Klass types, running class groups, schedules, coach assignments, students, enrollments and deadlines. Relational tables are now the source of truth. Admin writes update changed relational records and the audit trail in one transaction; `academy_catalog` is a frozen pre-cutover archive. Existing IDs are preserved. See [Phase 3](phase3.md) for deployment order and archive limits.

## Profiles And Enrollment

- Open a Klass, institution, coach or student card and choose Edit. Changes survive reloads. Concurrent stale edits are rejected; refresh before retrying.
- Each existing Klass is migrated as a Klass type plus one running class group with the same ID. Future groups may share a type; this initial migration does not guess which existing titles represent the same product.
- Academic periods belong to their institution/class group. Existing semester starts are preserved without inventing end dates.
- Coach contact email and teacher login email are separate. New login links require an approved, active teacher account. Applicants register independently and admin reviews them in Teacher accounts. Suspending a linked account blocks its access without preventing admin from editing the coach profile. Linking a profile does not create an account or grant an admin role.
- Klass editors assign coaches and enrolled students. Student editors support multiple simultaneous class enrollments. Counts are derived from these relationships, not manually entered totals.
- Coach and student names inside Klass details open their profiles. Back returns to the previous detail. Assigned/enrolled Klass links work in the opposite direction too.
- Institution contacts include contact person, email, phone, website and address. Blank contacts remain marked Not provided; no contact details are invented.
- Learning Journey lists only Approved teacher syllabuses. Select a semester when more than one has been approved. Submitted, Draft, Rejected and Needs revision syllabuses are not shown as approved curriculum.

## Deadlines

Admin sets a semester start, syllabus deadline and semester-request deadline in the Klass editor, plus lesson-plan, feedback and class-needs deadlines for each meeting date. Approved meeting dates can be copied into the deadline list. Empty deadlines create no outstanding or overdue task. Dates use WIB and are overdue starting the day after the configured deadline. Request deadlines must be before the relevant date; combine semester and first-meeting needs if they share a date. See [Phase 5](phase5.md) for setup and reminder rules.

**Delivery jobs** lists up to 100 dashboard notification jobs, prioritizing failures. Refresh the list or retry a failed job using its retry icon. Only admin can retry; the actor and time are recorded. Scheduled reminders require deployment configuration and `CRON_SECRET`; email and WhatsApp remain disconnected.

Teacher syllabus deadlines are read-only and enforced server-side. When copying the supplied example curriculum, the example meeting dates shift to the semester start configured by admin. Existing historical syllabuses retain their own semester dates. A new syllabus cannot be saved before admin has configured its semester/deadline.

Outstanding coach tasks distinguish Not started, Draft, Needs revision and Rejected, with Upcoming or Overdue timing. Submitted/Approved records are completed for task tracking, even while admin review is pending. Feedback tracking uses the meeting journal, whose submission validation requires personal feedback for attending students plus class feedback.

Klass, institution, coach and student edits create an immutable `academy_events` entry containing the actor, entity, action and before/after values. This extends the account audit trail to academic catalog changes.

Teacher refresh/reload retrieves the assigned classes and current enrollment list. Previously saved meeting journals preserve their historical student roster. Changing enrollment must not rewrite historical attendance or feedback.

## Student Documentation

Student profiles show their enrolled classes and actual personal feedback from submitted meeting journals. Submitted documentation has an honest empty state for now. Student work uploads and per-work documents will be connected when the student portal is built; teacher meeting photos are not mislabeled as student submissions.

Email/WhatsApp automatic delivery remains unconfigured. Deadline reminders appear in the teacher workspace; no external message is sent.

## Catalog Images

Klass, institution and coach images are uploaded as files; the editor no longer accepts image paths or external URLs. The browser accepts JPEG, PNG and WebP up to 10 MB, decodes the image, strips metadata by re-encoding it to WebP and limits the upload payload to 180 KB. The server independently checks the format, decodes pixels with a 40-megapixel limit and re-encodes WebP at up to 1440px. New output bytes go to private object storage; `academy_images` retains an object reference. See [Phase 4](phase4.md) for migration and backup handling.

SVG, GIF, PDF and unknown file types are rejected by the admin image editor. Uploaded content is never executed or passed to a shell. Images are served only to an active logged-in portal session with `nosniff`, sandbox and private/no-store headers, after a SHA-256 integrity check. A dedicated malware scanner is not configured; these controls are not a malware-free guarantee.

## Checks

```powershell
npx tsc --noEmit
npx eslint app/admin app/teacher lib/academy.ts lib/academy-store.ts lib/teaching.ts tests/academy-check.mjs tests/admin-check.mjs
npm run build
node --env-file=.env.local tests/academy-check.mjs
node --env-file=.env.local tests/admin-check.mjs
node tests/teacher-workflow-check.mjs
```

Browser checks use localhost (default port 3001), signed pilot sessions and isolated database fixtures. Fixtures are removed in finally blocks without restoring a stale snapshot over real catalog changes. Screenshots are written under the Windows temporary directory.

The pilot catalog uses one locked JSONB row with per-record revisions; enrollment changes also invalidate affected class/student edits. Move the catalog to relational tables if record volume or write contention outgrows this pilot. Other legacy report/broadcast/example approval panels remain outside this management revision.
