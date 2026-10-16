import 'server-only';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { headers } from 'next/headers';
import { db } from './db';

export async function portalLimit(scope: string, subject: string, limit: number, seconds: number) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET is not configured');
  const key = `${scope}:${createHmac('sha256', secret).update(subject).digest('hex')}`;
  const sql = db();
  await sql`DELETE FROM portal_rate_limits WHERE window_start < NOW() - INTERVAL '2 days'`;
  const [row] = await sql`INSERT INTO portal_rate_limits (key) VALUES (${key})
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN portal_rate_limits.window_start <= NOW() - ${seconds} * INTERVAL '1 second' THEN 1 ELSE LEAST(portal_rate_limits.attempts + 1, ${limit + 1}) END,
      window_start = CASE WHEN portal_rate_limits.window_start <= NOW() - ${seconds} * INTERVAL '1 second' THEN NOW() ELSE portal_rate_limits.window_start END
    RETURNING attempts`;
  return row.attempts <= limit;
}

export async function portalClientAddress() {
  // shortcut: non-Vercel traffic shares a conservative bucket; add trusted proxy handling before other production hosting.
  if (process.env.VERCEL === '1') {
    const value = (await headers()).get('x-forwarded-for')?.split(',')[0].trim();
    if (!value || !isIP(value)) throw new Error('Client address unavailable');
    return value;
  }
  return 'local';
}
