# Teacher Workflow Revisions

## Setup

Run `npm run db:revisions` before deploying this version. This reapplies the idempotent Phase 3 DDL/view and adds onboarding storage and meeting material fields. It never reruns `database/init.sql` or rewrites the archived catalog.

Preview the supplied institution/Klass import with:

```powershell
node --env-file=.env.local scripts/import-class-request-catalog.mjs
node --env-file=.env.local scripts/import-class-request-catalog.mjs --apply
```

The snapshot in `data/class-request-catalog.json` comes from the `Kebutuhan Kelas` sheet of the supplied `class request.xlsx`. XZ is Xin Zhong; DM is Dharma Mulya. It contains seven institutions and seven institution/Klass combinations. Gloria 1 and Gloria 3 intentionally have no assigned Klass. Existing records, assignments, enrollments and archived catalog data are retained. The import is idempotent and does not overwrite subsequent admin edits. It does not import historical material requests, infer coach assignments, create students or approve anything. New groups use provisional Onsite mode; admin must confirm delivery mode, schedule, descriptions and assignments before use.

## Class Requests

Class Workflow and Class Requests remain available. Each new request contains item names and quantities (including units), grouped by class and the selected meeting or semester. Institution comes from the group's institution relationship; teachers can only select their assigned groups.

Teachers submit requests for admin review. Per-item remarks are editable only by admin and are enforced server-side, not merely hidden in the form. Teachers can see those remarks after refresh. A request must be Approved before it can be Fulfilled. Approved/Fulfilled records are read-only to teachers; revision and rejection notes remain supported. Legacy free-text requests remain readable and editable through their original form.

## Attendance And Feedback

Students marked Absent or Excused have no editable personal feedback, numeric score or rubric controls. Their attendance still persists; feedback remains mandatory for Present/Late students. Previously entered feedback is not silently erased when attendance is toggled.

Admin opens a coach profile and selects a month to view verified attendance by class. Only Approved journals with teacher attendance Present/Late count as verified. Submitted attendance is shown separately. Draft, rejected, revision, absent and excused records are excluded. Monthly counts can be exported as CSV; this is an attendance report, not a salary calculation.

Semester progress uses unique configured meeting dates, falling back to the latest matching approved syllabus. Missing schedules display an unknown denominator rather than inventing a target. Monthly attendance remains separate from semester progress.
Shared pilot logins are scoped to each coach profile's current assignments to avoid counting another profile's classes. Give each operational coach a separate login; historical classes cannot be reliably attributed between profiles sharing one account.

## Meeting Materials

Admin configures meeting dates and presentation/worksheet Canva URLs in Klass Management. Teacher lesson plans link to the assigned presentation. Material recap uses the same assignment, with HTTPS Canva host validation on the server. When admin has configured dates for the current semester, the teacher's syllabus must use that meeting count and dates. Teachers still author topics and teaching content. Existing PDF-derived links remain fallback references for unconfigured meetings.

## Teacher Accounts And Identity

Admin creates teacher login email/password in Teacher accounts. Passwords are hashed immediately and never returned or stored as plaintext. Admin shares credentials privately, together with a 48-hour, single-use registration invitation. An expired/lost invitation can be renewed for an incomplete pending registration; renewal invalidates the previous link. Delivery by email/WhatsApp is not automated.

Registration asks for the teacher's name, bank, account number, account holder and a KTP photo, not credentials. A valid invitation is required before uploads can be staged. Images use the existing browser compression plus independent server format/decode/re-encode checks. This is not a guarantee against every possible malware technique or a separate antivirus service.

KTP photos use private file storage, never public academy image URLs. Only authenticated admins can open the no-store identity endpoint. Teachers and anonymous users cannot read it. KTP and bank information is returned only in the admin account list, never the teacher catalog or public pages. Admin approval is blocked until an invited teacher finishes onboarding. Existing accounts are preserved and are not forced to re-register.

Private-file cleanup and encrypted backups include onboarding attachments. Invitation tokens are stored only as hashes. Do not put real KTP photos, account numbers, credentials or invitation URLs in screenshots, logs, fixtures or Git.
