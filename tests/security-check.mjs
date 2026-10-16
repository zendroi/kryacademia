import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { randomUUID, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import postgres from 'postgres';
import { chromium } from 'playwright';
import { fixtureSession, signSession, readSession } from './session-fixture.mjs';
import { core, workflow, updateCatalog } from './academic-fixture.mjs';
import { PDFDocument } from 'pdf-lib';

if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET) throw new Error('DATABASE_URL and SESSION_SECRET are required.');
const originalUrl = process.env.DATABASE_URL;
const adminSql = postgres(originalUrl, { ssl: originalUrl.includes('localhost') ? false : 'require', max: 1, onnotice: () => {} });
const schema = `security_check_${randomUUID().replaceAll('-', '')}`;
const url = new URL(originalUrl);
// Direct connections preserve schema isolation across transactions.
if (url.hostname.endsWith('.neon.tech')) url.hostname = url.hostname.replace('-pooler.', '.');
url.searchParams.set('options', `-c search_path=${schema},public`);
const sql = postgres(url.href, { ssl: originalUrl.includes('localhost') ? false : 'require', max: 3, onnotice: () => {} });
const password = `Check-${randomUUID()}`;
const teacherEmail = `coach-${randomUUID()}@example.com`;
const otherEmail = `other-${randomUUID()}@example.com`;
const historicalId = randomUUID();
const photoId = randomUUID();
process.env.PORTAL_TEST_SCHEMA = schema;
let server;
let browser;
let created = false;
let output = '';
const fileDirectory = await mkdtemp(join(tmpdir(), 'krya-private-test-'));

