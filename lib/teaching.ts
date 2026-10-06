import 'server-only';
import { db } from './db';
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
  const sql = db();
  return sql<TeachingRecord[]>`
    SELECT id, teacher_email AS "teacherEmail", kind, class_id AS "classId",
      meeting_date::text AS date, title, content, files, status,
      reviewer_note AS "reviewerNote", updated_at::text AS "updatedAt"
    FROM teaching_records
    WHERE ${email ? sql`teacher_email = ${email}` : sql`status != 'Draft'`}
    ORDER BY updated_at DESC LIMIT 100
  `;
}

export async function loadTeacherNotifications(email: string) {
  return db()<TeacherNotification[]>`
    SELECT id, record_id AS "recordId", title, message, read, created_at::text AS "createdAt"
    FROM teacher_notifications WHERE teacher_email = ${email}
    ORDER BY created_at DESC LIMIT 100
  `;
}
