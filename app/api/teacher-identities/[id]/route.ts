import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { readPrivateFile } from '@/lib/private-files.mjs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return new Response('Not found', { status: 404 });
  try {
    const session = await getSession();
    if (!session) return new Response('Unauthorized', { status: 401 });
    if (session.role !== 'admin') return new Response('Not found', { status: 404 });
    const [file] = await db()`SELECT o.* FROM teacher_onboarding t JOIN portal_file_objects o ON o.id = t.identity_object_id WHERE o.id = ${id}`;
    if (!file) return new Response('Not found', { status: 404 });
    const bytes = await readPrivateFile(file);
    return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/webp', 'Content-Disposition': 'inline; filename="identity.webp"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
  } catch { return new Response('File temporarily unavailable', { status: 503 }); }
}
