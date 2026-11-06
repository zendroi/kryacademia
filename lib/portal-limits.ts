import 'server-only';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { headers } from 'next/headers';
import { db } from './db';
import { isMySQL } from './sql-dialect.mjs';

export async function portalLimit(scope: string, subject: string | null | undefined, limit: number, seconds: number) {
  if (!subject) return true;
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET is not configured');
  const key = `${scope}:${createHmac('sha256', secret).update(subject).digest('hex')}`;
  const sql = db();
  if (isMySQL(sql)) return sql.begin(async (tx) => {
    await tx`DELETE FROM portal_rate_limits WHERE window_start < DATE_SUB(CURRENT_TIMESTAMP(6), INTERVAL 2 DAY)`;
    await tx`INSERT INTO portal_rate_limits (\`key\`) VALUES (${key}) ON DUPLICATE KEY UPDATE
      attempts = CASE WHEN window_start <= DATE_SUB(CURRENT_TIMESTAMP(6), INTERVAL ${seconds} SECOND) THEN 1 ELSE LEAST(attempts + 1, ${limit + 1}) END,
      window_start = CASE WHEN window_start <= DATE_SUB(CURRENT_TIMESTAMP(6), INTERVAL ${seconds} SECOND) THEN CURRENT_TIMESTAMP(6) ELSE window_start END`;
    const [row] = await tx`SELECT attempts FROM portal_rate_limits WHERE \`key\` = ${key}`;
    return (row?.attempts ?? 0) <= limit;
  });
  await sql`DELETE FROM portal_rate_limits WHERE window_start < CURRENT_TIMESTAMP(6) - INTERVAL '2 days'`;
  const [row] = await sql`INSERT INTO portal_rate_limits ("key") VALUES (${key})
    ON CONFLICT ("key") DO UPDATE SET
      attempts = CASE WHEN portal_rate_limits.window_start <= CURRENT_TIMESTAMP(6) - ${seconds} * INTERVAL '1 second' THEN 1 ELSE LEAST(portal_rate_limits.attempts + 1, ${limit + 1}) END,
      window_start = CASE WHEN portal_rate_limits.window_start <= CURRENT_TIMESTAMP(6) - ${seconds} * INTERVAL '1 second' THEN CURRENT_TIMESTAMP(6) ELSE portal_rate_limits.window_start END
    RETURNING attempts`;
  return (row?.attempts ?? 0) <= limit;
}

export async function portalClientAddress(): Promise<string | null> {
  const reqHeaders = await headers();
  const candidate =
    reqHeaders.get('cf-connecting-ip')?.trim() ||
    reqHeaders.get('x-real-ip')?.trim() ||
    reqHeaders.get('x-forwarded-for')?.split(',')[0].trim();

  if (candidate && isIP(candidate)) return candidate;
  if (process.env.NODE_ENV !== 'production') return '127.0.0.1';
  return null;
}
