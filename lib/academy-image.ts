import 'server-only';
import { verifyUpload } from './upload-validation.mjs';

export async function processAcademyImage(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Choose a valid image file.');
  const upload = value as Record<string, unknown>;
  if (upload.mime !== 'image/webp' || typeof upload.name !== 'string' || !Number.isInteger(upload.size) || typeof upload.data !== 'string') throw new Error('Choose a valid JPEG, PNG, or WebP image.');
  return verifyUpload(upload);
}
