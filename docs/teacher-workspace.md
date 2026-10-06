# Teacher Workspace

## Scope

The teacher portal shares the landing page's Montserrat typography, navy/red controls, Smooth UI inputs/dropdowns, and reduced-motion support. Teaching submissions, private attachments and the admin-managed catalog are stored in PostgreSQL. The initial catalog is seeded with demo profiles; subsequent edits and assignments persist.

Admin links coach profiles to existing teacher login accounts, assigns coaches to classes, and manages student enrollments. Teacher accounts see only their assigned classes and students. The pilot teacher retains its previous three sample assignments until admin replaces those links. See [Admin Management](admin-management.md) for profile editors and deadline setup.

## Database Setup

After the existing authentication setup (`database/init.sql`), run the additive migration:

```powershell
node --env-file=.env.local --input-type=module -e "import postgres from 'postgres'; import {readFile} from 'node:fs/promises'; const sql=postgres(process.env.DATABASE_URL,{ssl:process.env.DATABASE_URL.includes('localhost')?false:'require'}); try {await sql.unsafe(await readFile('database/teacher.sql','utf8'));} finally {await sql.end();}"
```

This creates `teaching_records`, `teaching_files`, and `teacher_notifications`. It does not alter passwords or existing admin data.

Also apply `database/academy.sql` for the shared catalog. Never rerun the authentication seed to apply these additive migrations.

## Workflow

1. Semester Preparation / Syllabus: academic year, semester, coach names, location, program description, objectives, values, projects, project description, submission deadline, and dated meeting timeline with Inspiring/Creating/Dedicating phases. Submit the syllabus before creating meeting records.
2. Class Workflow: choose a Klass and submitted/approved semester syllabus. Each timeline entry links to its lesson plan, material recap, and meeting journal with persisted statuses.
3. Lesson Plans: objectives, materials, assessment, and editable activities with phase, duration, purpose, coach activity, and student activity. A submitted journal links to planning the following meeting.
4. Material recap: main/assistant coach, presentation, worksheet, classroom, notes, PDF/photos, and admin approval status. Assigned Canva links from the supplied recap PDFs are immutable in both the UI and server validation. Meetings without an assigned link can use a secure Canva URL or slides PDF.
5. Meeting Journal: teacher/student attendance, four numeric rubric ratings (Afektif, Problem solving, Story telling, Kinerja; 1 Emerging to 4 Advanced), personal description, class feedback, and up to three compressed documentation photos. Attending students need all four ratings and a description when submitting; drafts can be incomplete. Absent/excused students do not require ratings.
6. Class Requests: item names/quantities, purpose, needed-by meeting or semester start, and before-class/before-semester timeframe. Semester requests display the selected syllabus deadline.
- Admin Approvals: a live review queue above the existing demo queue. Admin can approve, request revision with a note, reject with a note, or mark a class request fulfilled.
- Notifications: persisted submission receipts and admin review messages, unread filter, and mark-all-read.

Submitting again updates the same account/class/kind/date record. Approved or fulfilled records are read only for teachers. Drafts are not visible in the admin queue. Admin review and its teacher notification are written in one transaction. Concurrent admin decisions currently use last-write-wins.

The linked syllabus must belong to the authenticated teacher and selected class. Meeting dates must match its timeline. Dates that already have linked records cannot be removed or reordered. Existing generic records retain their original fields and 0-100 scores; they are not silently converted or deleted. The enhanced workflow uses the existing JSONB column, so no additional database migration is required.

Teacher timelines load all owned records instead of truncating at 100 and hiding older syllabuses. Admin task tracking also loads complete pilot history, including drafts, so it does not mistake a hidden older submission for missing work. Drafts remain excluded from the review queue. Introduce class/semester pagination before large archives accumulate.

## Deadlines and Templates

Admin sets semester start, syllabus deadline and meeting-specific lesson-plan/feedback deadlines in Klass Management. Teacher syllabus deadlines are read-only and enforced server-side. New syllabuses require admin configuration; historical syllabuses keep their existing dates. Empty deadlines do not create overdue tasks. Late submissions remain accepted rather than being hard-blocked. Environment dates are fallback placeholders, not an admin-configured obligation.

Biotechnology and Coding include an optional 2026-2027 syllabus example from the supplied PDFs: nine meetings originally spanning 5 September to 21 November 2026, at 08:00. Loading an example replaces the new syllabus fields after confirmation and shifts the dates to the semester start configured by admin. It does not import historical student names, grades, feedback, or documentation. The submission deadline comes from admin, not the teacher.

`TEACHING_CANVA_TEMPLATE` optionally adds another secure Canva template link for meetings without assigned materials. The four earlier Coding links correspond to meetings 4, 3, 2, and 1 respectively, rather than four interchangeable templates. User-supplied material links accept HTTPS on `canva.com`, `www.canva.com`, or `canva.link` only.

## Attachment Limits

Photos accept JPEG/PNG/WebP inputs up to 10 MB. Browser canvas re-encodes them (removing original metadata), downsizes them to a maximum 1440px, and reduces resolution/quality until each is at most 180 KB. Unsupported formats are rejected rather than silently uploaded uncompressed. PDF attachments are limited to one per non-meeting record and 1 MB. Server validation checks format signatures and actual byte lengths.

Files are served through an authenticated, uncached route. Only the owning teacher or an admin can retrieve them. Files are never written into public assets. PostgreSQL binary storage is intentionally bounded for this initial portal; move media to private object storage when usage grows. PDFs are downloads, not embedded executable content. No antivirus service is configured; use only trusted teaching material.

## External Notifications

Dashboard delivery is active. Email and WhatsApp are explicitly marked not connected/not sent. No WhatsApp API or email delivery credentials have been supplied. No fake delivery success or manual `wa.me` link is presented as automatic notification. Automatic external delivery and scheduled deadline reminders require a provider and deployment scheduling, and are not active in this version.

## Verification

The shared Smooth UI Words preloader follows initial hydration, route loading, pending internal navigation, and login/logout actions. It has no artificial hold timer. Journal saves, dashboard tabs, and inquiry validation keep their local indicators. Reduced-motion and no-JavaScript fallbacks are supported.

```powershell
npx tsc --noEmit
node tests/teacher-workflow-check.mjs
node --env-file=.env.local tests/academy-check.mjs
node --env-file=.env.local tests/preloader-check.mjs
```

The pure workflow check covers timeline dates, rubric, lesson activities, draft rules and immutable assigned links. The academy browser check covers persisted admin edits, profile navigation, multiple enrollments, approved-only curriculum, configured deadlines, role protection and historical teacher rosters on desktop/mobile. The older `teacher-check.mjs` fixture assumes the previous shared static catalog and needs admin assignment/deadline fixtures before reuse. The preloader check covers hydration, login/logout, navigation and cancelled unsaved-form navigation. Set `BASE_URL` to use a server other than port 3001.
