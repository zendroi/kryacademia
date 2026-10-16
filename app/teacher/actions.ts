'use server';

import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { requireRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { loadTeachingRecords, loadTeacherNotifications, readTeachingRecord, teachingConfig } from '@/lib/teaching';
import { loadTeachingCatalog, readAcademyCatalog } from '@/lib/academy-store';
import { assignedCatalog, validDate } from '@/lib/academy';
import { writeTeachingWorkflow } from '@/lib/teaching-workflow';
import { verifyUpload } from '@/lib/upload-validation.mjs';
import { stagePrivateFile } from '@/lib/private-files.mjs';
import { portalLimit } from '@/lib/portal-limits';
import { notifyTeacher } from '@/lib/notification-jobs.mjs';
import { recordLabels, validateDraft, type RecordDraft, type RecordStatus, type TeachingFile, type TeachingContent } from './teacherData';

export async function saveTeachingRecord(input: RecordDraft) {
  const session = await requireRole('teacher');
  try {
    if (!input || !Object.hasOwn(recordLabels, input.kind) || typeof input.classId !== 'string' || !validDate(input.date) || (input.id && !/^[a-f0-9-]{36}$/i.test(input.id))) throw new Error('Invalid teaching record.');
    const sql = db();
    if (!Array.isArray(input.files) || input.files.length > 4) throw new Error('Attach up to three photos and one PDF.');
    async function checkDraft(tx: postgres.TransactionSql) {
      const fullCatalog = await readAcademyCatalog(tx);
      const [active] = await tx`SELECT email FROM portal_users WHERE email = ${session.email} AND role = 'teacher' AND status = 'active' FOR SHARE`;
      const [live] = await tx`SELECT id FROM portal_sessions WHERE id = ${session.id} AND email = ${session.email} AND expires_at > NOW() FOR SHARE`;
      if (!active || !live) throw new Error('Your session is no longer active. Sign in again.');
      let catalog = assignedCatalog(fullCatalog, session.email);
      const klass = catalog.klasses.find((klass) => klass.id === input.classId);
      if (!klass) throw new Error('This Klass is not assigned to your teacher account.');
      const [owned] = await tx`SELECT details.* FROM teaching_records r JOIN teaching_record_details details ON details.id = r.id WHERE r.teacher_email = ${session.email} AND r.kind = ${input.kind} AND r.class_id = ${input.classId} AND r.meeting_date = ${input.date} ${input.id ? tx`AND r.id = ${input.id}` : tx``} FOR UPDATE OF r`;
      if (input.id && !owned) throw new Error('This record is not available to your account.');
      if (owned && !input.id) throw new Error('A record already exists for this Klass and date. Open it from Class Workflow or Recent submissions.');
      if (owned && (!Number.isInteger(input.revision) || input.revision !== owned.revision)) throw new Error('This record changed in another tab or review. Your form is unchanged. Refresh the workspace and reopen the latest record before saving.');
      if (owned && ['Approved', 'Fulfilled'].includes(owned.status)) throw new Error('Approved or fulfilled records cannot be changed.');
      if (input.kind === 'syllabus' && input.content?.workflowVersion === 2) {
        const deadline = input.date === klass.deadlines?.semesterStart ? klass.deadlines.syllabus : owned?.content.deadline;
        if (!deadline) throw new Error('Admin must set the semester start and syllabus deadline for this Klass first.');
        input = { ...input, content: { ...input.content, deadline } };
      }
      if (owned && input.kind === 'meeting' && Array.isArray(owned.content.students)) {
        // Preserve the historical roster when current enrollments change.
        catalog = { ...catalog, students: (owned.content as TeachingContent).students!.map((entry) => ({ id: entry.id, name: entry.name || catalog.students.find((student) => student.id === entry.id)?.name || entry.id, school: '', grade: '', klass: '', score: 0, attendance: 0, classIds: [input.classId] })) };
      }
      if (Array.isArray(input.files)) input = { ...input, files: input.files.map((file) => {
        if (file?.data) return file;
        const stored = (owned?.files as TeachingFile[] | undefined)?.find((attachment) => attachment.id === file?.id);
        if (!stored) throw new Error('This attachment belongs to another record.');
        return stored;
      }) };
      validateDraft(input, { ...teachingConfig(), ...(klass.deadlines?.semesterStart ? { semesterStart: klass.deadlines.semesterStart, deadline: klass.deadlines.syllabus, sample: false } : {}) }, catalog);
      if (input.content.workflowVersion !== 2 && (!owned || owned.content.workflowVersion === 2)) throw new Error('Use the current syllabus and meeting workflow for new records.');
      if (input.content.syllabusId) {
        const [syllabus] = await tx`SELECT details.content, r.meeting_date::text AS date, r.status FROM teaching_records r JOIN teaching_record_details details ON details.id = r.id WHERE r.id = ${input.content.syllabusId} AND r.teacher_email = ${session.email} AND r.class_id = ${input.classId} AND r.kind = 'syllabus' FOR UPDATE OF r`;
        if (!syllabus || !['Submitted', 'Approved'].includes(syllabus.status)) throw new Error('Choose a submitted or approved syllabus belonging to your Klass.');
        const planned = (syllabus.content as TeachingContent).sessions?.[Number(input.content.meetingNumber) - 1];
        if (input.kind === 'request' && input.content.timing === 'Before semester') {
          if (input.date !== syllabus.date) throw new Error('Semester requests must use the selected semester start date.');
        } else if (!planned || planned.date !== input.date) throw new Error('The meeting date must match the selected syllabus meeting.');
      }
      if (owned && input.kind === 'syllabus') {
        const children = await tx`SELECT kind, meeting_date::text AS date, content FROM teaching_record_details WHERE teacher_email = ${session.email} AND content->>'syllabusId' = ${owned.id}`;
        if (children.some((child) => !(child.kind === 'request' && child.content.timing === 'Before semester') && child.content.meetingNumber && input.content.sessions?.[Number(child.content.meetingNumber) - 1]?.date !== child.date)) throw new Error('Keep meeting dates with existing records unchanged. Add new meetings after them.');
      }
      return { catalog, owned };
    }
    const uploads = new Map<string, { name: string; mime: string; bytes: Buffer; objectId: string }>();
    const incoming = input.files.filter((file) => file?.data);
    if (incoming.length) {
      await sql.begin(checkDraft);
      if (!(await portalLimit('teaching:upload', session.email, 20, 900))) throw new Error('Too many uploads. Wait 15 minutes before trying again.');
      const verified = await Promise.all(incoming.map(async (file) => ({ id: file.id, ...await verifyUpload(file) })));
      // Stage outside the document transaction so concurrent uploads cannot exhaust its connection pool.
      for (const file of verified) uploads.set(file.id, { ...file, objectId: await stagePrivateFile(sql, file) });
    }
    const record = await sql.begin(async (tx) => {
      const { catalog, owned } = await checkDraft(tx);
      const [{ id } = {}] = await tx`
        INSERT INTO teaching_records (id, teacher_email, kind, class_id, meeting_date, title, status)
        VALUES (${input.id || randomUUID()}, ${session.email}, ${input.kind}, ${input.classId}, ${input.date}, ${input.title.trim()}, ${input.submit ? 'Submitted' : 'Draft'})
        ON CONFLICT (teacher_email, kind, class_id, meeting_date) DO UPDATE
        SET title = EXCLUDED.title, status = EXCLUDED.status, reviewer_note = '', updated_at = NOW(), revision = teaching_records.revision + 1
        WHERE teaching_records.status NOT IN ('Approved', 'Fulfilled') AND teaching_records.id = EXCLUDED.id
        RETURNING id
      `;
      if (!id) throw new Error('Approved or fulfilled records cannot be changed.');
      await writeTeachingWorkflow(tx, { ...input, id, content: { ...input.content, ...(input.kind === 'meeting' ? { students: input.content.students?.map((entry) => ({ ...entry, name: catalog.students.find((student) => student.id === entry.id)?.name || entry.id })) } : {}) } });
      const existing = await tx`SELECT id FROM teaching_files WHERE record_id = ${id}`;
      const files: TeachingFile[] = [];
      for (const [position, file] of input.files.entries()) {
        if (file.data) {
          const processed = uploads.get(file.id);
          if (!processed) throw new Error('The uploaded file is unavailable. Please choose it again.');
          const fileId = randomUUID();
          await tx`INSERT INTO teaching_files (id, record_id, name, mime, object_id, size, position) VALUES (${fileId}, ${id}, ${processed.name}, ${processed.mime}, ${processed.objectId}, ${processed.bytes.length}, ${position})`;
          files.push({ id: fileId, name: processed.name, mime: processed.mime, size: processed.bytes.length });
        } else {
          if (!existing.some((owned) => owned.id === file.id)) throw new Error('This attachment belongs to another record.');
          await tx`UPDATE teaching_files SET position = ${position} WHERE id = ${file.id} AND record_id = ${id}`;
          files.push({ id: file.id, name: file.name, mime: file.mime, size: file.size });
        }
      }
      for (const removed of existing.filter((file) => !files.some((keep) => keep.id === file.id))) await tx`DELETE FROM teaching_files WHERE id = ${removed.id}`;
      const [saved] = await tx`SELECT * FROM teaching_record_details WHERE id = ${id}`;
      await tx`INSERT INTO teaching_events (id, record_id, actor_email, action, before_data, after_data) VALUES (${randomUUID()}, ${id}, ${session.email}, ${input.submit ? 'submit' : owned ? 'save' : 'create'}, ${tx.json(owned || {})}, ${tx.json(saved)})`;
      if (input.submit) await notifyTeacher(tx, { key: `submit:${id}:${saved.revision}`, teacherEmail: session.email, recordId: id,
        title: `${recordLabels[input.kind]} submitted`, message: `${input.title.trim()} has been saved. ${['syllabus', 'slides', 'request'].includes(input.kind) ? 'Waiting for admin review.' : 'Your meeting record is available in the workspace.'}` });
      return readTeachingRecord(tx, id);
    });
    try {
      return { ok: true as const, record, records: await loadTeachingRecords(session.email), notifications: await loadTeacherNotifications(session.email) };
    } catch {
      return { ok: true as const, record, refreshError: 'Your record was saved. Refresh the workspace to reload history and notifications.' };
    }
  } catch (error) {
    console.error('Teaching submission failed', error instanceof Error ? error.message : 'Unknown error');
    return { ok: false as const, error: error instanceof Error && !(error as { code?: string }).code ? error.message : 'Could not save. Your form is unchanged; please try again.' };
  }
}

export async function reviewTeachingRecord(id: string, status: RecordStatus, note: string, revision: number) {
  const session = await requireRole('admin');
  if (!/^[a-f0-9-]{36}$/i.test(id) || !['Approved', 'Needs revision', 'Rejected', 'Fulfilled'].includes(status) || typeof note !== 'string' || note.length > 2000 || (['Needs revision', 'Rejected'].includes(status) && !note.trim())) return { ok: false as const, error: 'Add a review note before requesting changes or rejecting.' };
  try {
    const record = await db().begin(async (tx) => {
      const [before] = await tx`SELECT details.* FROM teaching_records r JOIN teaching_record_details details ON details.id = r.id WHERE r.id = ${id} FOR UPDATE OF r`;
      if (before && (!Number.isInteger(revision) || revision !== before.revision)) throw new Error('This record changed. Refresh the page and review the latest submission.');
      const [record] = await tx`UPDATE teaching_records SET status = ${status}, reviewer_note = ${note.trim()}, updated_at = NOW(), revision = revision + 1 WHERE id = ${id} AND status != 'Draft' AND (kind = 'request' OR ${status} != 'Fulfilled') RETURNING teacher_email, title`;
      if (!before || !record) throw new Error('This submission is not available for review.');
      const [after] = await tx`SELECT * FROM teaching_record_details WHERE id = ${id}`;
      await tx`INSERT INTO teaching_events (id, record_id, actor_email, action, before_data, after_data) VALUES (${randomUUID()}, ${id}, ${session.email}, 'review', ${tx.json(before)}, ${tx.json(after)})`;
      await notifyTeacher(tx, { key: `review:${id}:${after.revision}`, teacherEmail: record.teacher_email, recordId: id,
        title: `${record.title}: ${status}`, message: note.trim() || `Admin marked this submission as ${status.toLowerCase()}.` });
      return readTeachingRecord(tx, id);
    });
    try { return { ok: true as const, record, records: await loadTeachingRecords() }; }
    catch { return { ok: true as const, record, refreshError: 'Review saved. Reload the page to refresh the other submissions.' }; }
  } catch (error) {
    return { ok: false as const, error: error instanceof Error && !(error as { code?: string }).code ? error.message : 'Could not save the review. Please retry.' };
  }
}

export async function markTeacherNotificationsRead() {
  const session = await requireRole('teacher');
  try {
    await db()`UPDATE teacher_notifications SET read = TRUE WHERE teacher_email = ${session.email}`;
    return { ok: true as const };
  } catch { return { ok: false as const, error: 'Could not update notifications.' }; }
}

export async function refreshTeacherWorkspace() {
  const session = await requireRole('teacher');
  try {
    const [records, notifications, catalog] = await Promise.all([loadTeachingRecords(session.email), loadTeacherNotifications(session.email), loadTeachingCatalog(session.email)]);
    return { ok: true as const, records, notifications, catalog };
  } catch { return { ok: false as const, error: 'Could not refresh the workspace.' }; }
}
