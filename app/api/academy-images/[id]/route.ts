import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { readPrivateFile } from '@/lib/private-files.mjs';
import { verifyUpload } from '@/lib/upload-validation.mjs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await getSession())) return new Response('Unauthorized', { status: 401 });
    const { id } = await params;
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) return new Response('Not found', { status: 404 });
    const [image] = await db()`SELECT f.name, f.mime, f.bytes, f.object_id, o.pathname, o.provider, o.ready, o.size, o.sha256 FROM academy_images f LEFT JOIN portal_file_objects o ON o.id = f.object_id WHERE f.id = ${id}`;
    if (!image) return new Response('Not found', { status: 404 });
    const name = String(image.name).replace(/[^a-z0-9._-]/gi, '_').slice(0, 180) || 'image.webp';
    const bytes = image.object_id ? await readPrivateFile(image) : (await verifyUpload({ ...image, size: image.bytes.length, data: `data:image/webp;base64,${image.bytes.toString('base64')}` }, 524288)).bytes;
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `inline; filename="${name}"`,
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Content-Type': 'image/webp',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Image unavailable', { status: 503 });
  }
}
