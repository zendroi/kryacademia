import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { mysqlPool, inspectMySQL, mysqlJSONColumns } from '../lib/mysql-connection.mjs';
import { readPrivateFile, privateFileDirectory } from '../lib/private-files.mjs';
import { prepareMySQLRuntime } from './mysql-runtime.mjs';

const ddl = await readFile(new URL('../database/mysql.sql', import.meta.url), 'utf8');
export const tables = [...ddl.matchAll(/CREATE TABLE ([a-z_]+) \(/g)].map((match) => match[1]);
const identifier = (name) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error('Invalid database identifier.');
  return `\`${name}\``;
};
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const inside = (root, path) => { const part = relative(root, path); return part === '' || (!part.startsWith(`..${sep}`) && part !== '..' && !isAbsolute(part)); };
function privateDirectory(directory) {
  if (!directory || !isAbsolute(directory)) throw new Error('Use an absolute private directory path.');
  const path = resolve(directory);
  if (inside(resolve('public'), path) || inside(resolve('.next'), path)) throw new Error('Migration files must stay outside public/ and .next/.');
  return path;
}
function key() {
  if (!/^[a-f0-9]{64}$/i.test(process.env.BACKUP_KEY || '')) throw new Error('BACKUP_KEY must be 32 random bytes encoded as 64 hex characters.');
  return Buffer.from(process.env.BACKUP_KEY, 'hex');
}
function encrypt(bytes) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}
async function decryptFile(path, limit) {
  if ((await stat(path)).size > limit + 28) throw new Error('Migration file exceeds the supported size.');
  const bytes = await readFile(path);
  if (bytes.length < 28) throw new Error('Invalid encrypted migration file.');
  const cipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12)); cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]);
}

export async function exportHostinger(directory) {
  key(); const output = privateDirectory(directory);
  const url = new URL(process.env.DATABASE_URL);
  if (url.protocol === 'mysql:') return exportMySQL(directory);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL must point to the source PostgreSQL database.');
  if (url.hostname.endsWith('.neon.tech')) url.hostname = url.hostname.replace('-pooler.', '.');
  const sql = postgres(url.href, { max: 1, ssl: ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? false : 'verify-full' });
  await mkdir(output, { recursive: false, mode: 0o700 });
  try {
    // Coordinate with existing cleanup/backup. Keep this session until file copies finish.
    await sql`SELECT pg_advisory_lock_shared(731904)`;
    const manifest = await sql.begin(async (tx) => {
      await tx`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`;
      await tx`SET LOCAL TIME ZONE 'UTC'`;
      const [{ schema }] = await tx`SELECT current_schema() AS schema`;
      const names = await tx`SELECT table_name FROM information_schema.tables WHERE table_schema = ${schema} AND table_type = 'BASE TABLE' ORDER BY table_name`;
      if (JSON.stringify(names.map((item) => item.table_name)) !== JSON.stringify([...tables].sort())) throw new Error('Source tables differ from the supported schema. Review schema changes before exporting.');
      const data = {};
      for (const table of tables) {
        const columns = await tx`SELECT column_name AS name, udt_name AS type FROM information_schema.columns WHERE table_schema = ${schema} AND table_name = ${table} ORDER BY ordinal_position`;
        for (const column of columns) if (!['text', 'varchar', 'uuid', 'int4', 'int8', 'numeric', 'bool', 'date', 'time', 'timestamptz', 'jsonb', 'bytea'].includes(column.type)) throw new Error(`Unsupported source type: ${table}.${column.name}`);
        // Text preserves bigint IDs, timestamp microseconds and bytea without JS coercion.
        const select = columns.map((column) => { identifier(column.name); return `"${column.name}"::text AS "${column.name}"`; }).join(',');
        const rows = await tx.unsafe(`SELECT ${select} FROM "${schema.replaceAll('"', '""')}"."${table}"`);
        const payload = Buffer.from(JSON.stringify({ columns, rows }));
        // shortcut: one table is held in memory; use a streaming migration above 128 MiB/table.
        if (payload.length > 128 * 1024 * 1024) throw new Error(`Table ${table} exceeds the migration memory limit.`);
        await writeFile(join(output, `${table}.enc`), encrypt(payload), { flag: 'wx', mode: 0o600 });
        data[table] = { count: rows.length, sha256: digest(payload) };
      }
      const objects = await tx`SELECT * FROM portal_file_objects ORDER BY id`;
      const files = [];
      for (const object of objects) {
        const [{ referenced }] = await tx`SELECT EXISTS (SELECT 1 FROM teaching_files WHERE object_id = ${object.id}) OR EXISTS (SELECT 1 FROM academy_images WHERE object_id = ${object.id}) OR EXISTS (SELECT 1 FROM teacher_onboarding WHERE identity_object_id = ${object.id}) AS referenced`;
        if (!object.ready) { if (referenced) throw new Error('A referenced private file is not ready.'); continue; }
        const bytes = await readPrivateFile(object);
        await writeFile(join(output, `${object.id}.enc`), encrypt(bytes), { flag: 'wx', mode: 0o600 });
        files.push({ id: object.id, pathname: object.pathname, size: object.size, sha256: object.sha256 });
      }
      return { version: 1, createdAt: new Date().toISOString(), schema, ddlHash: digest(ddl), tables: data, files };
    });
    // A manifest is written last; an interrupted directory cannot be imported.
    await writeFile(join(output, 'manifest.enc'), encrypt(Buffer.from(JSON.stringify(manifest))), { flag: 'wx', mode: 0o600 });
    return { directory: output, tables: tables.length, rows: Object.values(manifest.tables).reduce((sum, item) => sum + item.count, 0), files: manifest.files.length };
  } finally { await sql.end(); }
}

