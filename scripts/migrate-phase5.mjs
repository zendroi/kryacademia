import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const url = new URL(process.env.DATABASE_URL);
const sql = postgres(url.href, { ssl: ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? false : 'verify-full', max: 1, onnotice: () => {} });
try {
  console.log(JSON.stringify(await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(731903)`;
    const [before] = await tx`SELECT md5(content::text) AS hash FROM academy_catalog WHERE id = 1`;
    const [count] = await tx`SELECT count(*)::int AS count FROM teacher_notifications`;
    await tx.unsafe(await readFile(new URL('../database/phase5.sql', import.meta.url), 'utf8'));
    assert.equal((await tx`SELECT md5(content::text) AS hash FROM academy_catalog WHERE id = 1`)[0].hash, before.hash);
    assert.equal((await tx`SELECT count(*)::int AS count FROM teacher_notifications`)[0].count, count.count);
    const [legacy] = await tx`SELECT count(*)::int AS count FROM submission_deadlines WHERE kind = 'request' AND request_timing = ''`;
    return { migrated: true, catalogArchiveHash: before.hash, notificationsPreserved: count.count, requestDeadlinesNeedingScope: legacy.count };
  })));
} finally { await sql.end(); }
