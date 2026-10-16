import assert from 'node:assert/strict';
import sharp from 'sharp';
import { PDFDocument, PDFName, PDFDict, PDFHexString } from 'pdf-lib';
import { verifyUpload } from '../lib/upload-validation.mjs';

const upload = (bytes, mime = 'application/pdf', name = 'document.pdf') => ({ name, mime, size: bytes.length, data: `data:${mime};base64,${Buffer.from(bytes).toString('base64')}` });
const pdf = await PDFDocument.create(); pdf.addPage();
const plain = await pdf.save();
const checked = await verifyUpload(upload(plain));
assert.equal((await PDFDocument.load(checked.bytes)).getPageCount(), 1);
await assert.rejects(verifyUpload(upload(Buffer.from('%PDF-1.4\n%%EOF'))), /could not be verified/);
await assert.rejects(verifyUpload(upload(Buffer.from('run a command'))), /format/);
await assert.rejects(verifyUpload({ ...upload(plain), size: plain.length + 1 }), /invalid/);
await assert.rejects(verifyUpload(upload(Buffer.alloc(1048577))), /size|large/);
for (const key of ['OpenAction', 'AA', 'JS', 'EmbeddedFiles', 'AcroForm']) {
  const active = await PDFDocument.create(); active.addPage();
  active.catalog.set(PDFName.of(key), active.context.obj({ S: 'JavaScript', JS: PDFHexString.fromText('do not execute this') }));
  await assert.rejects(verifyUpload(upload(await active.save())), /could not be verified/, `Reject ${key} inside compressed PDF objects`);
}
const escaped = await PDFDocument.create(); escaped.addPage();
const action = PDFDict.withContext(escaped.context);
action.set(PDFName.of('J#53'), PDFHexString.fromText('do not execute'));
escaped.context.register(action);
await assert.rejects(verifyUpload(upload(await escaped.save())), /could not be verified/, 'Escaped PDF names must be decoded');
for (const format of ['png', 'jpeg', 'webp']) {
  const image = await sharp({ create: { width: 1800, height: 900, channels: 3, background: '#e8001b' } }).toFormat(format).toBuffer();
  const result = await verifyUpload(upload(image, `image/${format}`, 'class.png'));
  const metadata = await sharp(result.bytes).metadata();
  assert.equal(metadata.format, 'webp'); assert.equal(metadata.width, 1440);
  assert.equal(metadata.exif, undefined, 'Image metadata must be stripped');
}
const disguised = Buffer.from('<svg><script>do not execute</script></svg>');
await assert.rejects(verifyUpload(upload(disguised, 'image/png')), /could not be verified/);
await assert.rejects(verifyUpload(upload(disguised, 'image/svg+xml')), /not supported/);
const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#fff' } }).png().toBuffer();
await assert.rejects(verifyUpload(upload(png, 'image/jpeg')), /could not be verified/);
await assert.rejects(verifyUpload(upload(png.subarray(0, 30), 'image/png')), /could not be verified/);
console.log('PDF structure/actions, escaped names, image re-encoding, false MIME, truncation and size checks passed.');
