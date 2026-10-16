import { spawn } from 'node:child_process';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { rootCertificates } from 'node:tls';
import { readPrivateFile } from '../lib/private-files.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
function key() {
  if (!/^[a-f0-9]{64}$/i.test(process.env.BACKUP_KEY || '')) throw new Error('BACKUP_KEY must contain 32 random bytes encoded as 64 hex characters. Keep it separately from backups.');
  return Buffer.from(process.env.BACKUP_KEY, 'hex');
}
function encrypt(bytes) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]);
}
function decrypt(bytes) {
  if (bytes.length < 28) throw new Error('Invalid encrypted backup.');
  const cipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12)); cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]);
}
function client(url) { return postgres(url.href, { ssl: ['localhost', '127.0.0.1'].includes(url.hostname) ? false : 'verify-full', max: 1, onnotice: () => {} }); }
function directUrl() {
  const url = new URL(process.env.DATABASE_URL);
  if (url.hostname.endsWith('.neon.tech')) url.hostname = url.hostname.replace('-pooler.', '.');
  return url;
}
function pg(tool, args, url, caFile) {
  const executable = process.env.PG_BIN ? join(process.env.PG_BIN, `${tool}${process.platform === 'win32' ? '.exe' : ''}`) : tool;
  return new Promise((accept, reject) => {
    const child = spawn(executable, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env,
      PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
      PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
      PGSSLMODE: ['localhost', '127.0.0.1'].includes(url.hostname) ? 'disable' : 'verify-full',
      PGSSLROOTCERT: process.env.PGSSLROOTCERT || caFile,
      PGOPTIONS: url.searchParams.get('options') || '',
    } });
    let errors = ''; child.stderr.on('data', (data) => { errors = (errors + data).slice(-3000); });
    child.once('error', () => reject(new Error(`${tool} is unavailable. Set PG_BIN to a trusted PostgreSQL client installation.`)));
    child.once('exit', (code) => code === 0 ? accept() : reject(new Error(`${tool} failed (${code}): ${errors}`)));
  });
}
async function hashes(sql, schema) {
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = ${schema} AND table_type = 'BASE TABLE' ORDER BY table_name`;
  const result = {};
  for (const { table_name: name } of tables) {
    const [state] = await sql`SELECT count(*)::int AS count, md5(COALESCE(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text)), '')) AS hash FROM ${sql(schema)}.${sql(name)} t`;
    result[name] = state;
  }
  return result;
}

export async function backup(directory) {
  key(); const url = directUrl(); const sql = client(url);
  const output = resolve(directory); await mkdir(output, { recursive: false, mode: 0o700 });
  const temp = await mkdtemp(join(output, '.staging-'));
  let complete = false;
  try {
    await writeFile(join(temp, 'roots.pem'), rootCertificates.join('\n'), { mode: 0o600 });
    // The single-connection session holds cleanup off before the snapshot starts, until sql.end().
    await sql`SELECT pg_advisory_lock_shared(731904)`;
    const manifest = await sql.begin(async (tx) => {
      await tx`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`;
      await tx`SET LOCAL TIME ZONE 'UTC'`;
      const [{ schema, snapshot }] = await tx`SELECT current_schema() AS schema, pg_export_snapshot() AS snapshot`;
      await pg('pg_dump', ['--format=custom', '--no-owner', '--no-acl', `--schema=${schema}`, `--snapshot=${snapshot}`, `--file=${join(temp, 'database.dump')}`], url, join(temp, 'roots.pem'));
      // shortcut: pilot dumps fit in memory; stream encryption before backing up large production databases.
      const dump = await readFile(join(temp, 'database.dump'));
      await writeFile(join(output, 'database.enc'), encrypt(dump), { flag: 'wx', mode: 0o600 });
      const [{ exists }] = await tx`SELECT to_regclass(${`${schema}.portal_file_objects`}) IS NOT NULL AS exists`;
      const objects = exists ? await tx`SELECT o.* FROM portal_file_objects o WHERE EXISTS (SELECT 1 FROM teaching_files f WHERE f.object_id = o.id) OR EXISTS (SELECT 1 FROM academy_images f WHERE f.object_id = o.id) ORDER BY o.id` : [];
      for (const object of objects) await writeFile(join(output, `${object.id}.enc`), encrypt(await readPrivateFile(object)), { flag: 'wx', mode: 0o600 });
      return { version: 1, schema, createdAt: new Date().toISOString(), dumpSha256: digest(dump), tables: await hashes(tx, schema), objects: objects.map(({ id, pathname, size, sha256 }) => ({ id, pathname, size, sha256 })) };
    });
    await writeFile(join(output, 'manifest.enc'), encrypt(Buffer.from(JSON.stringify(manifest))), { flag: 'wx', mode: 0o600 });
    complete = true;
    return { directory: output, tables: Object.keys(manifest.tables).length, files: manifest.objects.length };
  } finally { await sql.end(); await rm(temp, { recursive: true, force: true }); if (!complete) await rm(output, { recursive: true, force: true }); }
}

export async function restoreCheck(directory) {
  const source = resolve(directory);
  const manifest = JSON.parse(decrypt(await readFile(join(source, 'manifest.enc'))).toString());
  if (manifest.version !== 1 || !/^[a-z_][a-z0-9_]*$/i.test(manifest.schema) || !Array.isArray(manifest.objects)) throw new Error('Unsupported backup manifest.');
  const dump = decrypt(await readFile(join(source, 'database.enc')));
  if (digest(dump) !== manifest.dumpSha256) throw new Error('Database backup integrity failed.');
  const temp = await mkdtemp(join(source, '.restore-'));
  const url = directUrl(); const admin = client(url);
  const database = `krya_restore_${randomUUID().replaceAll('-', '')}`;
  const targetUrl = new URL(url); targetUrl.pathname = `/${database}`;
  let target; let created = false;
  try {
    await writeFile(join(temp, 'roots.pem'), rootCertificates.join('\n'), { mode: 0o600 });
    await writeFile(join(temp, 'database.dump'), dump, { mode: 0o600 });
    for (const object of manifest.objects) {
      if (!/^[a-f0-9-]{36}$/i.test(object.id) || !/^portal\/[a-f0-9-]{36}$/i.test(object.pathname)) throw new Error('Invalid backup file path.');
      const bytes = decrypt(await readFile(join(source, `${object.id}.enc`)));
      if (bytes.length !== object.size || digest(bytes) !== object.sha256) throw new Error('Attachment backup integrity failed.');
      await mkdir(join(temp, 'portal'), { recursive: true });
      await writeFile(join(temp, object.pathname), bytes, { mode: 0o600 });
    }
    await admin`CREATE DATABASE ${admin(database)}`; created = true;
    target = client(targetUrl);
    if ((await target`SELECT current_database() AS name`)[0].name !== database) throw new Error('Restore database isolation failed.');
    if (manifest.schema === 'public') await target`DROP SCHEMA public CASCADE`;
    await pg('pg_restore', ['--dbname', database, '--no-owner', '--no-acl', '--single-transaction', '--exit-on-error', join(temp, 'database.dump')], targetUrl, join(temp, 'roots.pem'));
    await target`CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public`;
    const [crypto] = await target`SELECT crypt('restore-check', gen_salt('bf', 4)) AS hash`;
    if (!crypto.hash?.startsWith('$2')) throw new Error('Restored password verification functions are unavailable.');
    const restored = await target.begin(async (tx) => { await tx`SET LOCAL TIME ZONE 'UTC'`; return hashes(tx, manifest.schema); });
    if (JSON.stringify(restored) !== JSON.stringify(manifest.tables)) throw new Error('Restored database counts or hashes differ from the backup.');
    // Verify restored attachments without relying on the original cloud objects.
    const previous = process.env.PORTAL_LOCAL_FILE_DIR; process.env.PORTAL_LOCAL_FILE_DIR = temp;
    try { for (const object of manifest.objects) await readPrivateFile({ ...object, ready: true, provider: 'local' }); }
    finally { if (previous === undefined) delete process.env.PORTAL_LOCAL_FILE_DIR; else process.env.PORTAL_LOCAL_FILE_DIR = previous; }
    return { verified: true, tables: Object.keys(restored).length, files: manifest.objects.length };
  } finally {
    if (target) await target.end();
    if (created) await admin`DROP DATABASE ${admin(database)}`;
    await admin.end(); await rm(temp, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, directory] = process.argv.slice(2);
  if (!directory || !['create', 'check'].includes(command)) throw new Error('Usage: node scripts/backup.mjs create|check <backup-directory>');
  console.log(JSON.stringify(await (command === 'create' ? backup(directory) : restoreCheck(directory))));
}
