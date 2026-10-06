import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000';
const accounts = [
  ['teacher', process.env.TEACHER_TEST_PASSWORD],
  ['admin', process.env.ADMIN_TEST_PASSWORD],
];
if (accounts.some(([, password]) => !password)) throw new Error('Test account passwords are not configured');

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
  await signIn(invalid, 'teacher@krya.global', 'wrong-password');
  await invalid.waitForURL(/error=invalid/);

  for (const [role, password] of accounts) {
    const page = await browser.newPage();
    await signIn(page, `${role}@krya.global`, password);
    await page.waitForURL(`**/${role}`);
    await page.locator('.page-preloader').waitFor({ state: 'detached' });
    assert.match(await page.locator('body').innerText(), new RegExp(role === 'admin' ? 'admin workspace' : 'teacher workspace', 'i'));
    await page.goto(`${baseUrl}/${role === 'teacher' ? 'admin' : 'teacher'}`);
    await page.waitForURL(`**/${role}`);
    await page.close();
  }
  console.log('Authentication flow passed.');
} finally {
  await browser.close();
}
