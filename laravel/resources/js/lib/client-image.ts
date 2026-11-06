'use client';

export type CompressedImage = {
  id: string;
  name: string;
  mime: 'image/webp';
  size: number;
  data: string;
};

export function readFileDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

export async function compressImage(file: File): Promise<CompressedImage> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10485760) throw new Error('Use a JPEG, PNG, or WebP image up to 10 MB.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('This file is not a valid JPEG, PNG, or WebP image.');
  }
  try {
    if (bitmap.width * bitmap.height > 40000000) throw new Error('Image resolution is too large. Use an image under 40 megapixels.');
    for (const max of [1440, 1080, 800]) {
      const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image compression is unavailable in this browser.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', max === 1440 ? 0.78 : 0.58));
      if (blob?.type === 'image/webp' && blob.size <= 184320) {
        return { id: crypto.randomUUID(), name: `${file.name.replace(/\.[^.]+$/, '').slice(0, 130) || 'image'}.webp`, mime: 'image/webp', size: blob.size, data: await readFileDataUrl(blob) };
      }
    }
    throw new Error('This image is too detailed to compress. Please choose a smaller image.');
  } finally {
    bitmap.close();
  }
}
