import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
import postgres from 'postgres';
import { chromium } from 'playwright';

const source = await readFile(new URL('../lib/inquiry.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { validateInquiry } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
function validForm(overrides = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: 'Inquiry check', email: 'check@example.com', phone: '+62 812 3456 7890', place: 'Surabaya', type: 'Other', affiliation: 'Parent', request: 'Class availability', message: 'Please share the schedule.', language: 'en', consent: 'yes', ...overrides })) form.set(key, value);
  return form;
}
assert.deepEqual(validateInquiry(validForm()).fields, []);
for (const [key, value] of [['email', 'not-an-email'], ['phone', '123'], ['type', 'Bogus'], ['affiliation', 'Bogus'], ['language', 'xx'], ['consent', 'no'], ['message', 'x'.repeat(5001)]]) assert.ok(validateInquiry(validForm({ [key]: value })).fields.includes(key), `${key} must be rejected`);
for (const [type, field] of [['Klass', 'klass'], ['Program', 'program'], ['School Partnership', 'school-level']]) assert.ok(validateInquiry(validForm({ type })).fields.includes(field));
assert.ok(validateInquiry(validForm({ affiliation: 'Institution' })).fields.includes('institution'));
console.log('Inquiry validation checks passed.');

if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET) throw new Error('DATABASE_URL and SESSION_SECRET are required for browser checks.');
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3001';
const marker = `Inquiry browser check ${randomUUID()}`;
const emails = [];
const sql = postgres(process.env.DATABASE_URL, { ssl: process.env.DATABASE_URL.includes('localhost') ? false : 'require' });
const screenshots = join(tmpdir(), 'kryacademia-inquiry-check');
const errors = [];
const browser = await chromium.launch();
function session(role) {
  const payload = Buffer.from(JSON.stringify({ email: `${role}@krya.global`, role, exp: Date.now() + 3600000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', process.env.SESSION_SECRET).update(payload).digest('base64url')}`;
}
async function choose(page, name, value) {
  await page.locator(`#contact input[name="${name}"]`).locator('..').getByRole('button').click();
  await page.locator('.smooth-dropdown-menu').getByRole('button', { name: value, exact: true }).click();
}
async function navigateInquiries(page) {
  await page.waitForLoadState('networkidle');
  await page.locator('.admin-topbar').waitFor();
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation', { name: 'Admin navigation' }).getByRole('button', { name: /^Inquiries/ }).click();
  await page.getByRole('heading', { name: 'Inquiry List', exact: true }).waitFor();
}
async function layout(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Horizontal page overflow');
}
async function replay(request, ctx, overrides = {}, url = '/') {
  const form = await new Request(request.url(), { method: 'POST', headers: { 'content-type': request.headers()['content-type'] }, body: request.postDataBuffer() }).formData();
  const prefix = [...form.keys()].find((key) => key.endsWith('submission-id')).slice(0, -'submission-id'.length);
  const args = form.get('0'); form.delete('0');
  for (const [key, value] of Object.entries(overrides)) form.set(`${prefix}${key}`, value);
  form.set('0', args);
  const body = new Request(`${baseUrl}${url}`, { method: 'POST', body: form });
  const headers = { ...request.headers(), 'content-type': body.headers.get('content-type'), origin: baseUrl };
  delete headers['content-length'];
  const response = await ctx.request.post(`${baseUrl}${url}`, {
    headers,
    data: Buffer.from(await body.arrayBuffer()),
  });
  return response.text();
}
try {
  await mkdir(screenshots, { recursive: true });
  for (const width of [1440, 390, 360]) {
    const ctx = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: width === 360 ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${baseUrl}/#contact`);
    await page.locator('.page-preloader').waitFor({ state: 'detached' });
    const form = page.locator('#contact form');
    await form.getByRole('button', { name: 'Send Inquiry', exact: true }).click();
    await form.getByRole('alert').waitFor();
    const email = `inquiry-${randomUUID()}@example.com`; emails.push(email);
    const name = `${marker} ${width}`;
    for (const [key, value] of Object.entries({ name, email, phone: '+62 812 3456 7890', place: 'Surabaya / Indonesia', message: 'Could you share the schedule?\n<script>window.inquiryInjected = true</script>' })) await form.locator(`[name="${key}"]`).fill(value);
    const type = width === 1440 ? 'School Partnership' : width === 390 ? 'Klass' : 'Program';
    await choose(page, 'type', type);
    await choose(page, 'affiliation', width === 1440 ? 'Institution' : width === 390 ? 'Parent' : 'Non-institution');
    if (width === 1440) {
      await form.locator('[name="institution"]').fill('Test institution');
      await form.locator('[name="school-level"]').fill('High school');
    } else if (width === 390) {
      await choose(page, 'klass', 'Digitechnology Coding Klass');
      await choose(page, 'mode', 'Onsite');
    } else await choose(page, 'program', 'Custom Program');
    await form.getByRole('checkbox').check();
    const waitRequest = page.waitForRequest((request) => request.method() === 'POST' && Boolean(request.headers()['next-action']));
    await form.getByRole('button', { name: 'Send Inquiry', exact: true }).click();
    const request = await waitRequest;
    await page.getByText('Inquiry received. Our team will follow up with you.', { exact: true }).waitFor();
    const [saved] = await sql`SELECT * FROM inquiries WHERE email = ${email}`;
    assert.equal(saved.name, name); assert.equal(saved.status, 'New'); assert.equal(saved.language, 'en');
    if (width === 1440) assert.equal(saved.details.schoolLevel, 'High school');
    if (width === 390) assert.equal(saved.details.mode, 'Onsite');
    assert.match(await replay(request, ctx), /"ok":true/, 'An identical retry should succeed');
    assert.equal((await sql`SELECT count(*)::int AS count FROM inquiries WHERE email = ${email}`)[0].count, 1, 'Retry duplicated the inquiry');
    assert.match(await replay(request, ctx, { 'submission-id': randomUUID(), consent: 'no' }), /"error":"validation"/);
    assert.match(await replay(request, ctx, { 'submission-id': randomUUID(), email: 'invalid-email' }), /"error":"validation"/);
    assert.match(await replay(request, ctx, { 'submission-id': randomUUID(), language: 'xx' }), /"error":"validation"/);
    assert.match(await replay(request, ctx, { 'submission-id': randomUUID(), website: 'spam' }), /"error":"validation"/);
    assert.match(await replay(request, ctx, { 'submission-id': saved.id, message: 'Changed payload' }), /"error":"validation"/);
    if (width === 1440) {
      for (const extraType of ['Workshop', 'Event', 'Other']) assert.match(await replay(request, ctx, { 'submission-id': randomUUID(), name: `Quota ${marker}`, type: extraType, request: `${extraType} details` }), /"ok":true/);
      assert.match(await replay(request, ctx, { 'submission-id': randomUUID(), name: `Quota ${marker}` }), /"ok":true/);
      assert.match(await replay(request, ctx, { 'submission-id': randomUUID() }), /"error":"rateLimit"/);
      assert.equal((await sql`SELECT count(*)::int AS count FROM inquiries WHERE email = ${email}`)[0].count, 5);
    }
    await layout(page);
    await form.evaluate((element) => window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 90 }));
    await page.screenshot({ path: join(screenshots, `form-${width}.png`) });

    // Simulate a failed network request: no false success and no cleared form values.
    await form.locator('[name="message"]').fill('Retry must preserve this message.');
    if (width === 360) await form.locator('[name="name"]').fill(`Retry ${marker}`);
    const fail = async (route) => {
      if (!route.request().headers()['next-action']) return route.continue();
      // Lose the response after the database saves, then retry through the real form.
      if (width === 360) await route.fetch();
      await route.abort();
    };
    await page.route(`${baseUrl}/`, fail);
    await form.getByRole('button', { name: 'Send Inquiry', exact: true }).click();
    await form.getByRole('alert').filter({ hasText: 'Could not send' }).waitFor();
    assert.equal(await form.locator('[name="message"]').inputValue(), 'Retry must preserve this message.');
    await page.unroute(`${baseUrl}/`, fail);
    if (width === 360) {
      assert.equal((await sql`SELECT count(*)::int AS count FROM inquiries WHERE email = ${email}`)[0].count, 2);
      await form.getByRole('button', { name: 'Send Inquiry', exact: true }).click();
      await page.getByText('Inquiry received. Our team will follow up with you.', { exact: true }).waitFor();
      assert.equal((await sql`SELECT count(*)::int AS count FROM inquiries WHERE email = ${email}`)[0].count, 2, 'Lost response retry must not duplicate');
    }

    await ctx.addCookies([{ name: 'krya_session', value: session('admin'), url: baseUrl }]);
    await page.goto(`${baseUrl}/admin`);
    await page.locator('.page-preloader').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Notifications', exact: true }).click();
    await page.locator('.admin-notifications').getByText(`New inquiry: ${name}`, { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close notifications', exact: true }).first().click();
    await navigateInquiries(page);
    await page.getByRole('textbox', { name: 'Search current section' }).fill(name);
    let row = page.locator('tbody tr').filter({ hasText: name });
    await row.getByRole('button', { name: 'Open', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'inquiry details' });
    await dialog.getByText(saved.message, { exact: true }).waitFor();
    assert.equal(await dialog.locator('script').count(), 0);
    assert.equal(await page.evaluate(() => Boolean(window.inquiryInjected)), false);
    assert.equal(await dialog.getByRole('link', { name: '+62 812 3456 7890' }).getAttribute('href'), 'https://wa.me/6281234567890');
    await page.screenshot({ path: join(screenshots, `admin-detail-${width}.png`) });
    await layout(page);
    const statusRequest = page.waitForRequest((request) => request.method() === 'POST' && Boolean(request.headers()['next-action']));
    await dialog.getByRole('button', { name: 'Mark contacted', exact: true }).click();
    const updateRequest = await statusRequest;
    await dialog.getByRole('button', { name: 'Mark resolved', exact: true }).waitFor();
    assert.equal((await sql`SELECT status FROM inquiries WHERE id = ${saved.id}`)[0].status, 'Contacted');

    const forbidden = await browser.newContext();
    for (const role of ['anonymous', 'teacher']) {
      if (role === 'teacher') await forbidden.addCookies([{ name: 'krya_session', value: session(role), url: baseUrl }]);
      const response = await forbidden.request.post(`${baseUrl}/admin`, { headers: { 'next-action': updateRequest.headers()['next-action'], 'content-type': 'text/plain;charset=UTF-8', origin: baseUrl }, data: JSON.stringify([saved.id, 'Resolved']) });
      assert.match(response.headers()['x-action-redirect'] || '', role === 'teacher' ? /\/teacher/ : /\/login/);
      assert.equal((await sql`SELECT status FROM inquiries WHERE id = ${saved.id}`)[0].status, 'Contacted');
    }
    await forbidden.close();
    const invalidStatus = await ctx.request.post(`${baseUrl}/admin`, { headers: { 'next-action': updateRequest.headers()['next-action'], 'content-type': 'text/plain;charset=UTF-8', origin: baseUrl }, data: JSON.stringify([saved.id, 'Bogus']) });
    assert.match(await invalidStatus.text(), /Invalid inquiry status/);
    await dialog.getByRole('button', { name: 'Mark resolved', exact: true }).click();
    await dialog.getByRole('button', { name: 'Resolved', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.reload();
    await page.locator('.page-preloader').waitFor({ state: 'detached' });
    await navigateInquiries(page);
    await page.getByRole('textbox', { name: 'Search current section' }).fill(name);
    row = page.locator('tbody tr').filter({ hasText: name });
    await row.locator('.status-resolved').waitFor();
    assert.equal((await sql`SELECT status FROM inquiries WHERE id = ${saved.id}`)[0].status, 'Resolved');
    await page.getByRole('button', { name: 'Refresh inbox', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Inquiry inbox refreshed.' }).waitFor();
    if (width === 390) {
      const newName = `${marker} refreshed`;
      assert.match(await replay(request, ctx, { 'submission-id': randomUUID(), name: newName, language: 'id' }), /"ok":true/);
      assert.equal((await sql`SELECT language FROM inquiries WHERE name = ${newName}`)[0].language, 'id');
      await page.getByRole('textbox', { name: 'Search current section' }).fill(newName);
      await page.getByText('No matching records', { exact: true }).waitFor();
      const refreshRequest = page.waitForRequest((request) => request.method() === 'POST' && Boolean(request.headers()['next-action']));
      await page.getByRole('button', { name: 'Refresh inbox', exact: true }).click();
      const refreshAction = await refreshRequest;
      await page.locator('tbody tr').filter({ hasText: newName }).waitFor();
      const reader = await browser.newContext();
      await reader.addCookies([{ name: 'krya_session', value: session('teacher'), url: baseUrl }]);
      const denied = await reader.request.post(`${baseUrl}/admin`, { headers: { 'next-action': refreshAction.headers()['next-action'], 'content-type': 'text/plain;charset=UTF-8', origin: baseUrl }, data: '[]' });
      assert.match(denied.headers()['x-action-redirect'] || '', /\/teacher/);
      assert.equal((await denied.text()).includes(email), false, 'Teacher must not receive inbox data');
      await reader.close();
    }
    await layout(page);
    await page.screenshot({ path: join(screenshots, `admin-inbox-${width}.png`) });
    await ctx.close();
    console.log(`Inquiry submit, retry, quota, access, status persistence, and layout passed at ${width}px.`);
  }
  assert.deepEqual(errors, [], 'Browser runtime errors');
  console.log(`Screenshots: ${screenshots}`);
} finally {
  await browser.close();
  if (emails.length) await sql`DELETE FROM inquiries WHERE email IN ${sql(emails)}`;
  await sql.end();
}
