# Phase 3: Relational Catalog And Teacher Workflow

## Storage Contract

`academy_catalog` is the pre-cutover archive. `academy_core_state.relational_ready` records that the one-time import completed. The application reads the relational catalog and updates only changed records, with the existing revision checks and a transaction lock protecting assignment/enrollment edits. Reads no longer synchronize from JSON. Empty meeting deadlines still retain their configured meeting date in `class_meetings`.

Teacher records retain their IDs, owner, class, date, title, status and review note in `teaching_records`. Data belongs to `teaching_documents`, `teaching_syllabuses`, `syllabus_meetings`, `teaching_lesson_plans`, `lesson_plan_steps`, `teaching_meeting_journals`, `student_meeting_feedback`, `teaching_materials` and `class_requests`. `teaching_record_details` rebuilds the existing frontend contract from those tables. JSON is used only for the frozen original documents and audit snapshots.

Student feedback stores a historical student ID/name as well as an optional foreign key to the current profile. Missing historical profiles are preserved without inventing students. Current enrollment changes never rewrite historical attendance or feedback. Historical records with an unavailable class retain their document data without inventing a class meeting.

Attachments retain their IDs in `teaching_files`; metadata and size come from verified server output, not client-supplied metadata. Phase 4 moves file bodies to private storage. `teaching_events` captures actor, action and before/after document snapshots for saves, submissions and reviews. These events are committed with the document and notification. Existing role, assignment and historical-read rules still apply.

## Deployment

1. Complete the isolated security suite and take a database backup/branch for the release.
2. Stop writes from the old application during the cutover. Do not run the Phase 2 and Phase 3 writers together.
3. With the target `DATABASE_URL`, run `npm run db:phase3`. The existing auth/teacher/academy/academic-core/security migrations must already be installed. Never rerun `database/init.sql` on operational data.
4. The command applies `phase3.sql` and the compatible Phase 5 schema, imports the catalog once, normalizes old teacher documents, compares their content and attachments, and checks the catalog archive hash. A failed conversion rolls back the transaction. Scheduling is not activated by this migration.
5. Start the Phase 3 build and verify admin and teacher access before reopening writes.

The migration can be rerun; it skips documents already normalized and does not overwrite relational edits. The frozen JSON is not a current backup after new edits. Returning to older application code requires restoring the release backup or explicitly exporting current relational data into the old format.

## Checks And Remaining Work

`npm run test:security` applies the Phase 3 migration in its isolated schema, tests archive preservation and all five document conversions, verifies relational edits and constraints, then runs the existing auth, academy, inquiry, admin and teacher browser workflows. Fixture writes target relational tables; they never update the catalog archive.

Private object storage, upload verification, optimistic concurrency and backup/restore tooling are implemented in [Phase 4](phase4.md). Request deadlines and dashboard delivery jobs are implemented in [Phase 5](phase5.md). External email/WhatsApp delivery and a student portal remain separate work. Approved and fulfilled submissions remain locked for teachers.
