import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { verifyUpload } from '../lib/upload-validation.mjs';
import { stagePrivateFile, readPrivateFile, cleanupPrivateFiles } from '../lib/private-files.mjs';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const sql = postgres(process.env.DATABASE_URL, { ssl: ['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname) ? false : 'verify-full', max: 3, onnotice: () => {} });
try {
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(731904)`;
    await tx.unsafe(await readFile(new URL('../database/phase3.sql', import.meta.url), 'utf8'));
    await tx.unsafe(await readFile(new URL('../database/phase4.sql', import.meta.url), 'utf8'));
  });
  let migrated = 0;
  const rejected = [];
  for (const table of ['teaching_files', 'academy_images']) {
    const files = await sql`SELECT id, name, mime, bytes FROM ${sql(table)} WHERE object_id IS NULL ORDER BY id`;
    for (const file of files) {
      try {
        const processed = await verifyUpload({ ...file, size: file.bytes.length, data: `data:${file.mime};base64,${file.bytes.toString('base64')}` }, 524288);
        const objectId = await stagePrivateFile(sql, processed);
        const [object] = await sql`SELECT * FROM portal_file_objects WHERE id = ${objectId}`;
        await readPrivateFile(object);
        const changed = await sql`UPDATE ${sql(table)} SET object_id = ${objectId}, bytes = NULL, name = ${processed.name}, mime = ${processed.mime} ${table === 'teaching_files' ? sql`, size = ${processed.bytes.length}` : sql``} WHERE id = ${file.id} AND object_id IS NULL AND bytes = ${file.bytes} RETURNING id`;
        migrated += changed.length;
      } catch { rejected.push({ table, id: file.id }); }
    }
  }
  const cleaned = await cleanupPrivateFiles(sql);
  console.log(JSON.stringify({ migrated, rejected, cleaned }));
  if (rejected.length) { console.error('Unverified legacy files were retained in the database and will not be served. Replace them with valid uploads.'); process.exitCode = 1; }
} finally { await sql.end(); }
