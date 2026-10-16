'use server';

import { requireRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { loadNotificationJobs } from '@/lib/notifications';

export async function refreshNotificationJobs() {
  await requireRole('admin');
  try { return { ok: true as const, jobs: await loadNotificationJobs() }; }
  catch { return { ok: false as const, error: 'Delivery jobs unavailable. Check the Phase 5 migration and retry.' }; }
}

export async function retryNotificationJob(id: string) {
  const session = await requireRole('admin');
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id)) return { ok: false as const, error: 'Invalid delivery job.' };
  try {
    const [job] = await db()`UPDATE notification_jobs SET status = 'pending', attempts = 0, available_at = NOW(), last_error = '',
      retried_by = ${session.email}, retried_at = NOW() WHERE id = ${id} AND status = 'failed' RETURNING id`;
    if (!job) return { ok: false as const, error: 'This job changed or is not failed. Refresh the list.' };
    return { ok: true as const, jobs: await loadNotificationJobs() };
  } catch { return { ok: false as const, error: 'Could not retry this job.' }; }
}
