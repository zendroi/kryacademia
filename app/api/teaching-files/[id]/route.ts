import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response('Unauthorized', { status: 401 });
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return new Response('Not found', { status: 404 });
  try {
    const [file] = await db()`SELECT f.bytes, f.mime, f.name FROM teaching_files f JOIN teaching_records r ON r.id = f.record_id WHERE f.id = ${id} AND (r.teacher_email = ${session.email} OR ${session.role === 'admin'})`;
    if (!file) return new Response('Not found', { status: 404 });
    return new Response(new Uint8Array(file.bytes), { headers: {
      'Content-Type': file.mime,
      'Content-Disposition': `${file.mime === 'application/pdf' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch { return new Response('File temporarily unavailable', { status: 503 }); }
}
