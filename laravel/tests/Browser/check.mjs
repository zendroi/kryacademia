import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '../..');
const require = createRequire(process.env.KRYA_BROWSER_PACKAGE || resolve(root, 'package.json'));
const { chromium } = require('playwright');
const php = process.env.PHP_BINARY || 'php';
const id = randomUUID();
const directory = resolve(root, 'storage/app/private/browser-check-' + id);
const runtime = resolve(directory, 'runtime');
const database = resolve(runtime, 'framework/testing/ui-check-' + id + '.sqlite');
const password = randomBytes(24).toString('base64url');
const base = 'http://127.0.0.1:8010';
await mkdir(resolve(database, '..'), { recursive: true });
await mkdir(directory, { recursive: true });
await Promise.all(['app/private', 'framework/cache/data', 'framework/sessions', 'framework/views', 'logs'].map((path) => mkdir(resolve(runtime, path), { recursive: true })));
await writeFile(database, '', { flag: 'wx' });
const env = { ...process.env, LARAVEL_STORAGE_PATH: runtime, DB_CONNECTION: 'sqlite', DB_DATABASE: database, DB_URL: '', CACHE_STORE: 'database', SESSION_DRIVER: 'database', BCRYPT_ROUNDS: '4', APP_URL: base, APP_DEBUG: 'false', KRYA_UI_PASSWORD: password };
const seeded = spawnSync(php, ['tests/Browser/fixture.php'], { cwd: root, env: { ...env, APP_ENV: 'testing' }, encoding: 'utf8' });
assert.equal(seeded.status, 0, seeded.stdout + seeded.stderr);
const fixture = JSON.parse(seeded.stdout);
const server = spawn(php, ['-S', '127.0.0.1:8010', '-t', resolve(root, 'public'), resolve(root, 'vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php')], { cwd: resolve(root, 'public'), env: { ...env, APP_ENV: 'local' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', (bytes) => { serverLog += bytes; });
server.stderr.on('data', (bytes) => { serverLog += bytes; });
let browser;
const errors = [];
const checks = [];
const contexts = [];
async function page(width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
  contexts.push(context);
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', (error) => errors.push(error.message));
  return page;
}
async function layout(page, label) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, label + ' must not overflow');
  const broken = await page.locator('img').evaluateAll(async (images) => {
    const visible = images.filter((image) => { const r = image.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; });
    await Promise.all(visible.map((image) => image.decode().catch(() => {})));
    return visible.filter((image) => !image.naturalWidth).map((image) => image.getAttribute('src'));
  });
  assert.deepEqual(broken, [], label + ' images');
  await page.screenshot({ path: resolve(directory, label + '.png') });
  checks.push(label);
}
async function login(page, email, suffix) {
  await page.goto(base + '/login');
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await page.waitForURL('**/' + suffix);
  await page.locator('.admin-shell').waitFor();
}
async function navigate(page, name) {
  const toggle = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await toggle.isVisible()) await toggle.click();
  await page.locator('.admin-sidebar nav').getByRole('button', { name: new RegExp('^' + name) }).click();
  await page.waitForTimeout(350);
}
try {
  for (let i = 0; i < 50; i++) {
    try { const response = await fetch(base + '/up'); if (response.ok) break; } catch {}
    if (i === 49) throw new Error('Fixture server did not start: ' + serverLog.slice(-1500));
    await new Promise((done) => setTimeout(done, 200));
  }
  browser = await chromium.launch({ headless: true });
  const landing = await page();
  await landing.goto(base); await landing.locator('#home').waitFor();
  await layout(landing, 'landing-desktop');
  await landing.locator('#updates').scrollIntoViewIfNeeded();
  const before = await landing.evaluate(() => scrollY); await landing.mouse.wheel(0, 450); await landing.waitForTimeout(400);
  assert.ok(await landing.evaluate(() => scrollY) > before + 50, 'Updates must allow page scrolling');
  checks.push('updates-scroll');
  await landing.locator('#coaches').scrollIntoViewIfNeeded();
  await landing.locator('.coach-portrait-placeholder').waitFor();
  await landing.locator('#partners').scrollIntoViewIfNeeded();
  assert.ok(await landing.locator('#partners img').count() > 0, 'Existing partner artwork must remain available while company logo fields are empty');
  checks.push('incomplete-media-keeps-coach-initials-and-existing-logo-loop');
  await landing.locator('#contact').scrollIntoViewIfNeeded();
  for (const [name, value] of Object.entries({ name: 'Browser Review Parent', email: 'browser-parent@example.test', phone: '08123456789', place: 'Surabaya' })) await landing.locator(`#contact input[name="${name}"]`).fill(value);
  await landing.locator('#contact .form-field').filter({ hasText: /Inquiry type/i }).getByRole('button').click();
  await landing.getByRole('option', { name: 'Workshop', exact: true }).click();
  await landing.locator('#contact .form-field').filter({ hasText: /^Institution/i }).getByRole('button').click();
  await landing.getByRole('option', { name: /Parent/ }).click();
  await landing.locator('#contact input[name="request"]').fill('Creative coding workshop');
  await landing.locator('#contact textarea[name="message"]').fill('Browser workflow verification.');
  await landing.locator('#consent').click();
  await landing.locator('#contact button[type="submit"]').click();
  await landing.getByRole('status').filter({ hasText: /inquiry|terkirim/i }).waitFor();
  checks.push('landing-inquiry-submit');
  const admin = await page(); await login(admin, fixture.admin, 'admin');
  await layout(admin, 'admin-desktop');
  for (const name of ['Klass', 'Institutions', 'Coaches', 'Students', 'Teacher accounts', 'Approvals', 'Inquiries', 'Delivery jobs']) {
    await navigate(admin, name); await admin.locator('main').waitFor();
    assert.equal(await admin.getByRole('alert').count(), 0, name + ' should load');
    checks.push('admin-' + name);
  }
  await navigate(admin, 'Inquiries');
  await admin.getByRole('button', { name: 'Refresh inbox', exact: true }).click();
  await admin.getByText('Browser Review Parent', { exact: true }).waitFor();
  checks.push('admin-inquiry-inbox');
  await navigate(admin, 'Teacher accounts');
  await admin.getByLabel('Teacher name', { exact: true }).fill('Browser Invited Teacher');
  await admin.getByLabel('Teacher login email', { exact: true }).fill('browser-invited@example.test');
  await admin.getByLabel('Initial password (15+ characters)', { exact: true }).fill(password);
  await admin.getByRole('button', { name: 'Create account & invitation', exact: true }).click();
  const invitationField = admin.getByLabel('Registration invitation', { exact: true });
  await invitationField.waitFor();
  const invited = await page(); await invited.goto(await invitationField.inputValue());
  await invited.getByLabel('Full name', { exact: true }).fill('Browser Invited Teacher');
  await invited.getByLabel('Bank name (e.g. BCA, Mandiri)', { exact: true }).fill('Review Bank');
  await invited.getByLabel('Bank account number', { exact: true }).fill('0011223344');
  await invited.getByLabel('Account holder name', { exact: true }).fill('Browser Invited Teacher');
  await invited.getByLabel('KTP photo', { exact: true }).setInputFiles(fixture.image);
  await invited.getByAltText('KTP preview', { exact: true }).waitFor();
  await invited.getByRole('button', { name: 'Submit Profile Application', exact: true }).click();
  await invited.waitForURL('**/login');
  checks.push('teacher-invitation-and-compressed-KTP-onboarding');
  await admin.getByRole('button', { name: 'Refresh accounts', exact: true }).click();
  const accountRow = admin.locator('.teacher-account-row').filter({ hasText: 'browser-invited@example.test' });
  await accountRow.locator('summary').click();
  await accountRow.getByRole('link', { name: 'View KTP photo', exact: true }).waitFor();
  const identity = await accountRow.getByRole('link', { name: 'View KTP photo', exact: true }).getAttribute('href');
  assert.equal((await admin.request.get(base + identity)).status(), 200);
  assert.equal((await landing.request.get(base + identity, { headers: { Accept: 'application/json' }, maxRedirects: 0 })).status(), 401);
  await accountRow.getByRole('button', { name: 'Approve', exact: true }).click();
  await accountRow.locator('.status-active').waitFor();
  await login(invited, 'browser-invited@example.test', 'teacher');
  assert.equal((await invited.request.get(base + identity)).status(), 404);
  checks.push('admin-approve-teacher-and-private-KTP-access');
  await accountRow.getByRole('button', { name: 'Suspend', exact: true }).click();
  await accountRow.locator('.status-suspended').waitFor();
  await invited.reload(); await invited.waitForURL('**/login');
  checks.push('admin-suspend-revokes-teacher-session');
  await navigate(admin, 'Klass');
  await admin.locator('main').getByRole('button', { name: /Review Coding/ }).first().click();
  await admin.getByRole('button', { name: 'Edit Klass', exact: true }).click();
  await admin.getByLabel('Schedule', { exact: true }).fill('Tuesday 15:00 - 16:00 / confirmed');
  await admin.locator('form.admin-record-form button[type="submit"]').click();
  await admin.locator('form.admin-record-form').waitFor({ state: 'hidden' });
  checks.push('admin-edit-klass');
  const teacher = await page(); await login(teacher, fixture.teacher, 'teacher');
  await layout(teacher, 'teacher-desktop');
  for (const name of ['Class Workflow', 'Lesson Plans', 'Semester Preparation', 'Class Requests', 'Notifications', 'Submission history', 'Meeting Journal']) { await navigate(teacher, name); checks.push('teacher-' + name); }
  await writeFile(resolve(directory, 'teacher-form-labels.json'), JSON.stringify(await teacher.locator('main').evaluate((main) => ({ buttons: [...main.querySelectorAll('button')].map((button) => button.textContent), inputs: [...main.querySelectorAll('input, textarea')].map((input) => ({ name: input.name, label: input.getAttribute('aria-label'), type: input.type })) })), null, 2));
  await teacher.getByRole('button', { name: 'Save draft', exact: true }).click();
  await teacher.getByRole('status').filter({ hasText: 'Draft saved.' }).waitFor();
  checks.push('teacher-save-draft');
  await teacher.locator('.teacher-attendance-row').filter({ hasText: 'Review Student Two' }).getByRole('button', { name: 'Absent', exact: true }).click();
  await teacher.getByRole('button', { name: 'Student & Class Feedback', exact: true }).click();
  assert.equal(await teacher.locator('.teacher-student-feedback').count(), 1, 'Absent student feedback must be hidden');
  for (const group of await teacher.locator('.teacher-ratings [role="group"]').all()) await group.getByRole('button', { name: '3 / Proficient', exact: true }).click();
  await teacher.getByLabel(/^Personal feedback /).fill('Explained the program clearly.');
  await teacher.getByLabel(/^Class feedback/).fill('Students completed and demonstrated their projects.');
  await teacher.getByLabel('Documentation photos', { exact: true }).setInputFiles(fixture.image);
  await teacher.locator('.teacher-upload-previews img').waitFor();
  await teacher.getByRole('button', { name: 'Submit record', exact: true }).click();
  await teacher.getByRole('status').filter({ hasText: 'Submitted successfully.' }).waitFor();
  const attachment = await teacher.locator('.teacher-upload-previews img').getAttribute('src');
  assert.ok(attachment.startsWith('/api/teaching-files/'));
  assert.equal((await teacher.request.get(base + attachment)).status(), 200);
  assert.equal((await landing.request.get(base + attachment, { headers: { Accept: 'application/json' }, maxRedirects: 0 })).status(), 401);
  checks.push('teacher-feedback-photo-submit-and-private-file');
  await admin.reload(); await navigate(admin, 'Approvals');
  await admin.locator('.teacher-review-row').filter({ hasText: 'Meeting journal' }).getByRole('button', { name: /^Review/ }).click();
  await admin.getByRole('button', { name: 'Save review', exact: true }).click();
  await admin.locator('.teacher-review-controls').waitFor({ state: 'hidden' });
  checks.push('admin-approve-teacher-journal');
  await teacher.reload(); await navigate(teacher, 'Submission history');
  assert.ok(await teacher.getByText('Approved', { exact: true }).count() >= 2, 'Approved journal and syllabus must appear in teacher history');
  checks.push('teacher-approved-history');
  await teacher.setViewportSize({ width: 390, height: 844 }); await navigate(teacher, 'Overview'); await teacher.evaluate(() => scrollTo(0, 0)); await layout(teacher, 'teacher-mobile');
  await admin.setViewportSize({ width: 390, height: 844 }); await navigate(admin, 'Klass'); await layout(admin, 'admin-mobile');
  await landing.setViewportSize({ width: 390, height: 844 }); await landing.goto(base); await layout(landing, 'landing-mobile');
  assert.deepEqual(errors, [], 'No browser JavaScript errors');
  const report = { ok: true, checks, directory };
  await writeFile(resolve(directory, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch (error) {
  for (const [index, context] of contexts.entries()) { for (const page of context.pages()) await page.screenshot({ path: resolve(directory, 'failure-' + index + '.png') }).catch(() => {}); }
  await writeFile(resolve(directory, 'failure.json'), JSON.stringify({ message: error.message, stack: error.stack, errors }, null, 2));
  console.error(JSON.stringify({ ok: false, message: error.message, errors, checks, directory })); process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
}
