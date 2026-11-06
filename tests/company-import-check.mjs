import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { chromium } from 'playwright';
import { core } from '../scripts/academic-modules.mjs';
import { fixtureSession } from './session-fixture.mjs';

const file = process.argv[2];
assert.ok(file && process.env.DATABASE_URL && process.env.SESSION_SECRET, 'Supply the source workbook, DATABASE_URL and SESSION_SECRET');
const schema = `company_check_${randomUUID().replaceAll('-', '')}`;
const url = new URL(process.env.DATABASE_URL);
if (url.hostname.endsWith('.neon.tech')) url.hostname = url.hostname.replace('-pooler.', '.');
const admin = postgres(url.href, { ssl: url.hostname === 'localhost' ? false : 'verify-full', max: 1, onnotice: () => {} });
url.searchParams.set('options', `-c search_path=${schema},public`);
const sql = postgres(url.href, { ssl: url.hostname === 'localhost' ? false : 'verify-full', max: 2, onnotice: () => {} });
const env = { ...process.env, DATABASE_URL: url.href };
const run = (script, args = []) => JSON.parse(execFileSync(process.execPath, [script, ...args], { env, encoding: 'utf8', windowsHide: true, timeout: 180000, maxBuffer: 2_000_000 }));
let server; let browser; let created = false; let output = '';
try {
  await admin`CREATE SCHEMA ${admin(schema)}`; created = true;
  await sql.begin(async (tx) => {
    await tx`SET LOCAL search_path TO ${tx(schema)}`;
    for (const name of ['init', 'teacher', 'academy', 'academic-core', 'inquiry', 'security', 'phase3', 'phase4', 'phase5', 'portal-revisions']) await tx.unsafe(await readFile(new URL(`../database/${name}.sql`, import.meta.url), 'utf8'));
  });
  assert.equal((await sql`SELECT current_schema() AS name`)[0].name, schema);
  await sql.begin(core.initializeAcademicCore);
  run('scripts/import-class-request-catalog.mjs', ['--apply']);
  const catalogBefore = await sql.begin(core.readAcademicCore);
  const eventCount = (await sql`SELECT count(*)::int AS count FROM academy_events`)[0].count;
  const preview = run('scripts/import-company-catalog.mjs', [file]);
  assert.equal(preview.applied, false); assert.equal(preview.groups, 25); assert.equal(preview.reportedStudents, 376);
  assert.deepEqual(await sql.begin(core.readAcademicCore), catalogBefore, 'Preview must not mutate the catalog');
  assert.equal((await sql`SELECT count(*)::int AS count FROM academy_events`)[0].count, eventCount);
  const applied = run('scripts/import-company-catalog.mjs', [file, '--apply']);
  assert.equal(applied.applied, true); assert.equal(applied.preservedCatalogHash, preview.preservedCatalogHash);
  const catalog = await sql.begin(core.readAcademicCore);
  assert.equal(catalog.students.length, catalogBefore.students.length, 'Headcounts must not create fake pupils');
  assert.equal(catalog.klasses.filter((item) => item.groupName?.startsWith('Grade')).length, 12);
  assert.equal(catalog.institutions.reduce((sum, item) => sum + (item.reportedStudents || 0), 0), 376);
  assert.equal(catalog.klasses.find((item) => item.id === 'request-cikal-primary-steamaker').plannedMeetings, 18);
  assert.ok(catalog.klasses.some((item) => item.institutionId === 'gloria-1'));
  assert.equal(catalog.klasses.find((item) => item.id === 'official-ciputra-kasih-digital-animation').schedule, '');
  assert.equal(run('scripts/import-company-catalog.mjs', [file, '--apply']).changes.length, 0, 'Repeat import must be idempotent');
  await sql`UPDATE class_groups SET reported_students = 42, revision = revision + 1 WHERE id = 'official-sma-dharma-mulya-technova-grade11a1'`;
  const repeat = run('scripts/import-company-catalog.mjs', [file, '--apply']);
  assert.ok(repeat.retainedEdits.some((item) => item.field === 'reportedStudents'));
  assert.equal((await sql`SELECT reported_students AS count FROM class_groups WHERE id = 'official-sma-dharma-mulya-technova-grade11a1'`)[0].count, 42, 'Admin edits must survive another import');
  assert.deepEqual(catalog.coaches.filter((item) => item.id.startsWith('official-coach-')).map((item) => item.portalEmail), Array(8).fill(''), 'Names alone must not grant portal access');
  console.log('Isolated company import, preservation, provenance and idempotence passed.');

  const listener = createServer(); await new Promise((done) => listener.listen(0, '127.0.0.1', done));
  const port = listener.address().port; await new Promise((done) => listener.close(done));
  const base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port), '--hostname', '127.0.0.1'], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', (data) => { output = (output + data).slice(-6000); }); server.stderr.on('data', (data) => { output = (output + data).slice(-6000); });
  let ready = false;
  for (let attempt = 0; attempt < 120 && server.exitCode === null; attempt++) {
    try { if ((await fetch(`${base}/login`, { signal: AbortSignal.timeout(3000) })).ok) { ready = true; break; } } catch { /* Starting. */ }
    await new Promise((done) => setTimeout(done, 500));
  }
  assert.ok(ready, output);
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
  await context.addCookies([{ name: 'krya_session', value: await fixtureSession(sql, 'admin@krya.global', 'admin'), url: base }]);
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  const directory = resolve('outputs/company-import-check'); await mkdir(directory, { recursive: true });
  for (const width of [1440, 390, 360]) {
    await page.setViewportSize({ width, height: 960 }); await page.goto(`${base}/admin`);
    await page.locator('.page-preloader').waitFor({ state: 'detached' });
    if (await page.getByRole('button', { name: 'Open navigation', exact: true }).isVisible()) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await page.getByRole('navigation', { name: 'Admin navigation' }).getByRole('button', { name: 'Klass', exact: true }).click();
    await page.getByLabel('Search current section').fill('Grade 11 A1');
    const card = page.locator('.admin-klass-card').filter({ hasText: 'Grade 11 A1' }); await card.click();
    await page.getByRole('dialog').getByRole('heading', { name: 'Technova / Grade 11 A1', exact: true }).waitFor();
    assert.equal(await page.getByText('15 planned semester meetings', { exact: true }).count(), 1);
    assert.equal(await page.getByText('42 reported students / 0 registered learners', { exact: true }).count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${width}px page overflow`);
    await page.screenshot({ path: resolve(directory, `group-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Edit Klass', exact: true }).click();
    assert.equal(await page.getByLabel('Group / grade', { exact: true }).inputValue(), 'Grade 11 A1');
    assert.equal(await page.getByLabel('Planned semester meetings', { exact: true }).inputValue(), '15');
    assert.equal(await page.getByLabel('Reported students', { exact: true }).inputValue(), '42');
    await page.screenshot({ path: resolve(directory, `edit-${width}.png`), fullPage: true });
  }
  await page.getByLabel('Reported students', { exact: true }).fill('-1');
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByRole('dialog').getByText('Check reportedStudents.', { exact: true }).waitFor();
  await page.getByLabel('Reported students', { exact: true }).fill('43');
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByText('43 reported students / 0 registered learners', { exact: true }).waitFor();
  const edited = (await sql.begin(core.readAcademicCore)).klasses.find((item) => item.id === 'official-sma-dharma-mulya-technova-grade11a1');
  assert.equal(edited.reportedStudents, 43); assert.equal(edited.plannedMeetings, 15); assert.equal(edited.groupName, 'Grade 11 A1');
  run('scripts/import-company-catalog.mjs', [file, '--apply']);
  assert.equal((await sql`SELECT reported_students AS count FROM class_groups WHERE id = 'official-sma-dharma-mulya-technova-grade11a1'`)[0].count, 43);
  assert.deepEqual(errors, []);
  console.log('Company class detail and editable metadata passed at 1440/390/360px.');
  const historyId = randomUUID();
  await sql`INSERT INTO teaching_records (id, teacher_email, kind, class_id, meeting_date, title, status) VALUES (${historyId}, 'teacher@krya.global', 'meeting', 'coding', '2026-10-01', 'Pilot history retained', 'Draft')`;
  const archivePreview = run('scripts/archive-pilot-catalog.mjs');
  assert.equal(archivePreview.applied, false); assert.equal(archivePreview.archive.klasses.length, 8);
  assert.equal((await sql`SELECT active FROM class_groups WHERE id = 'coding'`)[0].active, true);
  const archived = run('scripts/archive-pilot-catalog.mjs', ['--apply']);
  assert.equal(archived.archive.students.length, 6); assert.equal(archived.archive.coaches.length, 6);
  const active = await sql.begin(core.readAcademicCore);
  assert.equal(active.klasses.length, 25); assert.equal(active.institutions.length, 9); assert.equal(active.students.length, 0); assert.equal(active.coaches.length, 8);
  assert.equal(active.klasses.find((item) => item.id === 'official-ciputra-kasih-digital-animation').schedule, 'Monday, 15:00 - 16:00');
  assert.equal((await sql`SELECT count(*)::int AS count FROM teaching_records WHERE id = ${historyId}`)[0].count, 1);
  assert.equal((await sql`SELECT count(*)::int AS count FROM student_profiles WHERE NOT active`)[0].count, 6, 'Archival must retain records rather than delete them');
  const again = run('scripts/archive-pilot-catalog.mjs', ['--apply']);
  assert.ok(Object.values(again.archive).every((items) => items.length === 0)); assert.equal(again.ciputra.changed, false);
  assert.equal(run('scripts/import-company-catalog.mjs', [file, '--apply']).changes.length, 0, 'Reimport must not revive archived seeds or overwrite confirmed Ciputra hours');
  console.log('Known-pilot archival, history preservation and confirmed Ciputra schedule passed.');
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) { server.kill(); await new Promise((done) => { server.once('exit', done); setTimeout(done, 5000); }); }
  await sql.end();
  if (created) { assert.match(schema, /^company_check_[a-f0-9]{32}$/); await admin`DROP SCHEMA ${admin(schema)} CASCADE`; }
  await admin.end();
}
