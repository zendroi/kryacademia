import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import postgres from 'postgres';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3001';
const testName = `Teacher browser check ${randomUUID()}`;
const teacherEmail = `teacher-${randomUUID()}@example.com`;
const screenshots = join(tmpdir(), 'kryacademia-teacher-check');
const errors = [];
const sql = postgres(process.env.DATABASE_URL, { ssl: process.env.DATABASE_URL.includes('localhost') ? false : 'require' });
const testDate = '2032-02-20';
const contexts = [];
const browser = await chromium.launch();

function token(email, role) {
  const payload = Buffer.from(JSON.stringify({ email, role, exp: Date.now() + 3600000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', process.env.SESSION_SECRET).update(payload).digest('base64url')}`;
}
async function context(email = teacherEmail, role = 'teacher', width = 1440) {
  const ctx = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
  await ctx.addCookies([{ name: 'krya_session', value: token(email, role), url: baseUrl }]);
  contexts.push(ctx);
  return ctx;
}
async function navigate(page, name) {
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation', { name: 'Teacher navigation' }).getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await page.waitForTimeout(650);
}
async function layout(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Page must not overflow');
  const broken = await page.locator('img').evaluateAll(async (images) => {
    await Promise.all(images.map((image) => image.decode().catch(() => {})));
    return images.filter((image) => !image.naturalWidth).map((image) => image.src);
  });
  assert.deepEqual(broken, []);
}
async function save(page, draft = false) {
  await page.getByRole('button', { name: draft ? 'Save draft' : 'Submit record', exact: true }).click();
  await page.getByRole('status').filter({ hasText: draft ? 'Draft saved.' : 'Submitted successfully.' }).waitFor();
  await page.waitForFunction(() => document.querySelector('.teacher-editor button[type="submit"]')?.disabled === false);
}

try {
  await mkdir(screenshots, { recursive: true });
  await sql`INSERT INTO portal_users (email, password_hash, role) VALUES (${teacherEmail}, crypt(${randomUUID()}, gen_salt('bf')), 'teacher')`;
  const ctx = await context();
  const page = await ctx.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${baseUrl}/teacher`);
  await page.waitForLoadState('networkidle');
  await page.locator('.admin-topbar').getByRole('button', { name: 'Notifications', exact: true }).click();
  await navigate(page, 'Overview');
  assert.equal(await page.locator('.teacher-alert').count(), 0);
  for (const width of (process.env.WIDTHS || '1440,768,390,360').split(',').map(Number)) {
    await page.setViewportSize({ width, height: 960 });
    for (const name of ['Overview', 'Meeting Journal', 'Lesson Plans', 'Semester Preparation', 'Class Requests', 'Notifications']) {
      await navigate(page, name);
      await layout(page);
      await page.screenshot({ path: join(screenshots, `${name.replaceAll(' ', '-')}-${width}.png`), fullPage: true });
    }
    console.log(`Teacher layout passed at ${width}px.`);
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  await navigate(page, 'Meeting Journal');
  await page.getByLabel('Meeting date', { exact: true }).fill(testDate);
  await page.getByLabel('Meeting topic *', { exact: true }).fill(`${testName} meeting`);
  await page.getByRole('button', { name: 'Submit record', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Add a score and feedback' }).waitFor();
  await page.getByRole('button', { name: 'Student & Class Feedback', exact: true }).click();
  await page.getByLabel('Score alicia', { exact: true }).fill('92');
  await page.getByLabel('Score darren', { exact: true }).fill('85');
  await page.getByLabel('Personal feedback alicia').fill('Explained the experiment clearly and used observations as evidence.');
  await page.getByLabel('Personal feedback darren').fill('Worked carefully; next meeting focus on describing experimental controls.');
  await page.getByLabel('Class feedback').fill('Students compared findings and shared their observations confidently.');
  const photo = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 2400; canvas.height = 1600;
    const context = canvas.getContext('2d'); context.fillStyle = '#e8001b'; context.fillRect(0, 0, 2400, 1600);
    context.fillStyle = '#173051'; context.fillRect(100, 100, 2000, 1200);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Documentation photos').setInputFiles({ name: 'classroom-test.png', mimeType: 'image/png', buffer: Buffer.from(photo, 'base64') });
  await page.locator('.teacher-upload-previews img').waitFor();
  await save(page);
  const [meeting] = await sql`SELECT id, content, files FROM teaching_records WHERE title = ${`${testName} meeting`}`;
  assert.equal(meeting.content.students[0].score, '92');
  assert.equal(meeting.files[0].mime, 'image/webp');
  assert.ok(meeting.files[0].size <= 184320);
  const attachmentUrl = `${baseUrl}/api/teaching-files/${meeting.files[0].id}`;
  const owned = await ctx.request.get(attachmentUrl);
  assert.equal(owned.status(), 200);
  assert.equal(owned.headers()['cache-control'], 'private, no-store');
  const anonymous = await browser.newContext(); contexts.push(anonymous);
  assert.equal((await anonymous.request.get(attachmentUrl)).status(), 401);
  const other = await context('other@example.com');
  assert.equal((await other.request.get(attachmentUrl)).status(), 404);
  await page.reload();
  await page.getByRole('button', { name: new RegExp(`${testName} meeting`) }).click();
  await page.getByRole('button', { name: 'Student & Class Feedback', exact: true }).click();
  assert.equal(await page.getByLabel('Score alicia', { exact: true }).inputValue(), '92');
  await layout(page);
  await navigate(page, 'Lesson Plans');
  await page.getByLabel('Next meeting', { exact: true }).fill('2032-02-21');
  await page.getByLabel('Title *', { exact: true }).fill(`${testName} lesson plan`);
  await page.getByLabel('Learning objectives').fill('Explain how controls improve experimental evidence.');
  await page.getByLabel('Learning activities & timing').fill('15 minute reflection, 30 minute investigation, 15 minute discussion.');
  await save(page, true);
  await save(page);
  await navigate(page, 'Semester Preparation');
  await page.getByLabel('Title *', { exact: true }).fill(`${testName} syllabus`);
  await page.getByLabel('Semester learning objectives').fill('Build confidence in responsible experiments and evidence-based reasoning.');
  await page.getByLabel('Meeting-by-meeting syllabus').fill('Week 1: observation. Week 2: controls. Week 3: compare results. Week 4: present findings.');
  await save(page);
  await page.getByRole('button', { name: 'Material slides', exact: true }).click();
  assert.equal(await page.locator('.teacher-canva-templates a').count(), 4);
  await page.getByLabel('Meeting date', { exact: true }).fill(testDate);
  await page.getByLabel('Title *', { exact: true }).fill(`${testName} slides`);
  await page.getByLabel('Your Canva slides link').fill('https://example.com/not-canva');
  await page.getByRole('button', { name: 'Submit record', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Use a secure Canva design link' }).waitFor();
  await page.getByLabel('Your Canva slides link').fill('https://canva.link/tf9z5tip7qyaou8');
  await page.getByLabel('Document PDF', { exact: true }).setInputFiles({ name: 'lesson-slides.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF') });
  await page.locator('.teacher-upload-previews').getByText('lesson-slides.pdf', { exact: true }).waitFor();
  await save(page);
  await navigate(page, 'Class Requests');
  await page.getByLabel('Needed by', { exact: true }).fill(testDate);
  await page.getByLabel('Title *', { exact: true }).fill(`${testName} supplies`);
  await page.getByLabel('Items & quantities').fill('10 reusable sample containers and 2 measuring tools.');
  await page.getByLabel('Purpose & classroom needs').fill('For student experiments during the next biotechnology class.');
  await save(page);
  const admin = await context('admin@krya.global', 'admin');
  assert.equal((await admin.request.get(attachmentUrl)).status(), 200);
  const adminPage = await admin.newPage();
  await adminPage.goto(`${baseUrl}/admin`);
  await adminPage.waitForLoadState('networkidle');
  await adminPage.getByRole('navigation', { name: 'Admin navigation' }).getByRole('button', { name: /^Approvals/ }).click();
  await adminPage.locator('.teacher-review-row').filter({ hasText: `${testName} supplies` }).getByRole('button', { name: 'Review' }).click();
  await adminPage.getByRole('button', { name: /^Review status/ }).click();
  await adminPage.getByRole('button', { name: 'Needs revision', exact: true }).click();
  await adminPage.getByLabel('Admin note', { exact: true }).fill('Please add the required container size.');
  await adminPage.getByRole('button', { name: 'Save review', exact: true }).click();
  await adminPage.getByRole('status').filter({ hasText: 'Review saved.' }).waitFor();
  await page.getByRole('button', { name: 'Refresh workspace', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Workspace updated.' }).waitFor();
  await navigate(page, 'Notifications');
  await page.getByRole('heading', { name: `${testName} supplies: Needs revision` }).waitFor();
  await page.getByRole('button', { name: `View ${testName} supplies: Needs revision`, exact: true }).click();
  await page.getByLabel('Items & quantities').fill('10 reusable 100 ml sample containers and 2 measuring tools.');
  await save(page);
  await adminPage.reload();
  await adminPage.waitForLoadState('networkidle');
  await adminPage.getByRole('navigation', { name: 'Admin navigation' }).getByRole('button', { name: /^Approvals/ }).click();
  await adminPage.locator('.teacher-review-row').filter({ hasText: `${testName} supplies` }).getByRole('button', { name: 'Review' }).click();
  await adminPage.setViewportSize({ width: 360, height: 900 });
  await layout(adminPage);
  await adminPage.screenshot({ path: join(screenshots, 'admin-review-360.png'), fullPage: true });
  await adminPage.getByLabel('Admin note', { exact: true }).fill('Materials are approved and will be prepared before the meeting.');
  await adminPage.getByRole('button', { name: 'Save review', exact: true }).click();
  await adminPage.getByRole('status').filter({ hasText: 'Review saved.' }).waitFor();
  await page.reload();
  await navigate(page, 'Notifications');
  await page.getByRole('heading', { name: `${testName} supplies: Approved` }).waitFor();
  assert.match(await page.locator('.teacher-channel-strip').innerText(), /WhatsApp not connected/);
  await page.getByRole('button', { name: 'Mark all read', exact: true }).click();
  await page.getByRole('button', { name: 'Unread', exact: true }).click();
  await page.getByText('All caught up', { exact: true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: new RegExp(`${testName} supplies`) }).click();
  assert.equal(await page.getByRole('button', { name: 'Submit record', exact: true }).count(), 0, 'Approved request should be read only');
  await adminPage.locator('.teacher-review-row').filter({ hasText: `${testName} supplies` }).getByRole('button', { name: 'Review' }).click();
  await adminPage.getByRole('button', { name: /^Review status/ }).click();
  await adminPage.keyboard.press('Escape');
  assert.equal(await adminPage.getByRole('dialog').count(), 1, 'Escape closes the dropdown before the dialog');
  await adminPage.getByRole('button', { name: /^Review status/ }).click();
  await adminPage.getByRole('button', { name: 'Fulfilled', exact: true }).click();
  await adminPage.getByLabel('Admin note', { exact: true }).fill('The supplies are ready for the upcoming meeting.');
  await adminPage.getByRole('button', { name: 'Save review', exact: true }).click();
  await adminPage.getByRole('status').filter({ hasText: 'Review saved.' }).waitFor();
  await page.getByRole('button', { name: 'Refresh workspace', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Workspace updated.' }).waitFor();
  await navigate(page, 'Notifications');
  await page.getByRole('heading', { name: `${testName} supplies: Fulfilled` }).waitFor();
  assert.deepEqual(errors, []);
  console.log('Teacher persistence, photos, access control, admin review, and notifications passed.');
} finally {
  for (const ctx of contexts) await ctx.close();
  await browser.close();
  await sql`DELETE FROM teaching_records WHERE teacher_email = ${teacherEmail}`;
  await sql`DELETE FROM portal_users WHERE email = ${teacherEmail}`;
  await sql.end();
}
