# Admin Management

## Setup

Apply `database/academy.sql` once to the same PostgreSQL database used for login and teacher submissions. Do not rerun `database/init.sql`: that file resets the pilot login accounts.

The first catalog load seeds the existing demo profiles once. Subsequent additions and edits persist in PostgreSQL. Seed names, images and enrollment assignments are examples, not verified operational records. The existing pilot teacher login is linked to the three coach profiles covering its previous three demo classes; admin should replace these links with the correct teacher accounts.

## Profiles And Enrollment

- Open a Klass, institution, coach or student card and choose Edit. Changes survive reloads. Concurrent stale edits are rejected; refresh before retrying.
- Coach contact email and teacher login email are separate. A linked login must already exist with the teacher role. Linking a profile does not create an account or grant an admin role.
- Klass editors assign coaches and enrolled students. Student editors support multiple simultaneous class enrollments. Counts are derived from these relationships, not manually entered totals.
- Coach and student names inside Klass details open their profiles. Back returns to the previous detail. Assigned/enrolled Klass links work in the opposite direction too.
- Institution contacts include contact person, email, phone, website and address. Blank contacts remain marked Not provided; no contact details are invented.
- Learning Journey lists only Approved teacher syllabuses. Select a semester when more than one has been approved. Submitted, Draft, Rejected and Needs revision syllabuses are not shown as approved curriculum.

## Deadlines

Admin sets a semester start and syllabus deadline in the Klass editor, plus lesson-plan and feedback deadlines for each meeting date. Approved meeting dates can be copied into the deadline list. Empty deadlines create no outstanding or overdue task. Dates use WIB and are overdue starting the day after the configured deadline.

Teacher syllabus deadlines are read-only and enforced server-side. When copying the supplied example curriculum, the example meeting dates shift to the semester start configured by admin. Existing historical syllabuses retain their own semester dates. A new syllabus cannot be saved before admin has configured its semester/deadline.

Outstanding coach tasks distinguish Not started, Draft, Needs revision and Rejected, with Upcoming or Overdue timing. Submitted/Approved records are completed for task tracking, even while admin review is pending. Feedback tracking uses the meeting journal, whose submission validation requires personal feedback for attending students plus class feedback.

Teacher refresh/reload retrieves the assigned classes and current enrollment list. Previously saved meeting journals preserve their historical student roster. Changing enrollment must not rewrite historical attendance or feedback.

## Student Documentation

Student profiles show their enrolled classes and actual personal feedback from submitted meeting journals. Submitted documentation has an honest empty state for now. Student work uploads and per-work documents will be connected when the student portal is built; teacher meeting photos are not mislabeled as student submissions.

Email/WhatsApp automatic delivery remains unconfigured. Deadline reminders appear in the teacher workspace; no external message is sent.

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
