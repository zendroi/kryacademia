import 'server-only';
import { requireRole } from './auth';
import { db } from './db';

export type NotificationJob = { id: string; teacherEmail: string; title: string; status: 'pending' | 'delivered' | 'failed' | 'cancelled'; attempts: number; createdAt: string; availableAt: string; lastError: string };

export async function loadNotificationJobs(): Promise<NotificationJob[]> {
  await requireRole('admin');
  return db()<NotificationJob[]>`SELECT id, teacher_email AS "teacherEmail", title, status, attempts,
    created_at::text AS "createdAt", available_at::text AS "availableAt", last_error AS "lastError"
    FROM notification_jobs ORDER BY (status = 'failed') DESC, created_at DESC, id DESC LIMIT 100`;
}
