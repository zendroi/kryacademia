'use server';

import { randomUUID } from 'node:crypto';
import { requireRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { loadTeachingRecords, loadTeacherNotifications, teachingConfig } from '@/lib/teaching';
import { loadTeachingCatalog } from '@/lib/academy-store';
import { assignedCatalog, validDate, type AcademyCatalog } from '@/lib/academy';
import { recordLabels, validateDraft, type RecordDraft, type RecordStatus, type TeachingFile, type TeachingContent } from './teacherData';

export async function saveTeachingRecord(input: RecordDraft) {
  const session = await requireRole('teacher');
  try {
    if (!input || !Object.hasOwn(recordLabels, input.kind) || typeof input.classId !== 'string' || !validDate(input.date) || (input.id && !/^[a-f0-9-]{36}$/i.test(input.id))) throw new Error('Invalid teaching record.');
    const sql = db();
    await sql.begin(async (tx) => {
      const [catalogRow] = await tx`SELECT content FROM academy_catalog WHERE id = 1 FOR SHARE`;
      if (!catalogRow) throw new Error('Admin must initialize the class catalog first.');
      let catalog = assignedCatalog(catalogRow.content as AcademyCatalog, session.email);
      const klass = catalog.klasses.find((klass) => klass.id === input.classId);
      if (!klass) throw new Error('This Klass is not assigned to your teacher account.');
      const [owned] = await tx`SELECT id, content FROM teaching_records WHERE teacher_email = ${session.email} AND kind = ${input.kind} AND class_id = ${input.classId} AND meeting_date = ${input.date} ${input.id ? tx`AND id = ${input.id}` : tx``} FOR UPDATE`;
      if (input.id && !owned) throw new Error('This record is not available to your account.');
      if (owned && !input.id) throw new Error('A record already exists for this Klass and date. Open it from Class Workflow or Recent submissions.');
      if (input.kind === 'syllabus' && input.content?.workflowVersion === 2) {
        const deadline = input.date === klass.deadlines?.semesterStart ? klass.deadlines.syllabus : owned?.content.deadline;
        if (!deadline) throw new Error('Admin must set the semester start and syllabus deadline for this Klass first.');
        input = { ...input, content: { ...input.content, deadline } };
      }
      if (owned && input.kind === 'meeting' && Array.isArray(owned.content.students)) {
        // Preserve the historical roster when current enrollments change.
        catalog = { ...catalog, students: (owned.content as TeachingContent).students!.map((entry) => ({ id: entry.id, name: entry.name || catalog.students.find((student) => student.id === entry.id)?.name || entry.id, school: '', grade: '', klass: '', score: 0, attendance: 0, classIds: [input.classId] })) };
      }
      validateDraft(input, { ...teachingConfig(), ...(klass.deadlines?.semesterStart ? { semesterStart: klass.deadlines.semesterStart, deadline: klass.deadlines.syllabus, sample: false } : {}) }, catalog);
      if (input.content.workflowVersion !== 2 && (!owned || owned.content.workflowVersion === 2)) throw new Error('Use the current syllabus and meeting workflow for new records.');
      if (input.content.syllabusId) {
        const [syllabus] = await tx`SELECT content, meeting_date::text AS date, status FROM teaching_records WHERE id = ${input.content.syllabusId} AND teacher_email = ${session.email} AND class_id = ${input.classId} AND kind = 'syllabus' FOR UPDATE`;
        if (!syllabus || !['Submitted', 'Approved'].includes(syllabus.status)) throw new Error('Choose a submitted or approved syllabus belonging to your Klass.');
        const planned = (syllabus.content as TeachingContent).sessions?.[Number(input.content.meetingNumber) - 1];
        if (input.kind === 'request' && input.content.timing === 'Before semester') {
          if (input.date !== syllabus.date) throw new Error('Semester requests must use the selected semester start date.');
        } else if (!planned || planned.date !== input.date) throw new Error('The meeting date must match the selected syllabus meeting.');
      }
      if (owned && input.kind === 'syllabus') {
        const children = await tx`SELECT kind, meeting_date::text AS date, content FROM teaching_records WHERE teacher_email = ${session.email} AND content->>'syllabusId' = ${owned.id}`;
        if (children.some((child) => !(child.kind === 'request' && child.content.timing === 'Before semester') && child.content.meetingNumber && input.content.sessions?.[Number(child.content.meetingNumber) - 1]?.date !== child.date)) throw new Error('Keep meeting dates with existing records unchanged. Add new meetings after them.');
      }
      const [{ id } = {}] = await tx`
        INSERT INTO teaching_records (id, teacher_email, kind, class_id, meeting_date, title, content, status)
        VALUES (${input.id || randomUUID()}, ${session.email}, ${input.kind}, ${input.classId}, ${input.date}, ${input.title.trim()}, ${sql.json({ ...input.content, ...(input.kind === 'meeting' ? { students: input.content.students?.map((entry) => ({ ...entry, name: catalog.students.find((student) => student.id === entry.id)?.name || entry.id })) } : {}) })}, ${input.submit ? 'Submitted' : 'Draft'})
        ON CONFLICT (teacher_email, kind, class_id, meeting_date) DO UPDATE
        SET title = EXCLUDED.title, content = EXCLUDED.content, status = EXCLUDED.status, reviewer_note = '', updated_at = NOW()
        WHERE teaching_records.status NOT IN ('Approved', 'Fulfilled') AND teaching_records.id = EXCLUDED.id
        RETURNING id
      `;
      if (!id) throw new Error('Approved or fulfilled records cannot be changed.');
      const existing = await tx`SELECT id FROM teaching_files WHERE record_id = ${id}`;
      const files: TeachingFile[] = [];
      for (const file of input.files) {
        if (file.data) {
          const match = /^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/.exec(file.data);
          if (!match || match[1] !== file.mime) throw new Error('Invalid file data.');
          const bytes = Buffer.from(match[2], 'base64');
          const valid = file.mime === 'application/pdf' ? bytes.subarray(0, 5).toString() === '%PDF-' : file.mime === 'image/webp' ? bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' : file.mime === 'image/png' ? bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
          if (!valid || bytes.length !== file.size) throw new Error('The file contents do not match its format.');
          const fileId = randomUUID();
          await tx`INSERT INTO teaching_files (id, record_id, name, mime, bytes) VALUES (${fileId}, ${id}, ${file.name}, ${file.mime}, ${bytes})`;
          files.push({ id: fileId, name: file.name, mime: file.mime, size: file.size });
        } else {
          if (!existing.some((owned) => owned.id === file.id)) throw new Error('This attachment belongs to another record.');
          files.push({ id: file.id, name: file.name, mime: file.mime, size: file.size });
        }
      }
      await tx`UPDATE teaching_records SET files = ${sql.json(files)} WHERE id = ${id}`;
      for (const removed of existing.filter((file) => !files.some((keep) => keep.id === file.id))) await tx`DELETE FROM teaching_files WHERE id = ${removed.id}`;
      if (input.submit) await tx`
        INSERT INTO teacher_notifications (id, teacher_email, record_id, title, message)
        VALUES (${randomUUID()}, ${session.email}, ${id}, ${`${recordLabels[input.kind]} submitted`}, ${`${input.title.trim()} has been saved. ${['syllabus', 'slides', 'request'].includes(input.kind) ? 'Waiting for admin review.' : 'Your meeting record is available in the workspace.'}`})
      `;
    });
    return { ok: true as const, records: await loadTeachingRecords(session.email), notifications: await loadTeacherNotifications(session.email) };
  } catch (error) {
    console.error('Teaching submission failed', error instanceof Error ? error.message : 'Unknown error');
    return { ok: false as const, error: error instanceof Error && !(error as { code?: string }).code ? error.message : 'Could not save. Your form is unchanged; please try again.' };
  }
}

export async function reviewTeachingRecord(id: string, status: RecordStatus, note: string) {
  await requireRole('admin');
  if (!/^[a-f0-9-]{36}$/i.test(id) || !['Approved', 'Needs revision', 'Rejected', 'Fulfilled'].includes(status) || typeof note !== 'string' || note.length > 2000 || (['Needs revision', 'Rejected'].includes(status) && !note.trim())) return { ok: false as const, error: 'Add a review note before requesting changes or rejecting.' };
  try {
    await db().begin(async (tx) => {
      const [record] = await tx`UPDATE teaching_records SET status = ${status}, reviewer_note = ${note.trim()}, updated_at = NOW() WHERE id = ${id} AND status != 'Draft' AND (kind = 'request' OR ${status} != 'Fulfilled') RETURNING teacher_email, title`;
      if (!record) throw new Error('This submission is not available for review.');
      await tx`INSERT INTO teacher_notifications (id, teacher_email, record_id, title, message) VALUES (${randomUUID()}, ${record.teacher_email}, ${id}, ${`${record.title}: ${status}`}, ${note.trim() || `Admin marked this submission as ${status.toLowerCase()}.`})`;
    });
    return { ok: true as const, records: await loadTeachingRecords() };
  } catch {
    return { ok: false as const, error: 'Could not save the review. Please retry.' };
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
