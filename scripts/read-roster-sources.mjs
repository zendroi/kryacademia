import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { companyCatalog } from './company-catalog.mjs';

const workbook = JSON.parse(execFileSync(process.env.PYTHON || 'python', [fileURLToPath(new URL('./read-company-workbook.py', import.meta.url)), resolve(process.argv[2])], { encoding: 'utf8', windowsHide: true, maxBuffer: 5_000_000 }));
const { rosterSources } = companyCatalog(workbook);
const directory = resolve('outputs/company-rosters', new Date().toISOString().replace(/[:.]/g, '-'));
await mkdir(directory, { recursive: true });
const results = [];
for (const source of rosterSources) {
  const id = new URL(source.url).pathname.split('/')[3];
  const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const final = new URL(response.url);
    if (final.hostname !== 'docs.google.com' && !final.hostname.endsWith('.googleusercontent.com')) {
      results.push({ ...source, status: response.status, accessible: false, reason: 'Google account login or access approval required' }); continue;
    }
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > 20_000_000) throw new Error('Roster exceeds 20 MB limit');
    const chunks = []; let size = 0;
    for await (const chunk of response.body) { size += chunk.length; if (size > 20_000_000) throw new Error('Roster exceeds 20 MB limit'); chunks.push(chunk); }
    const bytes = Buffer.concat(chunks);
    if (!response.ok || bytes.length < 4 || bytes.readUInt16LE(0) !== 0x4b50) {
      results.push({ ...source, status: response.status, accessible: false, reason: 'No readable workbook returned; access or export may be restricted' }); continue;
    }
    const file = resolve(directory, `${source.institutionId}.xlsx`);
    await writeFile(file, bytes, { mode: 0o600 });
    results.push({ ...source, status: response.status, accessible: true, file, bytes: bytes.length });
  } catch (error) { results.push({ ...source, accessible: false, reason: error.message }); }
}
await writeFile(resolve(directory, 'access.json'), JSON.stringify(results, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ directory, results: results.map(({ institutionId, status, accessible, reason, bytes }) => ({ institutionId, status, accessible, reason, bytes })) }, null, 2));