async function exportMySQL(directory) {
  const output = privateDirectory(directory); key();
  const pool = mysqlPool(process.env.DATABASE_URL); const connection = await pool.getConnection();
  try {
    await mkdir(output, { recursive: false, mode: 0o700 });
    await inspectMySQL(connection);
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ'); await connection.beginTransaction();
    try {
      const fileLock = digest('private-files');
      await connection.execute('INSERT INTO portal_locks (id) VALUES (?) ON DUPLICATE KEY UPDATE id=id', [fileLock]);
      await connection.execute('SELECT id FROM portal_locks WHERE id=? FOR UPDATE', [fileLock]);
      const [names] = await connection.query("SHOW FULL TABLES WHERE Table_type='BASE TABLE'");
      const actual = names.map((row) => Object.values(row)[0]).filter((name) => name !== 'portal_locks').sort();
      if (JSON.stringify(actual) !== JSON.stringify([...tables].sort())) throw new Error('Unknown tables in MySQL. Review before backup.');
      const data = {};
      for (const table of tables) {
        const [metadata] = await connection.query(`SHOW COLUMNS FROM ${identifier(table)}`);
        const columns = metadata.map((column) => {
          const type = column.Type.toLowerCase();
          const mapped = mysqlJSONColumns.has(column.Field) ? 'jsonb' : type.startsWith('tinyint(1)') ? 'bool' : type.startsWith('bigint') ? 'int8' : type.startsWith('int') ? 'int4' : type.startsWith('decimal') ? 'numeric' : type.startsWith('datetime') ? 'timestamptz' : type === 'date' ? 'date' : type.startsWith('time') ? 'time' : type === 'json' ? 'jsonb' : type.includes('blob') ? 'bytea' : type.startsWith('char(36)') ? 'uuid' : /text|varchar|char/.test(type) ? 'text' : null;
          if (!mapped) throw new Error(`Unsupported MySQL type: ${table}.${column.Field}`);
          return { name: column.Field, type: mapped };
        });
        const select = columns.map(({ name, type }) => `${type === 'bytea' ? `CAST(CONCAT(CHAR(92), 'x', LOWER(HEX(${identifier(name)}))) AS CHAR CHARACTER SET utf8mb4)` : type === 'bool' ? `CASE WHEN ${identifier(name)} IS NULL THEN NULL WHEN ${identifier(name)} THEN 'true' ELSE 'false' END` : `CAST(${identifier(name)} AS CHAR)`} AS ${identifier(name)}`).join(',');
        const [rows] = await connection.query(`SELECT ${select} FROM ${identifier(table)}`);
        const payload = Buffer.from(JSON.stringify({ columns, rows }));
        if (payload.length > 128 * 1024 * 1024) throw new Error('Table exceeds the migration memory limit.');
        await writeFile(join(output, `${table}.enc`), encrypt(payload), { flag: 'wx', mode: 0o600 });
        data[table] = { count: rows.length, sha256: digest(payload) };
      }
      const [objects] = await connection.query('SELECT * FROM portal_file_objects ORDER BY id'); const files = [];
      for (const object of objects) {
        const [[{ referenced }]] = await connection.execute('SELECT EXISTS(SELECT 1 FROM teaching_files WHERE object_id=?) OR EXISTS(SELECT 1 FROM academy_images WHERE object_id=?) OR EXISTS(SELECT 1 FROM teacher_onboarding WHERE identity_object_id=?) AS referenced', [object.id, object.id, object.id]);
        if (!object.ready) { if (referenced) throw new Error('Referenced file is not ready.'); continue; }
        const bytes = await readPrivateFile(object);
        await writeFile(join(output, `${object.id}.enc`), encrypt(bytes), { flag: 'wx', mode: 0o600 });
        files.push({ id: object.id, pathname: object.pathname, size: object.size, sha256: object.sha256 });
      }
      const manifest = { version: 1, source: 'mysql', createdAt: new Date().toISOString(), ddlHash: digest(ddl), tables: data, files };
      await connection.commit();
      await writeFile(join(output, 'manifest.enc'), encrypt(Buffer.from(JSON.stringify(manifest))), { flag: 'wx', mode: 0o600 });
      return { directory: output, tables: tables.length, rows: Object.values(data).reduce((sum, item) => sum + item.count, 0), files: files.length };
    } catch (error) { await connection.rollback(); throw error; }
  } finally { connection.release(); await pool.end(); }
}

