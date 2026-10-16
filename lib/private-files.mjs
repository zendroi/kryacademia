import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { put, get, del } from '@vercel/blob';

function localPath(pathname) {
  const root = process.env.PORTAL_LOCAL_FILE_DIR;
  if (process.env.VERCEL === '1' || !root || !isAbsolute(root) || !/^portal\/[a-f0-9-]{36}$/.test(pathname)) throw new Error('Private local storage is unavailable.');
  return join(root, pathname);
}

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function stagePrivateFile(sql, file) {
  const id = randomUUID();
  const pathname = `portal/${id}`;
  const provider = process.env.PORTAL_LOCAL_FILE_DIR ? 'local' : 'blob';
  if (provider === 'local') localPath(pathname);
  else if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) throw new Error('Private file storage is not configured. Contact admin.');
  // Reserve before uploading so a failed transaction or process can be cleaned up later.
  await sql`INSERT INTO portal_file_objects (id, pathname, provider, size, sha256) VALUES (${id}, ${pathname}, ${provider}, ${file.bytes.length}, ${hash(file.bytes)})`;
  if (provider === 'local') {
    const path = localPath(pathname);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, file.bytes, { flag: 'wx', mode: 0o600 });
  } else await put(pathname, file.bytes, { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: file.mime });
  await sql`UPDATE portal_file_objects SET ready = TRUE WHERE id = ${id}`;
  return id;
}

export async function readPrivateFile(file) {
  if (!file.ready || !/^portal\/[a-f0-9-]{36}$/.test(file.pathname)) throw new Error('File is not ready.');
  let bytes;
  if (file.provider === 'local') bytes = await readFile(localPath(file.pathname));
  else {
    const result = await get(file.pathname, { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200 || result.blob.size !== file.size) throw new Error('Private file is unavailable.');
    bytes = Buffer.from(await new Response(result.stream).arrayBuffer());
  }
  if (bytes.length !== file.size || hash(bytes) !== file.sha256) throw new Error('Private file integrity check failed.');
  return bytes;
}

export async function cleanupPrivateFiles(sql) {
  let deleted = 0;
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(731904)`;
    const objects = await tx`SELECT * FROM portal_file_objects o WHERE created_at < NOW() - INTERVAL '24 hours'
      AND NOT EXISTS (SELECT 1 FROM teaching_files f WHERE f.object_id = o.id)
      AND NOT EXISTS (SELECT 1 FROM academy_images f WHERE f.object_id = o.id)
      ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED`;
    for (const object of objects) {
      if (object.provider === 'local') await unlink(localPath(object.pathname)).catch((error) => { if (error.code !== 'ENOENT') throw error; });
      else await del(object.pathname);
      await tx`DELETE FROM portal_file_objects WHERE id = ${object.id}`;
      deleted++;
    }
  });
  return deleted;
}
