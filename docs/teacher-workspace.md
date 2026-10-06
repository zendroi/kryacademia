# Teacher Workspace

## Scope

The teacher portal shares the landing page's Montserrat typography, navy/red controls, Smooth UI inputs/dropdowns, and reduced-motion support. Teaching submissions and private attachments are stored in PostgreSQL. Existing admin management records remain demo data; the teacher review queue is live.

Sample assignments and students currently come from `app/admin/adminData.ts`. They are not official teacher-to-class assignments. All temporary teacher accounts share this sample catalog, but submitted records and files are isolated by authenticated account. Replace the sample catalog with admin-managed assignments before adding real teachers.

## Database Setup

After the existing authentication setup (`database/init.sql`), run the additive migration:

```powershell
node --env-file=.env.local --input-type=module -e "import postgres from 'postgres'; import {readFile} from 'node:fs/promises'; const sql=postgres(process.env.DATABASE_URL,{ssl:process.env.DATABASE_URL.includes('localhost')?false:'require'}); try {await sql.unsafe(await readFile('database/teacher.sql','utf8'));} finally {await sql.end();}"
```

This creates `teaching_records`, `teaching_files`, and `teacher_notifications`. It does not alter passwords or existing admin data.

## Workflow

- Meeting Journal: teacher/student attendance, a 0-100 score and description for every attending student, class reflection, and up to three documentation photos per meeting. Drafts may have incomplete feedback.
- Lesson Plans: date, objectives, learning activities/timing, and resources for the next meeting.
- Semester Preparation: teacher-authored syllabus and Canva slide links or a PDF. The four supplied Canva template links are displayed in the slides view.
- Class Requests: item names/quantities, reason, needed-by date, and before-class or before-semester timeframe.
- Admin Approvals: a live review queue above the existing demo queue. Admin can approve, request revision with a note, reject with a note, or mark a class request fulfilled.
- Notifications: persisted submission receipts and admin review messages, unread filter, and mark-all-read.

Submitting again updates the same account/class/kind/date record. Approved or fulfilled records are read only for teachers. Drafts are not visible in the admin queue. Admin review and its teacher notification are written in one transaction. Concurrent admin decisions currently use last-write-wins.

## Deadlines and Templates

`TEACHING_SEMESTER_START` and `TEACHING_SUBMISSION_DEADLINE` accept ISO dates. The deadline must precede the semester start. Until both are supplied, the UI explicitly labels dates as sample dates (11 January 2027 / 4 January 2027). Late submissions are accepted and marked late; this is not a hard cutoff.

`TEACHING_CANVA_TEMPLATE` optionally adds another secure Canva template link. User slide submissions accept HTTPS links on `canva.com`, `www.canva.com`, or `canva.link`.

## Attachment Limits

Photos accept JPEG/PNG/WebP inputs up to 10 MB. Browser canvas re-encodes them (removing original metadata), downsizes them to a maximum 1440px, and reduces resolution/quality until each is at most 180 KB. Unsupported formats are rejected rather than silently uploaded uncompressed. PDF attachments are limited to one per non-meeting record and 1 MB. Server validation checks format signatures and actual byte lengths.

Files are served through an authenticated, uncached route. Only the owning teacher or an admin can retrieve them. Files are never written into public assets. PostgreSQL binary storage is intentionally bounded for this initial portal; move media to private object storage when usage grows. PDFs are downloads, not embedded executable content. No antivirus service is configured; use only trusted teaching material.

## External Notifications

Dashboard delivery is active. Email and WhatsApp are explicitly marked not connected/not sent. No WhatsApp API or email delivery credentials have been supplied. No fake delivery success or manual `wa.me` link is presented as automatic notification. Automatic external delivery and scheduled deadline reminders require a provider and deployment scheduling, and are not active in this version.

## Verification

The shared Smooth UI Words preloader follows initial hydration, route loading, pending internal navigation, and login/logout actions. It has no artificial hold timer. Journal saves, dashboard tabs, and inquiry validation keep their local indicators. Reduced-motion and no-JavaScript fallbacks are supported.

```powershell
npx tsc --noEmit
node --env-file=.env.local tests/teacher-check.mjs
node --env-file=.env.local tests/preloader-check.mjs
```

The teacher browser check uses an isolated temporary account, verifies compression and protected attachments, reloads to verify persistence, reviews a request as admin, checks notifications, and removes only its test account and submissions in cleanup. The preloader check exercises initial rendering, words cycling, repeated invalid login, both roles, logout, delayed navigation, cancelled unsaved-form navigation, and the inquiry dropdown on desktop/mobile. Set `BASE_URL` to use a server other than port 3001.
