import 'server-only';
import type postgres from 'postgres';
import { db } from './db';
import { requireSession } from './auth';
import type { TeachingConfig, TeachingRecord, TeacherNotification } from '@/app/teacher/teacherData';

export function teachingConfig(): TeachingConfig {
  const semesterStart = process.env.TEACHING_SEMESTER_START || '2027-01-11';
  const deadline = process.env.TEACHING_SUBMISSION_DEADLINE || '2027-01-04';
  const canvaTemplate = process.env.TEACHING_CANVA_TEMPLATE || '';
  if (![semesterStart, deadline].every((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date))) || deadline >= semesterStart) throw new Error('Invalid teaching semester configuration');
  if (canvaTemplate && !/^https:\/\/(www\.)?canva\.com\//.test(canvaTemplate)) throw new Error('Invalid Canva template configuration');
  return { semesterStart, deadline, canvaTemplate, sample: !process.env.TEACHING_SEMESTER_START || !process.env.TEACHING_SUBMISSION_DEADLINE };
}

export async function loadTeachingRecords(email?: string): Promise<TeachingRecord[]> {
  const session = await requireSession();
  if (session.role !== 'admin' && email !== session.email) throw new Error('This teaching history is not accessible.');
  const sql = db();
  // ponytail: complete pilot history avoids false missing tasks; paginate by class/semester as data grows.
  return sql<TeachingRecord[]>`
    SELECT id, teacher_email AS "teacherEmail", kind, class_id AS "classId",
      meeting_date::text AS date, title, content, files, status,
      reviewer_note AS "reviewerNote", updated_at::text AS "updatedAt", revision
    FROM teaching_record_details
    ${email ? sql`WHERE teacher_email = ${email}` : sql``}
    ORDER BY updated_at DESC
  `;
}

export async function readTeachingRecord(tx: postgres.TransactionSql, id: string) {
  const [record] = await tx<TeachingRecord[]>`
    SELECT id, teacher_email AS "teacherEmail", kind, class_id AS "classId",
      meeting_date::text AS date, title, content, files, status,
      reviewer_note AS "reviewerNote", updated_at::text AS "updatedAt", revision
    FROM teaching_record_details WHERE id = ${id}
  `;
  if (!record) throw new Error('The saved teaching record is unavailable.');
  return record;
}

export async function loadTeacherNotifications(email: string) {
  const session = await requireSession();
  if (session.role !== 'admin' && email !== session.email) throw new Error('These notifications are not accessible.');
  return db()<TeacherNotification[]>`
    SELECT id, record_id AS "recordId", title, message, read, created_at::text AS "createdAt"
    FROM teacher_notifications WHERE teacher_email = ${email}
    ORDER BY created_at DESC LIMIT 100
  `;
}
