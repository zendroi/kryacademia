const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { mkdirSync } = require('node:fs');
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000';

// Run after npm run build and node work/serve-export.cjs.
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  mkdirSync('work/qa', { recursive: true });
  try {
    for (const width of [360, 390, 720, 768, 1024, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(baseUrl);
      await page.getByRole('button', { name: 'View Klass Details', exact: true }).first().waitFor();
      const next = page.getByRole('button', { name: 'Next upcoming program', exact: true });
      const previous = page.getByRole('button', { name: 'Previous upcoming program', exact: true });
      const initialTitle = await page.locator('.hero-slide-copy strong').innerText();
      const slideCount = await page.locator('.hero-art-media img').count();
      for (let i = 1; i <= slideCount; i++) {
        await next.click();
        const image = page.locator('.hero-art-media img.active');
        assert.match(await image.getAttribute('alt'), new RegExp(await page.locator('.hero-slide-copy strong').innerText()));
        assert.equal(await image.getAttribute('aria-hidden'), 'false');
      }
      assert.equal(await page.locator('.hero-slide-copy strong').innerText(), initialTitle);
      await previous.focus();
      await page.keyboard.press('Enter');
      assert.notEqual(await page.locator('.hero-slide-copy strong').innerText(), initialTitle);
      assert.equal(await page.locator('.hero-slide-controls span').count(), 0);
      assert.ok(await page.locator('.hero-slide-controls').evaluate(controls => {
        const card = document.querySelector('.hero-art-card').getBoundingClientRect();
        const image = document.querySelector('.hero-art-media').getBoundingClientRect();
        return [...controls.querySelectorAll('button')].every(button => {
          const rect = button.getBoundingClientRect();
          const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
          return center.x >= image.x && center.x <= image.right && center.y >= image.y && center.y <= image.bottom &&
            !(center.x >= card.x && center.x <= card.right && center.y >= card.y && center.y <= card.bottom);
        });
      }), `hero controls overlay image outside card at ${width}px`);
      const sdgSize = await page.locator('.why-sdgs-figure').evaluate(figure => {
        const intro = document.querySelector('.why-intro').getBoundingClientRect();
        const rect = figure.getBoundingClientRect();
        return { width: rect.width, withinContent: rect.left >= intro.left - 1 && rect.right <= intro.right + 1 };
      });
      assert.ok(sdgSize.width <= 901 && sdgSize.withinContent, `SDG size at ${width}px: ${JSON.stringify(sdgSize)}`);
      if (width > 1050) {
        assert.ok(await page.locator('.navbar > nav a').first().evaluate(e => parseFloat(getComputedStyle(e).fontSize) >= 12));
        assert.ok(await page.locator('.brand strong').first().evaluate(e => parseFloat(getComputedStyle(e).fontSize) >= 20));
      }
      if (width <= 720) {
        await page.evaluate(() => scrollTo(0, 500));
        await page.waitForTimeout(100);
        assert.match(await page.locator('.navbar').evaluate(e => getComputedStyle(e).backgroundImage), /linear-gradient/);
        assert.equal(await page.locator('.navbar').evaluate(e => getComputedStyle(e).boxShadow), 'none');
      }
      for (const selector of ['.klassgrid', '.programgrid', '.agenda-calendar']) {
        const expected = width <= 720 ? 1 : selector === '.klassgrid' && width > 1050 ? 4 : 2;
        assert.equal(await page.locator(selector).evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length), expected, `${selector} at ${width}px`);
      }
      for (const selector of ['#home', '#klass', '.why-sdgs', '#programs', '#agenda', '#contact', '.footer']) {
        const section = page.locator(selector);
        await section.scrollIntoViewIfNeeded();
        await section.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
        if ([390, 768, 1440].includes(width)) await section.screenshot({ path: `work/qa/responsive-${width}-${selector.replace(/[.#]/g, '')}.png` });
      }
      assert.ok(await page.locator('.program').evaluateAll(cards => cards.every(card => {
        const image = card.querySelector('img').getBoundingClientRect();
        const badge = card.querySelector('small').getBoundingClientRect();
        const hit = document.elementFromPoint(badge.x + badge.width / 2, badge.y + badge.height / 2);
        return badge.x >= image.x && badge.right <= image.right && badge.y >= image.y && badge.bottom <= image.bottom &&
          (badge.y < 0 || badge.y >= innerHeight || hit === card.querySelector('small'));
      })), `program numbers overlay images at ${width}px`);
      if (width <= 720) {
        const edges = await page.locator('.why-sdgs img').evaluate(e => ({ left: e.getBoundingClientRect().left, right: innerWidth - e.getBoundingClientRect().right }));
        assert.ok(Math.abs(edges.left - 22) < 1 && Math.abs(edges.right - 22) < 1, JSON.stringify(edges));
      }
      await page.locator('.program').first().click();
      await page.getByRole('dialog').waitFor();
      await page.getByRole('button', { name: 'Close program details' }).click();
      await page.getByRole('button', { name: 'View Klass Details', exact: true }).first().click();
      await page.locator('.klass-dialog[open]').waitFor();
      assert.equal(await page.locator('.klass-teaching-team article').count(), 3);
      const galleryBefore = await page.locator('.klass-gallery-controls span').innerText();
      await page.getByRole('button', { name: 'Next photo' }).click();
      assert.notEqual(await page.locator('.klass-gallery-controls span').innerText(), galleryBefore);
      await page.getByRole('button', { name: 'Close Klass details' }).click();
      assert.equal(await page.locator('.coach-card').count(), 3);
      if (width === 1440) {
        assert.ok(await page.getByRole('link', { name: 'Updates', exact: true }).isVisible());
        await page.locator('.updates-grid').scrollIntoViewIfNeeded();
        const wheelBefore = await page.evaluate(() => ({ top: scrollY, left: document.querySelector('.updates-grid').scrollLeft }));
        const box = await page.locator('.updates-grid').boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(0, 240);
        await page.waitForTimeout(100);
        const wheelAfter = await page.evaluate(() => ({ top: scrollY, left: document.querySelector('.updates-grid').scrollLeft }));
        assert.ok(wheelAfter.top > wheelBefore.top, 'vertical wheel moves page over Updates');
        assert.equal(wheelAfter.left, wheelBefore.left, 'vertical wheel does not move update cards');
        await page.locator('.language-picker select').selectOption('id');
        await page.locator('#klass h2').filter({ hasText: 'Temukan Klass Berikutnya' }).waitFor();
        await page.locator('.language-picker select').selectOption('en');
      }
      assert.equal(await page.locator('#contact').evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(255, 255, 255)');
      assert.equal(await page.locator('#contact h2').evaluate(e => getComputedStyle(e).color), 'rgb(23, 48, 81)');
      if (width > 720 && width <= 1050) {
        assert.equal(await page.locator('.footer > div').evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length), 2);
        await page.locator('.footer').scrollIntoViewIfNeeded();
        assert.ok(await page.locator('.footer').isVisible(), `footer visible at ${width}px`);
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow at ${width}px`);
      await page.close();
      console.log(`${width}px: layout, SDG, dialogs, coaches, contact and overflow passed`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
