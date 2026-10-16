import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { chromium } from 'playwright';
import { fixtureSession, clearFixtureSessions } from './session-fixture.mjs';

if (!process.env.PORTAL_TEST_SCHEMA?.startsWith('security_check_') || new URL(process.env.DATABASE_URL).searchParams.get('options') !== `-c search_path=${process.env.PORTAL_TEST_SCHEMA},public`) throw new Error('Upload concurrency checks require an isolated security schema.');
const sql = postgres(process.env.DATABASE_URL, { ssl: process.env.DATABASE_URL.includes('localhost') ? false : 'verify-full', max: 1 });
const base = process.env.BASE_URL;
const ids = [];
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
  await context.addCookies([{ name: 'krya_session', value: await fixtureSession(sql, 'admin@krya.global', 'admin'), url: base }]);
  const page = await context.newPage(); page.setDefaultTimeout(45000);
  await page.goto(`${base}/admin`); await page.locator('.page-preloader').waitFor({ state: 'detached' });
  await page.getByRole('navigation', { name: 'Admin navigation' }).getByRole('button', { name: /^Institutions/ }).click();
  await page.getByRole('button', { name: 'Add institution', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Add institution' });
  await form.getByLabel('Name', { exact: true }).fill('Concurrent upload fixture');
  await form.getByLabel('City', { exact: true }).fill('Surabaya');
  await form.getByLabel('Institution logo', { exact: true }).setInputFiles('public/klass/biotechnology-xin-zhong.webp');
  await form.getByText(/biotechnology-xin-zhong\.webp \/ \d+ KB/).waitFor();
  const capture = page.waitForRequest((request) => request.method() === 'POST' && request.headers()['next-action']);
  await form.getByRole('button', { name: 'Add institution', exact: true }).click();
  const request = await capture;
  const original = JSON.parse(request.postData()); ids.push(original[3].createId);
  await form.waitFor({ state: 'detached' });
  const headers = { ...request.headers(), origin: base }; delete headers['content-length'];
  const replies = await Promise.all(Array.from({ length: 6 }, (_, index) => {
    const args = structuredClone(original); args[3].createId = randomUUID(); ids.push(args[3].createId);
    args[3].name = `Concurrent upload fixture ${index}`;
    return context.request.post(`${base}/admin`, { headers, data: JSON.stringify(args), timeout: 180000 });
  }));
  for (const reply of replies) assert.match(await reply.text(), /"ok":true/, 'A concurrent upload failed or exhausted the connection pool');
  const images = await sql`SELECT f.object_id, f.bytes FROM institutions i JOIN academy_images f ON i.logo = '/api/academy-images/' || f.id::text WHERE i.id IN ${sql(ids)}`;
  assert.equal(images.length, 7); assert.ok(images.every((file) => file.object_id && file.bytes === null));
  const key = `catalog:upload:${createHmac('sha256', process.env.SESSION_SECRET).update('admin@krya.global').digest('hex')}`;
  const beforeQuota = (await sql`SELECT count(*)::int AS count FROM portal_file_objects`)[0].count;
  await sql`UPDATE portal_rate_limits SET attempts = 20, window_start = NOW() WHERE key = ${key}`;
  try {
    const args = structuredClone(original); args[3].createId = randomUUID(); ids.push(args[3].createId);
    const reply = await context.request.post(`${base}/admin`, { headers, data: JSON.stringify(args) });
    assert.match(await reply.text(), /Too many uploads/, 'Admin upload quota must apply before storing files');
    assert.equal((await sql`SELECT count(*)::int AS count FROM portal_file_objects`)[0].count, beforeQuota);
  } finally { await sql`DELETE FROM portal_rate_limits WHERE key = ${key}`; }
  console.log('Six simultaneous admin image uploads completed without pool starvation.');
} finally {
  await browser.close();
  if (ids.length) await sql.begin(async (tx) => {
    const rows = await tx`SELECT logo FROM institutions WHERE id IN ${tx(ids)}`;
    const images = rows.map((row) => row.logo.split('/').at(-1));
    await tx`DELETE FROM institutions WHERE id IN ${tx(ids)}`;
    await tx`DELETE FROM academy_events WHERE entity_id IN ${tx(ids)}`;
    if (images.length) await tx`DELETE FROM academy_images WHERE id IN ${tx(images)}`;
  });
  await clearFixtureSessions(sql); await sql.end();
}
