import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { core, workflow } from './academic-modules.mjs';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL).hostname);
const sql = postgres(process.env.DATABASE_URL, { ssl: local ? false : 'verify-full', max: 1, onnotice: () => {} });
try {
  const result = await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(731903)`;
    await tx.unsafe(await readFile(new URL('../database/phase3.sql', import.meta.url), 'utf8'));
    await tx.unsafe(await readFile(new URL('../database/phase5.sql', import.meta.url), 'utf8'));
    await core.initializeAcademicCore(tx);
    const [archive] = await tx`SELECT md5(content::text) AS hash FROM academy_catalog WHERE id = 1`;
    const before = await tx`SELECT r.id, r.content, r.files, EXISTS (SELECT 1 FROM teaching_documents d WHERE d.record_id = r.id) AS normalized FROM teaching_records r ORDER BY r.id`;
    await workflow.migrateTeachingWorkflow(tx);
    const details = await tx`SELECT id, content, files FROM teaching_record_details ORDER BY id`;
    assert.equal(details.length, before.length, 'A historical teaching record was not migrated');
    for (const record of before) {
      if (record.normalized) continue;
      const migrated = details.find((item) => item.id === record.id);
      // Original JSON remains an archive; every supported historical field must survive the first conversion.
      for (const [key, value] of Object.entries(record.content)) assert.deepEqual(migrated.content[key], value, `Migration changed ${record.id}.${key}`);
      for (const file of record.files) assert.ok(migrated.files.some((item) => item.id === file.id && item.size === file.size), `Missing attachment ${file.id}`);
    }
    const [after] = await tx`SELECT md5(content::text) AS hash FROM academy_catalog WHERE id = 1`;
    assert.equal(after.hash, archive.hash, 'Catalog archive changed');
    const catalog = await core.readAcademicCore(tx);
    return { catalogArchiveHash: archive.hash, klasses: catalog.klasses.length, institutions: catalog.institutions.length, coaches: catalog.coaches.length, students: catalog.students.length, teachingRecords: details.length };
  });
  console.log('Phase 3 migration complete. Legacy archives preserved.');
  console.log(JSON.stringify(result));
} finally { await sql.end(); }
