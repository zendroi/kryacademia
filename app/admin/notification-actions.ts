'use server';
import { textColumn } from '@/lib/sql-dialect.mjs';

import { requireRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { loadNotificationJobs, type NotificationJob } from '@/lib/notifications';

export async function refreshNotificationJobs() {
  await requireRole('admin');
  try { return { ok: true as const, jobs: await loadNotificationJobs() }; }
  catch { return { ok: false as const, error: 'Delivery jobs unavailable. Check the Phase 5 migration and retry.' }; }
}

export async function retryNotificationJob(id: string) {
  const session = await requireRole('admin');
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id)) return { ok: false as const, error: 'Invalid delivery job.' };
  try {
    const job = await db().begin(async (tx) => {
      if (!(await tx`SELECT id FROM notification_jobs WHERE id = ${id} AND status = 'failed' FOR UPDATE`).length) return undefined;
      await tx`UPDATE notification_jobs SET status = 'pending', attempts = 0, available_at = CURRENT_TIMESTAMP(6), last_error = '', retried_by = ${session.email}, retried_at = CURRENT_TIMESTAMP(6) WHERE id = ${id}`;
      return (await tx<NotificationJob[]>`SELECT id, teacher_email AS "teacherEmail", title, status, attempts, ${textColumn(tx, 'created_at')} AS "createdAt", ${textColumn(tx, 'available_at')} AS "availableAt", last_error AS "lastError" FROM notification_jobs WHERE id = ${id}`)[0];
    });
    if (!job) return { ok: false as const, error: 'This job changed or is not failed. Refresh the list.' };
    try { return { ok: true as const, job, jobs: await loadNotificationJobs() }; }
    catch { return { ok: true as const, job, refreshError: 'Retry saved. Refresh jobs to reload the latest delivery status.' }; }
  } catch { return { ok: false as const, error: 'Could not retry this job.' }; }
}
