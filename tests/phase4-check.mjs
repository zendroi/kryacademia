import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import postgres from 'postgres';
import { stagePrivateFile, readPrivateFile, cleanupPrivateFiles } from '../lib/private-files.mjs';
import { backup, restoreCheck } from '../scripts/backup.mjs';

if (!process.env.PORTAL_TEST_SCHEMA?.startsWith('security_check_') || new URL(process.env.DATABASE_URL).searchParams.get('options') !== `-c search_path=${process.env.PORTAL_TEST_SCHEMA},public`) throw new Error('Phase 4 checks require an isolated security test schema.');
const sql = postgres(process.env.DATABASE_URL, { ssl: process.env.DATABASE_URL.includes('localhost') ? false : 'verify-full', max: 2, onnotice: () => {} });
const imageId = randomUUID(); const folder = await mkdtemp(join(tmpdir(), 'krya-backup-test-'));
const activeUrl = process.env.DATABASE_URL;
const previousDirectUrl = process.env.DATABASE_URL_UNPOOLED;
const migrate = () => new Promise((accept, reject) => {
  const child = spawn(process.execPath, ['scripts/migrate-phase4.mjs'], { env: process.env, windowsHide: true, stdio: 'inherit' });
  child.once('error', reject); child.once('exit', (code) => code === 0 ? accept() : reject(new Error(`Migration failed: ${code}`)));
});
try {
  const bytes = await sharp({ create: { width: 80, height: 60, channels: 3, background: '#e8001b' } }).webp().toBuffer();
  await sql`INSERT INTO academy_images (id, name, mime, bytes) VALUES (${imageId}, 'legacy.webp', 'image/webp', ${bytes})`;
  await migrate();
  const [image] = await sql`SELECT f.id, f.bytes, f.object_id, o.* FROM academy_images f JOIN portal_file_objects o ON o.id = f.object_id WHERE f.id = ${imageId}`;
  assert.equal(image.bytes, null, 'Migrated files must leave database byte storage');
  assert.ok(image.ready); assert.equal(image.provider, 'local');
  const original = await readPrivateFile(image);
  assert.equal((await sharp(original).metadata()).format, 'webp');
  await migrate();
  assert.equal((await sql`SELECT object_id FROM academy_images WHERE id = ${imageId}`)[0].object_id, image.object_id, 'Migration must be idempotent');
  const path = join(process.env.PORTAL_LOCAL_FILE_DIR, image.pathname);
  await writeFile(path, Buffer.from('tampered'));
  await assert.rejects(readPrivateFile(image), /integrity/);
  await writeFile(path, original);
  const orphan = await stagePrivateFile(sql, { bytes, mime: 'image/webp' });
  await sql`UPDATE portal_file_objects SET created_at = NOW() - INTERVAL '2 days' WHERE id IN ${sql([orphan, image.object_id])}`;
  assert.ok(await cleanupPrivateFiles(sql) >= 1);
  assert.equal((await sql`SELECT id FROM portal_file_objects WHERE id = ${orphan}`).length, 0);
  assert.equal((await sql`SELECT id FROM portal_file_objects WHERE id = ${image.object_id}`).length, 1, 'Cleanup must preserve referenced files');
  process.env.DATABASE_URL_UNPOOLED = 'postgres://unused:unused@invalid.invalid/wrong_database';
  const directory = join(folder, 'snapshot');
  const saved = await backup(directory); assert.equal(saved.files, 1);
  const restored = await restoreCheck(directory); assert.equal(restored.verified, true); assert.equal(restored.files, 1);
  const encrypted = await readFile(join(directory, 'database.enc')); encrypted[30] ^= 1; await writeFile(join(directory, 'database.enc'), encrypted);
  await assert.rejects(restoreCheck(directory), /authenticate|authentication/i, 'Tampered backup must fail before database creation');
  const raceUrl = new URL(activeUrl);
  const application = `backup-race-${randomUUID()}`;
  raceUrl.searchParams.set('application_name', application);
  process.env.DATABASE_URL = raceUrl.href;
  const raceDirectory = join(folder, 'after-cleanup');
  let pendingBackup;
  try {
    await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(731904)`;
      pendingBackup = backup(raceDirectory); pendingBackup.catch(() => {});
      let waiting = false;
      for (let i = 0; i < 100; i++) {
        const rows = await sql`SELECT pid FROM pg_stat_activity WHERE application_name = ${application} AND wait_event = 'advisory'`;
        if (rows.length) { waiting = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert.ok(waiting, 'Backup must wait for cleanup before taking its snapshot');
      await tx`DELETE FROM academy_images WHERE id = ${imageId}`;
      await tx`DELETE FROM portal_file_objects WHERE id = ${image.object_id}`;
      await unlink(path);
    });
    assert.equal((await pendingBackup).files, 0, 'Backup must see the committed cleanup, not a snapshot with deleted files');
    assert.equal((await restoreCheck(raceDirectory)).files, 0);
  } finally { if (pendingBackup) await pendingBackup.catch(() => {}); }
  console.log('Phase 4 migration, private storage, integrity, safe cleanup, encrypted backup and isolated restore checks passed.');
} finally {
  process.env.DATABASE_URL = activeUrl;
  if (previousDirectUrl === undefined) delete process.env.DATABASE_URL_UNPOOLED;
  else process.env.DATABASE_URL_UNPOOLED = previousDirectUrl;
  await sql`DELETE FROM academy_images WHERE id = ${imageId}`;
  await sql.end(); await rm(folder, { recursive: true, force: true });
}