export async function loadHostingerExport(directory) {
  const root = privateDirectory(directory);
  const manifest = JSON.parse((await decryptFile(join(root, 'manifest.enc'), 4 * 1024 * 1024)).toString());
  if (manifest.version !== 1 || manifest.ddlHash !== digest(ddl) || JSON.stringify(Object.keys(manifest.tables)) !== JSON.stringify(tables) || !Array.isArray(manifest.files)) throw new Error('Migration export version/schema mismatch.');
  const data = {};
  let totalBytes = 0;
  for (const table of tables) {
    const bytes = await decryptFile(join(root, `${table}.enc`), 128 * 1024 * 1024);
    totalBytes += bytes.length;
    if (totalBytes > 256 * 1024 * 1024) throw new Error('Migration exceeds the 256 MiB in-memory limit; use a streaming migration.');
    if (digest(bytes) !== manifest.tables[table].sha256) throw new Error(`Integrity check failed: ${table}.`);
    data[table] = JSON.parse(bytes.toString());
    if (data[table].rows.length !== manifest.tables[table].count) throw new Error(`Row count mismatch: ${table}.`);
  }
  const ids = new Set();
  for (const file of manifest.files) {
    if (!/^[a-f0-9-]{36}$/.test(file.id) || file.pathname !== `portal/${file.id}` || ids.has(file.id)) throw new Error('Invalid or duplicate private file path.');
    ids.add(file.id);
    const bytes = await decryptFile(join(root, `${file.id}.enc`), 1048576);
    if (bytes.length !== file.size || digest(bytes) !== file.sha256) throw new Error('Private file integrity check failed.');
  }
  return { root, manifest, data };
}

export async function prepareHostinger(connection) {
  await inspectMySQL(connection);
  const [existing] = await connection.query('SHOW TABLES');
  if (existing.length) throw new Error('Schema preparation requires an empty dedicated database. No existing tables were changed.');
  // These are repository-owned statements, never SQL received from an uploaded file.
  for (const statement of ddl.replace(/^--.*$/gm, '').split(';').map((item) => item.trim()).filter(Boolean)) await connection.query(statement);
  return { tables: tables.length };
}

function stable(value) {
  if (typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value)) throw new Error('JSON contains an integer outside the safe verification range.');
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
function normalize(value, type) {
  if (value === null) return null;
  if (type === 'jsonb') return JSON.stringify(stable(typeof value === 'string' ? JSON.parse(value) : value));
  if (type === 'bool') return value === 'true' || value === true || value === 1 || value === '1' ? 'true' : 'false';
  if (type === 'bytea') return Buffer.isBuffer(value) ? `\\x${value.toString('hex')}` : value;
  if (type === 'timestamptz') {
    const text = String(value).replace('T', ' ').replace(/(?:Z|\+00(?::00)?)$/, '');
    const [seconds, fraction = ''] = text.split('.');
    return `${seconds}.${fraction.padEnd(6, '0')}`;
  }
  if (type === 'numeric') return String(value).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return String(value);
}
function rowDigest(row, columns) {
  return digest(JSON.stringify(columns.map((column) => normalize(row[column.name], column.type))));
}

