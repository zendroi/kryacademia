import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000';
const accounts = [
  ['teacher', process.env.TEACHER_TEST_PASSWORD],
  ['admin', process.env.ADMIN_TEST_PASSWORD],
];
if (accounts.some(([, password]) => !password)) {
  console.log('Skipping auth check: test account passwords are not configured.');
  process.exit(0);
}

async function signIn(page, email, password) {
  await page.goto(`${baseUrl}/login`);
  await page.locator('.page-preloader').waitFor({ state: 'detached' });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
}

const browser = await chromium.launch();
try {
  const invalid = await browser.newPage();
  for (const error of ['__proto__', 'constructor', 'toString', 'unknown']) {
    const response = await invalid.goto(`${baseUrl}/login?error=${error}`);
    assert.equal(response.headers()['x-frame-options'], 'DENY');
    assert.equal(response.headers()['x-content-type-options'], 'nosniff');
    assert.match(response.headers()['content-security-policy'], /frame-ancestors 'none'/);
    await invalid.getByRole('alert').filter({ hasText: 'Email atau password tidak sesuai.' }).waitFor();
    await invalid.getByRole('button', { name: /sign in/i }).waitFor();
  }
  await signIn(invalid, 'teacher@krya.global', 'wrong-password');
  await invalid.waitForURL(/error=invalid/);

  for (const [role, password] of accounts) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await signIn(page, `${role}@krya.global`, password);
    await page.waitForURL(`**/${role}`);
    await page.locator('.page-preloader').waitFor({ state: 'detached' });
    try { await page.getByRole('navigation', { name: role === 'admin' ? 'Admin navigation' : 'Teacher navigation' }).waitFor(); }
    catch (error) { await page.screenshot({ path: join(tmpdir(), `krya-auth-${role}-failure.png`), fullPage: true }); throw new Error(`Portal navigation failed: ${errors.join(' | ')}`, { cause: error }); }
    assert.match(await page.locator('body').innerText(), new RegExp(role === 'admin' ? 'admin workspace' : 'teacher workspace', 'i'));
    await page.goto(`${baseUrl}/${role === 'teacher' ? 'admin' : 'teacher'}`);
    await page.waitForURL(`**/${role}`);
    await page.close();
  }
  console.log('Authentication flow passed.');
} finally {
  await browser.close();
}
