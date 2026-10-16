import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { readPrivateFile } from '@/lib/private-files.mjs';
import { verifyUpload } from '@/lib/upload-validation.mjs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return new Response('Not found', { status: 404 });
  try {
    const session = await getSession();
    if (!session) return new Response('Unauthorized', { status: 401 });
    const [file] = await db()`SELECT f.bytes, f.mime, f.name, f.object_id, o.pathname, o.provider, o.ready, o.size, o.sha256 FROM teaching_files f JOIN teaching_records r ON r.id = f.record_id LEFT JOIN portal_file_objects o ON o.id = f.object_id WHERE f.id = ${id} AND (r.teacher_email = ${session.email} OR ${session.role === 'admin'})`;
    if (!file) return new Response('Not found', { status: 404 });
    const verified = file.object_id ? { bytes: await readPrivateFile(file), mime: file.mime, name: file.name } : await verifyUpload({ ...file, size: file.bytes.length, data: `data:${file.mime};base64,${file.bytes.toString('base64')}` }, 524288);
    return new Response(new Uint8Array(verified.bytes), { headers: {
      'Content-Type': verified.mime,
      'Content-Disposition': `${verified.mime === 'application/pdf' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(verified.name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    } });
  } catch { return new Response('File temporarily unavailable', { status: 503 }); }
}
