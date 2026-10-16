import { parentPort, workerData } from 'node:worker_threads';
import { PDFDocument, PDFDict, PDFArray, PDFStream, PDFName } from 'pdf-lib';

(async () => {
  const doc = await PDFDocument.load(workerData.bytes, { ignoreEncryption: false, throwOnInvalidObject: true, updateMetadata: false });
  if (doc.isEncrypted || doc.getPageCount() < 1 || doc.getPageCount() > 200) throw new Error('Unsupported PDF.');
  const objects = doc.context.enumerateIndirectObjects();
  if (objects.length > 10000) throw new Error('PDF is too complex.');
  const blocked = new Set(['A', 'AA', 'OpenAction', 'JS', 'JavaScript', 'EmbeddedFiles', 'EF', 'AF', 'AcroForm', 'XFA', 'RichMediaContent', 'RichMediaSettings', 'Collection']);
  const actions = new Set(['JavaScript', 'Launch', 'URI', 'GoToR', 'GoToE', 'SubmitForm', 'ImportData', 'Rendition', 'Movie', 'Sound']);
  let visited = 0;
  function inspect(value, depth = 0) {
    if (++visited > 100000 || depth > 64) throw new Error('PDF is too complex.');
    if (value instanceof PDFStream) inspect(value.dict, depth + 1);
    else if (value instanceof PDFDict) for (const [key, child] of value.entries()) {
      if (blocked.has(key.decodeText()) || (child instanceof PDFName && (actions.has(child.decodeText()) || ['EmbeddedFile', 'Filespec', 'RichMedia', '3D'].includes(child.decodeText())))) throw new Error('PDF contains interactive or embedded content. Export a plain PDF.');
      inspect(child, depth + 1);
    }
    else if (value instanceof PDFArray) for (const child of value.asArray()) inspect(child, depth + 1);
  }
  for (const [, object] of objects) inspect(object);
  doc.setTitle(''); doc.setAuthor(''); doc.setSubject(''); doc.setKeywords([]);
  doc.setCreator('KRYAcademia'); doc.setProducer('KRYAcademia');
  parentPort.postMessage({ bytes: await doc.save({ useObjectStreams: false }) });
})().catch(() => parentPort.postMessage({ error: 'The PDF could not be verified. Export a plain, unencrypted PDF without scripts, forms, links, or embedded files.' }));
