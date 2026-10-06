import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:3001';
const screenshots = join(tmpdir(), 'kryacademia-preloader-check');
const accounts = [['teacher', process.env.TEACHER_TEST_PASSWORD], ['admin', process.env.ADMIN_TEST_PASSWORD]];
assert(accounts.every(([, password]) => password), 'Configure the test account passwords');
await mkdir(screenshots, { recursive: true });

async function ready(page) {
  await page.locator('.page-preloader').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.page-render-content').evaluate((element) => element.inert), false);
}

async function holdAction(page) {
  let release;
  let received;
  const gate = new Promise((resolve) => { release = resolve; });
  const intercepted = new Promise((resolve) => { received = resolve; });
  const handler = async (route) => {
    if (route.request().method() !== 'POST' || !route.request().headers()['next-action']) return route.fallback();
    received();
    await gate;
    await route.continue();
  };
  await page.route('**/*', handler);
  return { intercepted, release, clean: () => page.unroute('**/*', handler) };
}

async function openNavigation(page, width) {
  if (width < 1000 && !(await page.locator('.admin-sidebar.is-open').count())) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
}

const browser = await chromium.launch();
try {
  for (const [width, reducedMotion] of [[1440, 'no-preference'], [390, 'reduce']]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));

    let releaseScripts;
    const scripts = new Promise((resolve) => { releaseScripts = resolve; });
    const blockScripts = async (route) => { await scripts; await route.continue(); };
    await page.route(/\/_next\/static\/.*\.js/, blockScripts);
    await page.goto(`${base}/login`, { waitUntil: 'commit' });
    await page.locator('.page-preloader').waitFor({ state: 'visible' });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.page-preloader')).position === 'fixed');
    assert.deepEqual(await page.locator('.page-preloader-brand img').evaluate((element) => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })), { width: 38, height: 42 });
    assert.equal(await page.locator('.page-preloader-words > span').evaluate((element) => getComputedStyle(element).opacity), '1', 'The first word must be visible before hydration');
    await page.screenshot({ path: join(screenshots, `initial-${width}.png`) });
    releaseScripts();
    await page.unrouteAll({ behavior: 'wait' });
    await ready(page);

    for (let attempt = 0; attempt < 2; attempt++) {
      await page.getByLabel('Email address').fill('teacher@krya.global');
      await page.getByLabel('Password').fill('wrong-password');
      const action = await holdAction(page);
      await page.getByRole('button', { name: /sign in/i }).click();
      await action.intercepted;
      await page.locator('.page-preloader').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.page-render-content').evaluate((element) => element.inert), true);
      if (attempt === 0 && reducedMotion === 'no-preference') {
        await page.waitForFunction(() => document.querySelector('.page-preloader-words')?.textContent.includes('Creating'));
        await page.screenshot({ path: join(screenshots, `words-${width}.png`) });
        await page.waitForFunction(() => document.querySelector('.page-preloader-words')?.textContent.includes('Dedicating'));
      }
      action.release();
      await page.waitForURL(/error=invalid/);
      await ready(page);
      await action.clean();
      await page.getByRole('alert').filter({ hasText: 'Email atau password' }).waitFor();
    }

    await page.route('**/*', (route) => route.request().headers()['next-router-prefetch'] ? route.abort() : route.fallback());
    for (const [role, password] of accounts) {
      await page.getByLabel('Email address').fill(`${role}@krya.global`);
      await page.getByLabel('Password').fill(password);
      const login = await holdAction(page);
      await page.getByRole('button', { name: /sign in/i }).click();
      await login.intercepted;
      await page.locator('.page-preloader').waitFor({ state: 'visible' });
      login.release();
      await page.waitForURL(`**/${role}`);
      await ready(page);
      await login.clean();
      assert.equal(await page.locator('.page-preloader').count(), 0);

      if (role === 'teacher') {
        const refresh = await holdAction(page);
        await page.getByRole('button', { name: 'Refresh workspace', exact: true }).click();
        await refresh.intercepted;
        assert.equal(await page.locator('.page-preloader').count(), 0, 'Local dashboard updates must not cover the page');
        refresh.release();
        await page.getByRole('button', { name: 'Refresh workspace', exact: true }).waitFor({ state: 'visible' });
        await page.waitForFunction(() => !document.querySelector('[aria-label="Refresh workspace"]').disabled);
        await refresh.clean();

        await openNavigation(page, width);
        let releaseNavigation;
        let navigationStarted;
        const navigationGate = new Promise((resolve) => { releaseNavigation = resolve; });
        const navigationReceived = new Promise((resolve) => { navigationStarted = resolve; });
        const navigationHandler = async (route) => {
          if (!route.request().headers().rsc || new URL(route.request().url()).pathname !== '/' || route.request().headers()['next-router-prefetch']) return route.fallback();
          navigationStarted();
          await navigationGate;
          await route.continue();
        };
        await page.route('**/*', navigationHandler);
        await page.getByRole('link', { name: 'Website', exact: true }).click();
        await navigationReceived;
        await page.locator('.page-preloader').waitFor({ state: 'visible', timeout: 10000 });
        releaseNavigation();
        await page.waitForURL(`${base}/`);
        await ready(page);
        await page.unroute('**/*', navigationHandler);
        await page.goto(`${base}/teacher`);
        await ready(page);
        await openNavigation(page, width);
        await page.getByRole('navigation', { name: 'Teacher navigation' }).getByRole('button', { name: 'Lesson Plans', exact: true }).click();
        await page.getByLabel('Title *', { exact: true }).fill('Unsaved preloader check');
        await openNavigation(page, width);
        page.once('dialog', (dialog) => dialog.dismiss());
        await page.getByRole('link', { name: 'Website', exact: true }).click();
        assert.equal(new URL(page.url()).pathname, '/teacher');
        assert.equal(await page.locator('.page-preloader').count(), 0, 'Cancelled navigation must not start the preloader');
        page.once('dialog', (dialog) => dialog.dismiss());
        await page.getByRole('button', { name: 'Log out', exact: true }).click();
        assert.equal(new URL(page.url()).pathname, '/teacher');
        assert.equal(await page.locator('.page-preloader').count(), 0, 'Cancelled logout must preserve the form');
        page.once('dialog', (dialog) => dialog.accept());
      }

      await openNavigation(page, width);
      const logout = await holdAction(page);
      await page.getByRole('button', { name: 'Log out', exact: true }).click();
      await logout.intercepted;
      await page.locator('.page-preloader').waitFor({ state: 'visible' });
      if (reducedMotion === 'reduce') assert.equal(await page.locator('.page-preloader').evaluate((element) => getComputedStyle(element).transform), 'none');
      logout.release();
      await page.waitForURL('**/login');
      await ready(page);
      await logout.clean();
      assert.notEqual(await page.locator('body').evaluate((element) => getComputedStyle(element).overflow), 'hidden', 'Logout must restore scrolling after the mobile menu closes');
    }

    await page.goto(`${base}/#contact`);
    await ready(page);
    const dropdown = page.locator('.contact .form-dropdown').first();
    await dropdown.getByRole('button').click();
    const option = page.locator('.smooth-dropdown-menu').getByRole('button', { name: 'Workshop', exact: true });
    await option.click();
    assert.match(await dropdown.innerText(), /Workshop/);
    assert.equal(await page.locator('.page-preloader').count(), 0);
    await page.locator('.contact').getByRole('button', { name: /send inquiry/i }).click();
    assert.equal(await page.locator('.page-preloader').count(), 0, 'Inquiry validation must not trigger page loading');
    await page.getByRole('link', { name: 'KRYAcademia home', exact: true }).first().click();
    await page.waitForURL('**/#home');
    assert.equal(await page.locator('.page-preloader').count(), 0, 'Section anchors must not trigger page loading');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`Preloader, login/logout, and shared dropdown passed at ${width}px (${reducedMotion}).`);
  }

  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const page = await noJs.newPage();
  await page.goto(`${base}/login`);
  assert.equal(await page.locator('.page-preloader').isVisible(), false);
  assert.equal(await page.locator('.page-render-content').getAttribute('inert'), null);
  await noJs.close();
  console.log('No-JavaScript fallback passed.');
} finally {
  await browser.close();
}