export async function importHostinger(connection, directory, fileDirectory, apply = false) {
  await inspectMySQL(connection);
  const { root, manifest, data } = await loadHostingerExport(directory);
  const output = privateFileDirectory(fileDirectory);
  const [names] = await connection.query('SHOW FULL TABLES WHERE Table_type = \'BASE TABLE\'');
  const actual = names.map((row) => Object.values(row)[0]).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...tables].sort())) throw new Error('Prepare an empty target with the expected schema first.');
  for (const table of tables) {
    const [[{ count }]] = await connection.query(`SELECT COUNT(*) AS count FROM ${identifier(table)}`);
    if (Number(count)) throw new Error(`Target is not empty: ${table}. Migration never overwrites existing data.`);
    const [columns] = await connection.query(`SHOW COLUMNS FROM ${identifier(table)}`);
    if (JSON.stringify(columns.map((column) => column.Field).sort()) !== JSON.stringify(data[table].columns.map((column) => column.name).sort())) throw new Error(`Column mismatch: ${table}.`);
  }
  const summary = { tables: tables.length, rows: Object.values(manifest.tables).reduce((sum, item) => sum + item.count, 0), files: manifest.files.length, applied: false };
  if (!apply) return summary;
  // Refuse existing paths. Failed imports leave a private staging directory for inspection.
  await mkdir(output, { recursive: false, mode: 0o700 });
  await mkdir(join(output, 'portal'), { mode: 0o700 });
  for (const file of manifest.files) {
    const bytes = await decryptFile(join(root, `${file.id}.enc`), 1048576);
    const path = join(output, file.pathname);
    await writeFile(path, bytes, { flag: 'wx', mode: 0o600 });
    if (digest(await readFile(path)) !== file.sha256) throw new Error('Destination file verification failed.');
  }
  await connection.beginTransaction();
  try {
    for (const table of tables) {
      const { columns, rows } = data[table];
      const statement = `INSERT INTO ${identifier(table)} (${columns.map((column) => identifier(column.name)).join(',')}) VALUES (${columns.map(() => '?').join(',')})`;
      for (const row of rows) {
        const values = columns.map(({ name, type }) => {
          const value = table === 'portal_file_objects' && name === 'provider' ? 'local' : row[name];
          if (value === null) return null;
          if (type === 'bytea') { if (!/^\\x(?:[a-f0-9]{2})*$/.test(value)) throw new Error('Invalid binary data.'); return Buffer.from(value.slice(2), 'hex'); }
          if (type === 'bool') return value === 'true' ? 1 : 0;
          if (type === 'timestamptz') return normalize(value, type);
          return value;
        });
        await connection.execute(statement, values);
      }
      const [restored] = await connection.query(`SELECT * FROM ${identifier(table)}`);
      const expected = rows.map((row) => rowDigest(table === 'portal_file_objects' ? { ...row, provider: 'local' } : row, columns)).sort();
      const received = restored.map((row) => rowDigest(row, columns)).sort();
      if (JSON.stringify(expected) !== JSON.stringify(received)) throw new Error(`Restored content mismatch: ${table}. Transaction rolled back.`);
    }
    await connection.commit();
    return { ...summary, applied: true, privateFileDirectory: output };
  } catch (error) { await connection.rollback(); throw error; }
}

export async function restoreMySQLCheck(directory) {
  if (!process.env.MYSQL_RESTORE_DATABASE_URL || !process.env.MYSQL_RESTORE_FILE_DIR) throw new Error('Set MYSQL_RESTORE_DATABASE_URL to a separate empty database and MYSQL_RESTORE_FILE_DIR to a new private directory.');
  const sourcePool = mysqlPool(process.env.DATABASE_URL); const targetPool = mysqlPool(process.env.MYSQL_RESTORE_DATABASE_URL);
  const connection = await targetPool.getConnection();
  let sourceConnection;
  try {
    sourceConnection = await sourcePool.getConnection();
    const identity = async (link) => {
      const { engine } = await inspectMySQL(link);
      return (await link.query(`SELECT ${engine === 'mariadb' ? '@@server_uid' : '@@server_uuid'} AS server, DATABASE() AS name`))[0][0];
    };
    const source = await identity(sourceConnection);
    const target = await identity(connection);
    if (source.server === target.server && source.name === target.name) throw new Error('Restore target must differ from the live database.');
    await loadHostingerExport(directory);
    await prepareHostinger(connection);
    const result = await importHostinger(connection, directory, process.env.MYSQL_RESTORE_FILE_DIR, true);
    await prepareMySQLRuntime(connection);
    return { ...result, verified: true, restoredDatabase: target.name };
  } finally { sourceConnection?.release(); connection.release(); await targetPool.end(); await sourcePool.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, directory, fileDirectory, flag] = process.argv.slice(2);
  if (command === 'export') console.log(JSON.stringify(await exportHostinger(directory)));
  else if (command === 'verify-export') { const { manifest } = await loadHostingerExport(directory); console.log(JSON.stringify({ verified: true, tables: tables.length, files: manifest.files.length })); }
  else if (['inspect', 'prepare', 'runtime', 'import'].includes(command)) {
    const pool = mysqlPool(); const connection = await pool.getConnection();
    try {
      if (command === 'inspect') console.log(JSON.stringify(await inspectMySQL(connection)));
      if (command === 'prepare') console.log(JSON.stringify(await prepareHostinger(connection)));
      if (command === 'runtime') console.log(JSON.stringify(await prepareMySQLRuntime(connection)));
      if (command === 'import') { if (flag && flag !== '--apply') throw new Error('Unknown option.'); console.log(JSON.stringify(await importHostinger(connection, directory, fileDirectory, flag === '--apply'))); }
    } finally { connection.release(); await pool.end(); }
  } else throw new Error('Usage: hostinger-data.mjs inspect|prepare|runtime|export <private-directory>|verify-export <directory>|import <directory> <new-private-file-directory> [--apply]');
}
