import { timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';
import { runNotificationJobs } from '@/lib/notification-jobs.mjs';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return Response.json({ error: 'Scheduler is not configured.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const supplied = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return Response.json({ error: 'Unauthorized.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  try { return Response.json(await runNotificationJobs(db()), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { console.error('Notification scheduler failed'); return Response.json({ error: 'Notification jobs failed.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } }); }
}
