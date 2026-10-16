import sharp from 'sharp';
import 'pdf-lib'; // Keep the bounded worker's parser and dependencies in the server deployment trace.
import { Worker } from 'node:worker_threads';
import { join } from 'node:path';

export async function verifyUpload(upload, imageLimit = 184320) {
  if (!upload || typeof upload.name !== 'string' || upload.name.length > 180 || typeof upload.data !== 'string' || !Number.isInteger(upload.size)) throw new Error('Choose a valid file.');
  const limit = upload.mime === 'application/pdf' ? 1048576 : imageLimit;
  if (upload.data.length > Math.ceil(limit / 3) * 4 + 100 || !['application/pdf', 'image/webp', 'image/png', 'image/jpeg'].includes(upload.mime)) throw new Error('The file format or size is not supported.');
  const match = /^data:([^;]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(upload.data);
  if (!match || match[1] !== upload.mime) throw new Error('Invalid file data.');
  const input = Buffer.from(match[2], 'base64');
  if (!input.length || input.length !== upload.size || input.length > limit) throw new Error('The file is invalid or too large.');
  const stem = upload.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'document';
  if (upload.mime === 'application/pdf') {
    if (input.toString('ascii', 0, 5) !== '%PDF-') throw new Error('The file contents do not match its format.');
    const bytes = await new Promise((resolve, reject) => {
      // Next adds build metadata to workerData, so keep the typed array nested.
      const worker = new Worker(join(process.cwd(), 'scripts/pdf-check.mjs'), { workerData: { bytes: input }, resourceLimits: { maxOldGenerationSizeMb: 96, stackSizeMb: 2 } });
      const timer = setTimeout(() => { void worker.terminate(); reject(new Error('The PDF took too long to verify.')); }, 8000);
      worker.once('message', (result) => { clearTimeout(timer); void worker.terminate(); if (result.error) reject(new Error(result.error)); else resolve(Buffer.from(result.bytes)); });
      worker.once('error', () => { clearTimeout(timer); reject(new Error('The PDF could not be verified.')); });
      worker.once('exit', (code) => { clearTimeout(timer); if (code !== 0) reject(new Error('The PDF could not be verified.')); });
    });
    if (bytes.length > 1048576) throw new Error('The verified PDF is too large. Use a smaller document.');
    return { name: `${stem}.pdf`, mime: 'application/pdf', bytes };
  }
  const matches = upload.mime === 'image/png' ? input.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' : upload.mime === 'image/jpeg' ? input[0] === 255 && input[1] === 216 && input[2] === 255 : input.toString('ascii', 0, 4) === 'RIFF' && input.toString('ascii', 8, 12) === 'WEBP';
  if (!matches) throw new Error('The image could not be verified. Its contents do not match its format.');
  try {
    const image = sharp(input, { failOn: 'warning', limitInputPixels: 40000000, sequentialRead: true });
    const metadata = await image.metadata();
    if (metadata.format !== ({ 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpeg' })[upload.mime] || (metadata.pages || 1) !== 1) throw new Error('Invalid image format.');
    const bytes = await image.rotate().resize({ width: 1440, height: 1440, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78, effort: 4 }).toBuffer();
    if (bytes.length > 524288) throw new Error('Processed image too large.');
    return { name: `${stem}.webp`, mime: 'image/webp', bytes };
  } catch { throw new Error('The image could not be verified. Choose another JPEG, PNG, or WebP image.'); }
}
