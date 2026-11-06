import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
if (process.env.DATABASE_URL?.startsWith('mysql:')) throw new Error('PostgreSQL migration only. For MySQL use scripts/hostinger-data.mjs prepare, import, then runtime; see docs/hostinger-migration.md.');

const url = new URL(process.env.DATABASE_URL);
const sql = postgres(url.href, { ssl: ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? false : 'verify-full', max: 1, onnotice: () => {} });
try {
  const result = await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(731903)`;
    const [before] = await tx`SELECT md5(content::text) AS hash FROM academy_catalog WHERE id = 1`;
    const [count] = await tx`SELECT count(*)::int AS count FROM teaching_records`;
    for (const file of ['academic-core', 'phase3', 'portal-revisions']) await tx.unsafe(await readFile(new URL(`../database/${file}.sql`, import.meta.url), 'utf8'));
    assert.equal((await tx`SELECT md5(content::text) AS hash FROM academy_catalog WHERE id = 1`)[0].hash, before.hash);
    assert.equal((await tx`SELECT count(*)::int AS count FROM teaching_records`)[0].count, count.count);
    return { migrated: true, catalogArchiveHash: before.hash, teachingRecordsPreserved: count.count };
  });
  console.log(JSON.stringify(result));
} finally { await sql.end(); }
