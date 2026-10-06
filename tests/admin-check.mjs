import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import postgres from 'postgres';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3001';
if (!process.env.SESSION_SECRET || !process.env.DATABASE_URL) throw new Error('SESSION_SECRET and DATABASE_URL are required');
const sql = postgres(process.env.DATABASE_URL, { ssl: process.env.DATABASE_URL.includes('localhost') ? false : 'require' });
const fixtureIds = [];
const catalogNames = [];
const screenshots = join(tmpdir(), 'kryacademia-admin-check');
const errors = [];

function session(role) {
  const payload = Buffer.from(JSON.stringify({ email: `${role}@krya.global`, role, exp: Date.now() + 600000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', process.env.SESSION_SECRET).update(payload).digest('base64url')}`;
}

async function download(page, trigger) {
  const pending = page.waitForEvent('download');
  await trigger();
  const file = await pending;
  assert.equal(await file.failure(), null);
  return readFile(await file.path(), 'utf8');
}

async function navigate(page, label) {
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation', { name: 'Admin navigation' }).getByRole('button', { name: new RegExp(`^${label}(?:\\s*\\d+)?$`) }).click();
  await page.waitForTimeout(350);
  const heading = { Overview: 'Good morning', Institutions: 'Institution Management', Coaches: 'Coach Management', Students: 'Student Management', Inquiries: 'Inquiry List', Approvals: 'Approval Management' };
  assert.match(await page.locator('.admin-page-heading').innerText(), new RegExp(heading[label] || label));
}

async function layout(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  if (overflow) {
    const elements = await page.locator('.admin-workspace *').evaluateAll((items) => items.filter((item) => item.getBoundingClientRect().right > innerWidth + 1).map((item) => ({ class: item.className, width: item.getBoundingClientRect().width })).slice(0, 12));
    await page.screenshot({ path: join(screenshots, 'overflow.png'), fullPage: true });
    console.log(await page.locator('h1').innerText(), elements);
  }
  assert.equal(overflow, false, 'Page overflow');
  const unloaded = await page.locator('img').evaluateAll(async (images) => {
    await Promise.all(images.map((image) => image.decode().catch(() => {})));
    return images.filter((image) => !image.naturalWidth).map((image) => image.getAttribute('src'));
  });
  assert.deepEqual(unloaded, [], 'Broken image assets');
}

(async () => {
  const browser = await chromium.launch();
  try {
    await mkdir(screenshots, { recursive: true });
    const anonymous = await browser.newPage();
    await anonymous.goto(`${baseUrl}/admin`);
    await anonymous.waitForURL('**/login');
    assert.match(anonymous.url(), /\/login$/);
    await anonymous.close();
    const teacher = await browser.newContext();
    await teacher.addCookies([{ name: 'krya_session', value: session('teacher'), url: baseUrl }]);
    const teacherPage = await teacher.newPage();
    await teacherPage.goto(`${baseUrl}/admin`);
    await teacherPage.waitForURL('**/teacher');
    assert.match(teacherPage.url(), /\/teacher$/);
    await teacher.close();

    for (const width of (process.env.WIDTHS || '1440,768,390,360').split(',').map(Number)) {
      const fixtureId = randomUUID(); fixtureIds.push(fixtureId);
      const inquiryName = `Admin inquiry fixture ${width}`;
      await sql`INSERT INTO inquiries (id, submission_hash, name, email, phone, place, type, affiliation, message, language) VALUES (${fixtureId}, 'test', ${inquiryName}, ${`admin-check-${fixtureId}@example.com`}, '+62 812 3456 7890', 'Surabaya', 'Other', 'Parent', 'Check inquiry follow-up.', 'en')`;
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await context.addCookies([{ name: 'krya_session', value: session('admin'), url: baseUrl }]);
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(`${baseUrl}/admin`);
      await page.waitForLoadState('networkidle');
      await page.getByRole('heading', { name: 'Good morning, Admin.' }).waitFor();
      await page.getByRole('button', { name: 'Notifications', exact: true }).click();
      await page.locator('.admin-notifications').waitFor();
      await page.getByRole('button', { name: 'Close notifications', exact: true }).first().click();
      await page.locator('.admin-notifications').waitFor({ state: 'hidden' });
      await layout(page);
      await page.screenshot({ path: join(screenshots, `overview-${width}.png`), fullPage: true });
      for (const label of ['Klass', 'Institutions', 'Coaches', 'Students', 'Approvals', 'Reports', 'Inquiries', 'Broadcast']) {
        await navigate(page, label);
        await layout(page);
      }

      await navigate(page, 'Klass');
      const mode = page.getByRole('group', { name: 'Filter classes by mode' });
      await mode.getByRole('button', { name: 'Online', exact: true }).click();
      assert.equal(await page.locator('.admin-klass-card').count(), 3);
      await mode.getByRole('button', { name: 'Onsite', exact: true }).click();
      assert.equal(await page.locator('.admin-klass-card').count(), 2);
      await page.getByRole('textbox', { name: 'Search current section' }).fill('no-such-klass');
      await page.getByText('No matching records', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Clear search' }).click();
      assert.equal(await page.locator('.admin-klass-card').count(), 2);
      await mode.getByRole('button', { name: 'All', exact: true }).click();
      const card = page.locator('.admin-klass-card').first();
      await card.click();
      const dialog = page.getByRole('dialog', { name: 'klass details', exact: true });
      await dialog.waitFor();
      await page.screenshot({ path: join(screenshots, `klass-detail-${width}.png`) });
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        assert.equal(await dialog.evaluate((element) => element.contains(document.activeElement) || document.activeElement === document.body), true, 'An underlying control received focus');
      }
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(await card.evaluate((element) => element === document.activeElement), true, 'Focus not restored');
      await layout(page);

      await navigate(page, 'Coaches');
      await page.locator('.admin-coach-card').first().click();
      await page.getByRole('dialog').waitFor();
      await layout(page);
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });

      await navigate(page, 'Institutions');
      await page.locator('.admin-institution-card').last().click();
      await page.getByText('No active Klass assigned.', { exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });

      await navigate(page, 'Approvals');
      await page.getByRole('button', { name: 'Approve Syllabus', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Approve Syllabus', exact: true }).isDisabled(), true);
      await page.getByRole('button', { name: 'Status: All statuses', exact: true }).click();
      await page.getByRole('button', { name: 'Approved', exact: true }).click();
      assert.equal(await page.locator('tbody tr').count(), 2);

      await navigate(page, 'Inquiries');
      await page.locator('tbody tr').filter({ hasText: inquiryName }).getByRole('button', { name: 'Open', exact: true }).click();
      await page.getByRole('button', { name: 'Mark contacted', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Mark resolved', exact: true }).waitFor();
      assert.equal((await sql`SELECT status FROM inquiries WHERE id = ${fixtureId}`)[0].status, 'Contacted');
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      const csv = await download(page, () => page.getByRole('button', { name: 'Export', exact: true }).click());
      assert.ok(csv.includes(inquiryName));
      assert.match(csv, /Contacted/);

      await navigate(page, 'Students');
      await page.locator('.admin-student-card').first().click();
      const studentCsv = await download(page, () => page.getByRole('dialog').getByRole('button', { name: 'Report', exact: true }).click());
      assert.match(studentCsv, /Alicia Tan/);
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });

      await navigate(page, 'Reports');
      const report = await download(page, () => page.getByRole('button', { name: 'Download report', exact: true }).click());
      assert.match(report, /Attendance/);
      await page.getByRole('radio', { name: 'Certificate', exact: true }).check();
      const certificate = await download(page, () => page.getByRole('button', { name: 'Download sample certificate', exact: true }).click());
      assert.match(certificate, /SAMPLE \/ DEMO DATA/);

      await navigate(page, 'Broadcast');
      await page.getByRole('textbox', { name: 'Subject', exact: true }).fill('Coach planning');
      await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Please review the next learning cycle.');
      await navigate(page, 'Overview');
      await navigate(page, 'Broadcast');
      assert.equal(await page.getByRole('textbox', { name: 'Subject', exact: true }).inputValue(), 'Coach planning');
      await page.getByRole('checkbox', { name: 'Email', exact: true }).uncheck();
      await page.getByRole('checkbox', { name: 'Portal', exact: true }).uncheck();
      await page.getByRole('button', { name: 'Prepare broadcast', exact: true }).click();
      await page.getByText('Select at least one delivery channel.', { exact: true }).waitFor();
      await page.getByRole('checkbox', { name: 'Portal', exact: true }).check();
      const broadcast = JSON.parse(await download(page, () => page.getByRole('button', { name: 'Prepare broadcast', exact: true }).click()));
      assert.equal(broadcast.sent, false);
      assert.equal(broadcast.subject, 'Coach planning');
      await page.screenshot({ path: join(screenshots, `broadcast-${width}.png`), fullPage: true });

      await navigate(page, 'Klass');
      await page.getByRole('button', { name: 'Add Klass', exact: true }).click();
      const form = page.getByRole('dialog', { name: 'Add Klass', exact: true });
      const catalogName = `Admin class fixture ${fixtureId}`; catalogNames.push(catalogName);
      await form.getByRole('textbox', { name: 'Klass title' }).fill(catalogName);
      await form.getByRole('button', { name: 'Institution: Independent / KRYAcademia', exact: true }).click();
      await form.getByRole('button', { name: 'Xin Zhong School', exact: true }).click();
      await form.getByRole('textbox', { name: 'Category' }).fill('STEAM');
      await form.getByRole('textbox', { name: 'Schedule', exact: true }).fill('Saturday, 10:00');
      await form.getByRole('textbox', { name: 'Description' }).fill('A hands-on robotics experience.');
      await form.getByRole('button', { name: 'Delivery mode: Online', exact: true }).click();
      await form.getByRole('button', { name: 'Onsite', exact: true }).click();
      await page.screenshot({ path: join(screenshots, `record-form-${width}.png`) });
      await form.getByRole('button', { name: 'Add Klass', exact: true }).click();
      await form.waitFor({ state: 'hidden' });
      assert.equal(await page.locator('.admin-klass-card').count(), 7);
      await navigate(page, 'Overview');
      assert.equal(await page.locator('.admin-metric').first().locator(':scope > strong').innerText(), '7');
      await layout(page);
      await context.close();
      await sql.begin(async (tx) => {
        const [row] = await tx`SELECT content FROM academy_catalog WHERE id = 1 FOR UPDATE`;
        row.content.klasses = row.content.klasses.filter((item) => item.title !== catalogName);
        await tx`UPDATE academy_catalog SET content = ${sql.json(row.content)} WHERE id = 1`;
      });
      console.log(`Admin interaction and layout checks passed at ${width}px.`);
    }
    assert.deepEqual(errors, [], 'Browser runtime errors');
    console.log(`Screenshots: ${screenshots}`);
  } finally {
    await browser.close();
    if (fixtureIds.length) await sql`DELETE FROM inquiries WHERE id IN ${sql(fixtureIds)}`;
    if (catalogNames.length) await sql.begin(async (tx) => {
      const [row] = await tx`SELECT content FROM academy_catalog WHERE id = 1 FOR UPDATE`;
      row.content.klasses = row.content.klasses.filter((item) => !catalogNames.includes(item.title));
      await tx`UPDATE academy_catalog SET content = ${sql.json(row.content)} WHERE id = 1`;
    });
    await sql.end();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
