'use server';

import { randomUUID } from 'node:crypto';
import { requireRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { loadTeachingRecords, loadTeacherNotifications, teachingConfig } from '@/lib/teaching';
import { recordLabels, validateDraft, type RecordDraft, type RecordStatus, type TeachingFile } from './teacherData';

export async function saveTeachingRecord(input: RecordDraft) {
  const session = await requireRole('teacher');
  try {
    validateDraft(input, teachingConfig());
    const sql = db();
    await sql.begin(async (tx) => {
      if (input.id) {
        const [owned] = await tx`SELECT id FROM teaching_records WHERE id = ${input.id} AND teacher_email = ${session.email}`;
        if (!owned) throw new Error('This record is not available to your account.');
      }
      const [{ id } = {}] = await tx`
        INSERT INTO teaching_records (id, teacher_email, kind, class_id, meeting_date, title, content, status)
        VALUES (${input.id || randomUUID()}, ${session.email}, ${input.kind}, ${input.classId}, ${input.date}, ${input.title.trim()}, ${sql.json(input.content)}, ${input.submit ? 'Submitted' : 'Draft'})
        ON CONFLICT (teacher_email, kind, class_id, meeting_date) DO UPDATE
        SET title = EXCLUDED.title, content = EXCLUDED.content, status = EXCLUDED.status, reviewer_note = '', updated_at = NOW()
        WHERE teaching_records.status NOT IN ('Approved', 'Fulfilled')
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
    const [records, notifications] = await Promise.all([loadTeachingRecords(session.email), loadTeacherNotifications(session.email)]);
    return { ok: true as const, records, notifications };
  } catch { return { ok: false as const, error: 'Could not refresh the workspace.' }; }
}
