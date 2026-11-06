import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright';

// Called only with the disposable database created by hostinger-data-check.mjs.
export async function hostingerBrowserCheck(sql, databaseURL, password, identityId) {
  assert.match(new URL(databaseURL).pathname, /^\/hostinger_check_[a-f0-9]{32}$/);
  const listener = createServer();
  await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const env = { ...process.env, DATABASE_URL: databaseURL, BASE_URL: base, VERCEL: '0', SESSION_SECRET: randomBytes(32).toString('hex'), ADMIN_TEST_PASSWORD: password, TEACHER_TEST_PASSWORD: password };
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port), '--hostname', '127.0.0.1'], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; let browser;
  for (const stream of [server.stdout, server.stderr]) stream.on('data', (chunk) => { output = (output + chunk).slice(-6000); });
  try {
    let ready = false;
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      if (server.exitCode !== null) throw new Error('Test server exited.');
      try { if ((await fetch(`${base}/login`, { signal: AbortSignal.timeout(3000) })).ok) { ready = true; break; } } catch { /* Startup only. */ }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.ok(ready, 'MySQL app must start');
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['tests/auth-check.mjs'], { env, windowsHide: true, stdio: 'inherit' });
      child.once('error', reject); child.once('exit', (code) => code === 0 ? resolve() : reject(new Error('MySQL auth check failed')));
    });
    browser = await chromium.launch();
    const admin = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const teacher = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const errors = [];
    for (const page of [admin, teacher]) page.on('pageerror', (error) => errors.push(error.message));
    async function login(page, role) {
      await page.goto(`${base}/login`);
      await page.locator('.page-preloader').waitFor({ state: 'detached' });
      await page.getByLabel('Email').fill(`${role}@krya.global`);
      await page.getByLabel('Password', { exact: true }).fill(password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(`**/${role}`);
      await page.locator('.page-preloader').waitFor({ state: 'detached' });
    }
    await login(admin, 'admin'); await login(teacher, 'teacher');
    const cookieHeaders = async (page) => ({ cookie: (await page.context().cookies()).map(({ name, value }) => `${name}=${value}`).join('; ') });
    const identityPath = `${base}/api/teacher-identities/${identityId}`;
    assert.equal((await fetch(identityPath)).status, 401);
    assert.equal((await teacher.request.get(identityPath, { headers: await cookieHeaders(teacher) })).status(), 404);
    assert.equal((await admin.request.get(identityPath, { headers: await cookieHeaders(admin) })).status(), 200);
    await admin.getByRole('navigation', { name: 'Admin navigation' }).getByRole('button', { name: 'Teacher accounts', exact: true }).click();
    await admin.getByLabel('Teacher name', { exact: true }).fill('MySQL Fixture Coach');
    await admin.getByLabel('Teacher login email').fill('mysql-fixture@example.com');
    await admin.getByLabel('Initial password (15+ characters)').fill(password);
    await admin.getByRole('button', { name: 'Create account & invitation' }).click();
    await admin.getByLabel('Registration invitation', { exact: true }).waitFor();
    const account = admin.locator('.teacher-account-row').filter({ hasText: 'mysql-fixture@example.com' });
    await account.locator('summary').click();
    await account.getByRole('button', { name: 'Renew registration invitation' }).waitFor();
    assert.equal((await sql`SELECT status FROM portal_users WHERE email='mysql-fixture@example.com'`)[0].status, 'pending');
    await account.getByRole('button', { name: 'Approve', exact: true }).click();
    await admin.getByRole('alert').filter({ hasText: 'complete their identity' }).waitFor();
    assert.equal((await sql`SELECT status FROM portal_users WHERE email='mysql-fixture@example.com'`)[0].status, 'pending');
    await teacher.getByRole('navigation', { name: 'Teacher navigation' }).getByRole('button', { name: /^Class Requests/ }).click();
    await teacher.getByRole('button', { name: 'Request timeframe: Before class', exact: true }).click();
    await teacher.getByRole('button', { name: 'Before semester', exact: true }).click();
    await teacher.getByLabel('Title *', { exact: true }).fill('MySQL browser request');
    await teacher.getByLabel('Item 1 name', { exact: true }).fill('Science tools');
    await teacher.getByLabel('Item 1 quantity', { exact: true }).fill('1 set');
    await teacher.getByLabel('Purpose & classroom needs').fill('Prepare the next semester.');
    await teacher.getByRole('button', { name: 'Submit record', exact: true }).click();
    await teacher.getByRole('status').filter({ hasText: 'Submitted successfully.' }).waitFor();
    await admin.reload();
    await admin.locator('.page-preloader').waitFor({ state: 'detached' });
    await admin.getByRole('navigation', { name: 'Admin navigation' }).getByRole('button', { name: /^Approvals/ }).click();
    await admin.locator('.teacher-review-row').filter({ hasText: 'MySQL browser request' }).getByRole('button', { name: /Review/ }).click();
    await admin.getByLabel('Admin note', { exact: true }).fill('Verified on MySQL');
    await admin.getByRole('button', { name: 'Save review', exact: true }).click();
    await admin.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal((await sql`SELECT status FROM teaching_records WHERE title='MySQL browser request'`)[0].status, 'Approved');
    assert.deepEqual(errors, []);
    console.log('MySQL browser: login, role redirects, private KTP access, pending onboarding guard, teacher request and admin approval passed.');
  } catch (error) { throw new Error(`${error.message}\nTest server: ${output}`, { cause: error }); }
  finally { if (browser) await browser.close(); server.kill(); await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once('exit', resolve)); }
}