function run(file, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file], { env, windowsHide: true, stdio: 'inherit' });
    child.once('error', reject); child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${file} exited ${code}\nServer output:\n${output}`)));
  });
}
async function freePort() {
  const listener = createServer(); await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port; await new Promise((resolve) => listener.close(resolve)); return port;
}

try {
  await adminSql`CREATE SCHEMA ${adminSql(schema)}`; created = true;
  await sql.begin(async (tx) => {
    await tx`SET LOCAL search_path TO ${tx(schema)}`;
    for (const file of ['init', 'teacher', 'academy', 'academic-core', 'inquiry', 'security', 'phase3', 'phase4', 'phase5']) await tx.unsafe(await readFile(new URL(`../database/${file}.sql`, import.meta.url), 'utf8'));
  });
  assert.equal((await sql`SELECT current_schema() AS name`)[0].name, schema, 'Tests must use their own schema');
  await sql.begin(core.initializeAcademicCore);
  console.log('Isolated security database ready.');
  await run('tests/teaching-save-check.mjs', process.env);
  await sql`UPDATE portal_users SET password_hash = crypt(${password}, gen_salt('bf', 12))`;
  const env = { ...process.env, VERCEL: '0', PORTAL_LOCAL_FILE_DIR: fileDirectory, BACKUP_KEY: randomBytes(32).toString('hex'), CRON_SECRET: randomBytes(32).toString('hex'), DATABASE_URL: url.href, ADMIN_TEST_PASSWORD: password, TEACHER_TEST_PASSWORD: password, PORTAL_TEST_SCHEMA: schema };
  const port = await freePort(); const base = `http://127.0.0.1:${port}`; env.BASE_URL = base;
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port), '--hostname', '127.0.0.1'], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', (data) => { output = (output + data).slice(-6000); }); server.stderr.on('data', (data) => { output = (output + data).slice(-6000); });
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw new Error(`Test server exited: ${output}`);
    try { if ((await fetch(`${base}/login`)).ok) { ready = true; break; } } catch { /* Server is starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'Test server did not start');
  browser = await chromium.launch();
  const errors = [];
  const screenshots = join(tmpdir(), 'kryacademia-security-check'); await mkdir(screenshots, { recursive: true });
  const applicant = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
  const page = await applicant.newPage(); page.on('pageerror', (error) => errors.push(error.message));
  page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(30000);
  let registration;
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().endsWith('/register')) registration = request; });
  async function signIn(target, email, pass = password) {
    await target.goto(`${base}/login`); await target.locator('.page-preloader').waitFor({ state: 'detached' });
    await target.getByLabel('Email address').fill(email); await target.getByLabel('Password', { exact: true }).fill(pass);
    await target.getByRole('button', { name: /sign in securely/i }).click();
  }
  async function navigate(target, name, role = 'admin') {
    const menu = target.getByRole('button', { name: 'Open navigation', exact: true }); if (await menu.isVisible()) await menu.click();
    await target.getByRole('navigation', { name: `${role === 'admin' ? 'Admin' : 'Teacher'} navigation` }).getByRole('button', { name, exact: true }).click();
  }
  async function requestHeaders(context, headers = {}) {
    const cookie = (await context.cookies()).find((item) => item.name === 'krya_session');
    // APIRequestContext omits Secure cookies on HTTP, unlike Chromium's trusted loopback navigation.
    return { ...headers, ...(cookie ? { cookie: `krya_session=${cookie.value}` } : {}) };
  }
  await page.goto(`${base}/register`); await page.locator('.page-preloader').waitFor({ state: 'detached' });
  await page.getByLabel('Full name').fill('Security fixture coach'); await page.getByLabel('Email address').fill(teacherEmail);
  await page.getByLabel('Password (15+ characters)', { exact: true }).fill(password); await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Submit application' }).click(); await page.getByRole('status').filter({ hasText: 'Application received' }).waitFor();
  const [pending] = await sql`SELECT id::text, role, status, password_hash FROM portal_users WHERE email = ${teacherEmail}`;
  assert.equal(pending.role, 'teacher'); assert.equal(pending.status, 'pending'); assert.notEqual(pending.password_hash, password);
  await signIn(page, teacherEmail); await page.waitForURL('**/login?error=pending');
  assert.equal((await applicant.cookies()).some((cookie) => cookie.name === 'krya_session'), false, 'Pending registration must not create a session');
  const expired = { id: randomUUID(), email: teacherEmail, role: 'teacher', exp: Date.now() - 1 };
  assert.equal(readSession(signSession(expired, env.SESSION_SECRET), env.SESSION_SECRET), null);
  const current = { ...expired, exp: Date.now() + 10000 };
  const signed = signSession(current, env.SESSION_SECRET);
  assert.deepEqual(readSession(signed, env.SESSION_SECRET), current);
  assert.equal(readSession(signed, 'incorrect-secret'), null);
  assert.equal(readSession(signSession({ ...current, id: '' }, env.SESSION_SECRET), env.SESSION_SECRET), null, 'Old stateless sessions require a fresh login');
  assert.equal(readSession(`${signed}.extra`, env.SESSION_SECRET), null);
  const admin = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
  await admin.addCookies([{ name: 'krya_session', value: await fixtureSession(sql, 'admin@krya.global', 'admin'), url: base }]);
  const adminPage = await admin.newPage(); await adminPage.goto(`${base}/admin`); await adminPage.locator('.page-preloader').waitFor({ state: 'detached' });
  const [legacyState] = await sql`SELECT md5(content::text) AS hash, jsonb_array_length(content->'klasses') AS klasses FROM academy_catalog WHERE id = 1`;
  const [coreState] = await sql`SELECT catalog_hash AS hash FROM academy_core_state WHERE id = 1`;
  assert.equal(coreState.hash, legacyState.hash, 'Relational core did not synchronize the catalog');
  assert.equal((await sql`SELECT count(*)::int AS count FROM class_groups WHERE active`)[0].count, legacyState.klasses, 'Class groups do not match the legacy catalog');
  adminPage.setDefaultTimeout(30000); adminPage.setDefaultNavigationTimeout(30000);
  await navigate(adminPage, 'Teacher accounts');
  const accountRow = adminPage.locator('.teacher-account-row').filter({ hasText: teacherEmail }); await accountRow.locator('summary').click();
  let approvalRequest;
  adminPage.on('request', (request) => { if (request.method() === 'POST' && request.headers()['next-action']) approvalRequest = request; });
  await accountRow.getByRole('button', { name: 'Approve', exact: true }).click(); await adminPage.getByRole('status').filter({ hasText: 'Account updated' }).waitFor();
  assert.equal((await sql`SELECT status FROM portal_users WHERE email = ${teacherEmail}`)[0].status, 'active');
  assert.equal((await sql`SELECT count(*)::int AS count FROM portal_account_events WHERE target_email = ${teacherEmail} AND action = 'approve'`)[0].count, 1);
  const replayHeaders = { ...approvalRequest.headers(), origin: base }; delete replayHeaders.cookie;
  const stale = await admin.request.post(`${base}/admin`, { headers: replayHeaders, data: approvalRequest.postDataBuffer() });
  assert.match(await stale.text(), /This account changed/, 'Stale account review must not succeed');
  await signIn(page, teacherEmail); await page.waitForURL('**/teacher'); await page.locator('.page-preloader').waitFor({ state: 'detached' });
  const cookie = (await applicant.cookies()).find((item) => item.name === 'krya_session'); assert.ok(cookie?.httpOnly);
  console.log('Pending registration and admin approval passed.');
  const unauthorized = await applicant.request.post(`${base}/admin`, { headers: await requestHeaders(applicant, replayHeaders), data: approvalRequest.postDataBuffer() });
  assert.match(unauthorized.headers()['x-action-redirect'] || '', /\/teacher/);
  assert.ok(await registration.postDataBuffer(), 'Registration request captured');
  const form = await new Request(registration.url(), { method: 'POST', headers: { 'content-type': registration.headers()['content-type'] }, body: registration.postDataBuffer() }).formData();
  const prefix = [...form.keys()].find((key) => key.endsWith('email')).slice(0, -5);
  form.set(`${prefix}role`, 'admin');
  const forged = new Request(`${base}/register`, { method: 'POST', body: form });
  const registerHeaders = { ...registration.headers(), origin: base, 'content-type': forged.headers.get('content-type') }; delete registerHeaders.cookie; delete registerHeaders['content-length'];
  await admin.request.post(`${base}/register`, { headers: registerHeaders, data: Buffer.from(await forged.arrayBuffer()) });
  assert.equal((await sql`SELECT role FROM portal_users WHERE email = ${teacherEmail}`)[0].role, 'teacher', 'Registration cannot promote an existing account');
  const claimEmail = `claim-${randomUUID()}@example.com`; form.set(`${prefix}email`, claimEmail);
  const claim = new Request(`${base}/register`, { method: 'POST', body: form });
  await admin.request.post(`${base}/register`, { headers: { ...registerHeaders, 'content-type': claim.headers.get('content-type') }, data: Buffer.from(await claim.arrayBuffer()) });
  const [claimed] = await sql`SELECT role, status FROM portal_users WHERE email = ${claimEmail}`;
  assert.equal(claimed.role, 'teacher'); assert.equal(claimed.status, 'pending', 'Public registration must not create an active admin');
  await sql`INSERT INTO portal_users (email, password_hash, role) VALUES (${otherEmail}, crypt(${password}, gen_salt('bf', 12)), 'teacher')`;
  await sql.begin(async (tx) => {
    await updateCatalog(tx, (catalog) => {
    catalog.coaches.push({ id: 'security-coach', name: 'Security coach', specialty: 'Security testing', level: 'Coach', image: '', email: teacherEmail, portalEmail: teacherEmail, bio: '', classes: 0, students: 0, revision: 0 });
    catalog.klasses.push({ id: 'security-class', title: 'Security class', category: 'Science', mode: 'Onsite', school: 'Fixture institution', coachIds: ['security-coach'], image: '/activities/collaboration.jpg', schedule: 'Saturday', description: 'Fixture class', students: 0, coaches: [] });
    catalog.students.push({ id: 'security-student', name: 'Private current roster', classIds: ['security-class'], grade: '10' });
    });
  });
  await sql`INSERT INTO teaching_records (id, teacher_email, kind, class_id, meeting_date, title, content, status) VALUES (${historicalId}, ${teacherEmail}, 'meeting', 'security-class', '2026-09-01', 'Historical journal', ${sql.json({ teacherAttendance: 'Present', reflection: 'Historical private reflection', students: [{ id: 'security-student', name: 'Historical student', attendance: 'Present', score: '', feedback: '' }] })}, 'Draft')`;
  const historyPdf = await PDFDocument.create(); historyPdf.addPage(); const historyBytes = Buffer.from(await historyPdf.save());
  await sql`INSERT INTO teaching_files (id, record_id, name, mime, bytes) VALUES (${photoId}, ${historicalId}, 'history.pdf', 'application/pdf', ${historyBytes})`;
  await sql`UPDATE teaching_records SET files = ${sql.json([{ id: photoId, name: 'history.pdf', mime: 'application/pdf', size: historyBytes.length }])} WHERE id = ${historicalId}`;
  await sql.begin(workflow.migrateTeachingWorkflow);
  await page.reload(); await page.locator('.page-preloader').waitFor({ state: 'detached' });
  await page.getByRole('button').filter({ hasText: 'Historical journal' }).first().click();
  let saveRequest;
  page.on('request', (request) => { if (request.method() === 'POST' && request.headers()['next-action']) saveRequest = request; });
  await page.getByRole('button', { name: 'Save draft', exact: true }).click(); await page.getByRole('status').filter({ hasText: 'Draft saved' }).waitFor();
  const staleSaveHeaders = { ...saveRequest.headers(), origin: base }; delete staleSaveHeaders.cookie;
  const staleSave = await applicant.request.post(`${base}/teacher`, { headers: await requestHeaders(applicant, staleSaveHeaders), data: saveRequest.postDataBuffer() });
  assert.match(await staleSave.text(), /changed in another tab or review/, 'Stale teacher saves must not overwrite the latest submission');
  const other = await browser.newContext(); await other.addCookies([{ name: 'krya_session', value: await fixtureSession(sql, otherEmail, 'teacher'), url: base }]);
  assert.equal((await other.request.get(`${base}/api/teaching-files/${photoId}`)).status(), 404, 'Other teacher cannot read documentation');
  const saveHeaders = { ...saveRequest.headers(), origin: base }; delete saveHeaders.cookie;
  const deniedSave = await other.request.post(`${base}/teacher`, { headers: saveHeaders, data: saveRequest.postDataBuffer() });
  assert.match(await deniedSave.text(), /not assigned|not available/, 'Other teacher cannot update another record');
  await sql.begin((tx) => updateCatalog(tx, (catalog) => { catalog.klasses.find((item) => item.id === 'security-class').coachIds = []; }));
  const removedSave = await applicant.request.post(`${base}/teacher`, { headers: await requestHeaders(applicant, saveHeaders), data: saveRequest.postDataBuffer() });
  assert.match(await removedSave.text(), /not assigned/, 'Removed teacher cannot edit history');
  await page.reload(); await page.locator('.page-preloader').waitFor({ state: 'detached' });
  assert.doesNotMatch(await page.locator('body').innerText(), /Private current roster/);
  await navigate(page, 'Submission history', 'teacher'); await page.getByRole('button').filter({ hasText: 'Historical journal' }).click();
  await page.getByText('Historical private reflection').waitFor(); assert.equal(await page.getByRole('button', { name: 'Save draft' }).count(), 0);
  assert.equal((await applicant.request.get(`${base}/api/teaching-files/${photoId}`, { headers: await requestHeaders(applicant) })).status(), 200, 'Own historical files remain readable');
  console.log('Cross-teacher isolation and historical read-only access passed.');
  await accountRow.getByLabel(`Review note for ${teacherEmail}`).fill('Fixture suspension'); await accountRow.getByRole('button', { name: 'Suspend', exact: true }).click();
  await accountRow.locator('.admin-status').filter({ hasText: 'suspended' }).waitFor();
  assert.equal((await applicant.request.get(`${base}/api/teaching-files/${photoId}`, { headers: await requestHeaders(applicant) })).status(), 401, 'Suspension must revoke the cookie');
  await accountRow.getByRole('button', { name: 'Reactivate', exact: true }).click(); await accountRow.locator('.admin-status').filter({ hasText: 'active' }).waitFor();
  assert.equal((await applicant.request.get(`${base}/api/teaching-files/${photoId}`, { headers: await requestHeaders(applicant) })).status(), 401, 'Reactivation must not revive old sessions');
  await signIn(page, teacherEmail); await page.waitForURL('**/teacher');
  const revokeReply = adminPage.waitForResponse((response) => response.request().method() === 'POST' && Boolean(response.request().headers()['next-action']));
  await accountRow.getByRole('button', { name: 'Revoke sessions', exact: true }).click(); await revokeReply;
  assert.equal((await sql`SELECT count(*)::int AS count FROM portal_sessions WHERE email = ${teacherEmail}`)[0].count, 0);
  await page.goto(`${base}/teacher`); await page.waitForURL('**/login');
  await signIn(page, teacherEmail); await page.waitForURL('**/teacher'); await page.locator('.page-preloader').waitFor({ state: 'detached' });
  const beforeLogout = (await applicant.cookies()).find((item) => item.name === 'krya_session');
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true }); if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click(); await page.waitForURL('**/login');
  await applicant.addCookies([beforeLogout]); await page.goto(`${base}/teacher`); await page.waitForURL('**/login');
  console.log('Suspend, reactivate, revoke and logout invalidation passed.');
  for (let i = 0; i < 11; i++) { await signIn(page, otherEmail, 'wrong-password'); await page.waitForURL(/error=(invalid|limited)/); }
  assert.match(page.url(), /error=limited/, 'Account login quota must apply');
  for (const width of [1440, 390, 360]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto(`${base}/register`); await page.getByRole('button', { name: 'Submit application' }).waitFor({ state: 'visible' }); await page.locator('.page-preloader').waitFor({ state: 'detached' });
    assert.ok(await page.locator('.auth-panel').isVisible(), 'Registration must render, not just avoid overflow');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Registration overflow'); await page.screenshot({ path: join(screenshots, `register-${width}.png`), fullPage: true });
    await adminPage.setViewportSize({ width, height: 900 }); assert.equal(await adminPage.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Accounts overflow'); await adminPage.screenshot({ path: join(screenshots, `accounts-${width}.png`), fullPage: true });
  }
  assert.deepEqual(errors, []); console.log('Registration, approval, session revocation, login quotas, cross-teacher isolation and read-only history passed.');
  await browser.close(); browser = null;
  await sql.begin(async (tx) => {
    await updateCatalog(tx, (catalog) => {
    catalog.coaches = catalog.coaches.filter((item) => item.id !== 'security-coach');
    catalog.klasses = catalog.klasses.filter((item) => item.id !== 'security-class');
    catalog.students = catalog.students.filter((item) => item.id !== 'security-student');
    });
    await tx`DELETE FROM teaching_records WHERE id = ${historicalId}`;
    await tx`DELETE FROM portal_users WHERE email IN ${tx([teacherEmail, otherEmail, claimEmail])}`;
    await tx`DELETE FROM portal_account_events WHERE target_email IN ${tx([teacherEmail, otherEmail, claimEmail])}`;
  });
  await sql`TRUNCATE portal_rate_limits`;
  for (const file of ['tests/phase3-check.mjs', 'tests/phase5-check.mjs', 'tests/phase4-check.mjs', 'tests/auth-check.mjs', 'tests/academy-check.mjs', 'tests/inquiry-check.mjs', 'tests/admin-check.mjs', 'tests/upload-concurrency-check.mjs', 'tests/teacher-check.mjs']) await run(file, env);
  assert.equal((await sql`SELECT md5(content::text) AS hash FROM academy_catalog WHERE id = 1`)[0].hash, legacyState.hash, 'Relational writes changed the catalog archive');
  console.log('All security checks used an isolated schema. Operational records were not modified.');
} catch (error) {
  console.error('Test server diagnostic output:', output);
  if (browser) for (const [index, page] of browser.contexts().flatMap((context) => context.pages()).entries()) await page.screenshot({ path: join(tmpdir(), `krya-security-failure-${index}.png`) }).catch(() => {});
  throw error;
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) { const closed = new Promise((resolve) => server.once('exit', resolve)); server.kill(); await closed; }
  await sql.end();
  if (created) await adminSql`DROP SCHEMA ${adminSql(schema)} CASCADE`;
  await adminSql.end();
  await rm(fileDirectory, { recursive: true, force: true });
}
