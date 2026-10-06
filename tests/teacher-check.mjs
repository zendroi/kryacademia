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
async function tamperSave(page, mutate, expected) {
  const handler = async (route) => {
    if (route.request().method() === 'POST' && route.request().headers()['next-action']) {
      const args = JSON.parse(route.request().postData());
      assert.ok(args[0]?.kind, 'Expected a teaching record action');
      mutate(args[0]);
      await route.continue({ postData: JSON.stringify(args) });
    } else await route.continue();
  };
  await page.route('**/teacher', handler);
  try {
    await page.getByRole('button', { name: 'Submit record', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: expected }).waitFor();
  } finally { await page.unroute('**/teacher', handler); }
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
    for (const name of ['Overview', 'Class Workflow', 'Meeting Journal', 'Lesson Plans', 'Semester Preparation', 'Class Requests', 'Notifications']) {
      await navigate(page, name);
      await layout(page);
      await page.screenshot({ path: join(screenshots, `${name.replaceAll(' ', '-')}-${width}.png`), fullPage: true });
    }
    console.log(`Teacher layout passed at ${width}px.`);
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  await navigate(page, 'Semester Preparation');
  await page.getByLabel('Semester start', { exact: true }).fill(testDate);
  await page.getByLabel('Submission deadline', { exact: true }).fill('2032-02-13');
  await page.getByLabel('Title *', { exact: true }).fill(`${testName} syllabus`);
  await page.getByLabel('Main coach *', { exact: true }).fill('Coach browser check');
  await page.getByLabel('Program description').fill('Responsible, hands-on biotechnology investigations.');
  await page.getByLabel('Semester learning objectives').fill('Observe, investigate, and communicate evidence.');
  await page.getByLabel('Projects').fill('Biotechnology advocacy project.');
  await page.getByLabel('Project description').fill('Present scientific findings to peers.');
  await page.getByLabel('Meeting 1 topic *', { exact: true }).fill('Biotechnology fundamentals');
  await page.getByRole('button', { name: 'Add meeting', exact: true }).click();
  await page.getByLabel('Meeting 2 topic *', { exact: true }).fill('Investigating microorganisms');
  await save(page);
  const [syllabus] = await sql`SELECT id, content FROM teaching_records WHERE title = ${`${testName} syllabus`}`;
  assert.equal(syllabus.content.sessions[1].date, '2032-02-27');
  await navigate(page, 'Class Workflow');
  assert.equal(await page.locator('.teacher-workflow-row').count(), 2);
  await page.getByRole('button', { name: 'Meeting journal for meeting 1', exact: true }).click();
  assert.equal(await page.getByLabel('Meeting date', { exact: true }).getAttribute('readonly'), '');
  await page.getByLabel('Meeting topic *', { exact: true }).fill(`${testName} meeting`);
  await page.getByRole('button', { name: 'Submit record', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Add a score and feedback' }).waitFor();
  await page.getByRole('button', { name: 'Student & Class Feedback', exact: true }).click();
  for (const id of ['alicia', 'darren']) for (const aspect of ['Afektif', 'Problem solving', 'Story telling', 'Kinerja']) await page.getByRole('group', { name: `${aspect} ${id}`, exact: true }).getByRole('button', { name: '3 / Proficient', exact: true }).click();
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
  assert.equal(meeting.content.students[0].ratings.affective, '3');
  assert.equal(meeting.content.syllabusId, syllabus.id);
  assert.equal(meeting.content.meetingNumber, 1);
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
  assert.equal(await page.getByRole('group', { name: 'Afektif alicia', exact: true }).getByRole('button', { name: '3 / Proficient', exact: true }).getAttribute('aria-pressed'), 'true');
  await layout(page);
  await page.getByRole('button', { name: 'Plan meeting 2', exact: true }).click();
  assert.equal(await page.getByLabel('Next meeting', { exact: true }).inputValue(), '2032-02-27');
  await page.getByLabel('Title *', { exact: true }).fill(`${testName} lesson plan`);
  await save(page, true);
  await page.getByLabel('Learning objectives').fill('Explain how controls improve experimental evidence.');
  await page.getByLabel('Materials & preparation').fill('Sample containers, observation journal, and microscope.');
  for (const number of [1, 2, 3]) {
    await page.getByLabel(`Activity ${number} minutes`, { exact: true }).fill('15');
    await page.getByLabel(`Activity ${number} purpose`, { exact: false }).fill('Connect scientific concepts with observed evidence.');
    await page.getByLabel(`Activity ${number} coach activity`, { exact: false }).fill('Guide discussion and model careful observation.');
    await page.getByLabel(`Activity ${number} student activity`, { exact: false }).fill('Investigate the samples and record observations.');
  }
  await page.getByLabel('Assessment', { exact: false }).fill('Review worksheets and participation in discussion.');
  await save(page);
  await navigate(page, 'Class Workflow');
  await page.getByRole('button', { name: 'Material recap for meeting 1', exact: true }).click();
  assert.equal(await page.locator('.teacher-material-links a').first().getAttribute('href'), 'https://canva.link/7qu8j7bw0oc4ve1');
  assert.equal(await page.locator('.teacher-material-links a').nth(1).getAttribute('href'), 'https://canva.link/5gnj7agqoy3l593');
  assert.equal(await page.getByLabel('Your Canva slides link').count(), 0, 'Assigned links are not editable');
  await page.getByLabel('Title *', { exact: true }).fill(`${testName} slides`);
  await page.getByLabel('Material notes').fill('Presentation and worksheet are ready for head-coach review.');
  await tamperSave(page, (draft) => { draft.content.canvaUrl = 'https://canva.link/tf9z5tip7qyaou8'; }, 'Keep the assigned presentation');
  await tamperSave(page, (draft) => { draft.content.syllabusId = randomUUID(); }, 'belonging to your Klass');
  await page.getByLabel('Document PDF', { exact: true }).setInputFiles({ name: 'lesson-slides.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF') });
  await page.locator('.teacher-upload-previews').getByText('lesson-slides.pdf', { exact: true }).waitFor();
  await save(page);
  await navigate(page, 'Class Workflow');
  await page.getByRole('button', { name: 'View syllabus', exact: true }).click();
  await page.getByLabel('Meeting 2 date').fill('2032-02-28');
  await page.getByRole('button', { name: 'Submit record', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Keep meeting dates with existing records unchanged' }).waitFor();
  await page.getByLabel('Meeting 2 date').fill('2032-02-27');
  await save(page);
  await navigate(page, 'Class Requests');
  assert.equal(await page.getByLabel('Needed by', { exact: true }).inputValue(), '2032-02-27');
  await page.getByLabel('Title *', { exact: true }).fill(`${testName} supplies`);
  await page.getByLabel('Items & quantities').fill('10 reusable sample containers and 2 measuring tools.');
  await page.getByLabel('Purpose & classroom needs').fill('For student experiments during the next biotechnology class.');
  await page.getByRole('button', { name: /^Request timeframe:/ }).click();
  await page.getByRole('button', { name: 'Before semester', exact: true }).click();
  assert.equal(await page.getByLabel('Semester start', { exact: true }).inputValue(), testDate);
  assert.match(await page.locator('.teacher-inline-deadline').innerText(), /13 Feb 2032/);
  await save(page);
  const admin = await context('admin@krya.global', 'admin');
  assert.equal((await admin.request.get(attachmentUrl)).status(), 200);
  const adminPage = await admin.newPage();
  await adminPage.goto(`${baseUrl}/admin`);
  await adminPage.waitForLoadState('networkidle');
  await adminPage.getByRole('navigation', { name: 'Admin navigation' }).getByRole('button', { name: /^Approvals/ }).click();
  for (const [title, detail] of [['syllabus', 'Biotechnology advocacy project.'], ['lesson plan', 'Coach activity'], ['meeting', 'Afektif:'], ['slides', 'Open worksheet']]) {
    await adminPage.locator('.teacher-review-row').filter({ hasText: `${testName} ${title}` }).getByRole('button', { name: 'Review' }).click();
    assert.match(await adminPage.getByRole('dialog').innerText(), new RegExp(detail.replace('.', '\\.'), 'i'));
    await adminPage.getByRole('button', { name: 'Close details', exact: true }).click();
  }
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
  for (const width of [1440, 390, 360]) {
    await page.setViewportSize({ width, height: 960 });
    for (const name of ['Class Workflow', 'Meeting Journal', 'Lesson Plans', 'Semester Preparation', 'Notifications']) {
      await navigate(page, name);
      await layout(page);
      await page.screenshot({ path: join(screenshots, `workflow-${name.replaceAll(' ', '-')}-${width}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  await navigate(page, 'Semester Preparation');
  await page.getByRole('button', { name: /^Klass:/ }).click();
  await page.getByRole('button', { name: 'Coding Fundamentals', exact: true }).click();
  await page.getByRole('button', { name: 'Use supplied 2026-2027 syllabus', exact: true }).click();
  assert.equal(await page.locator('.teacher-timeline-entry').count(), 9);
  assert.equal(await page.getByLabel('Meeting 9 date').inputValue(), '2026-11-21');
  await page.getByLabel('Submission deadline').fill('2026-08-29');
  await save(page);
  await navigate(page, 'Class Workflow');
  assert.equal(await page.locator('.teacher-workflow-row').count(), 9);
  await page.getByRole('button', { name: 'Material recap for meeting 4', exact: true }).click();
  assert.equal(await page.locator('.teacher-material-links a').first().getAttribute('href'), 'https://canva.link/tf9z5tip7qyaou8');
  await page.setViewportSize({ width: 360, height: 960 });
  await layout(page);
  await page.screenshot({ path: join(screenshots, 'coding-assigned-materials-360.png'), fullPage: true });
  await sql`INSERT INTO teaching_records (id, teacher_email, kind, class_id, meeting_date, title, content, status)
    SELECT gen_random_uuid(), ${teacherEmail}, 'lesson-plan', 'steamaker-cikal', DATE '2020-01-01' + number, 'Legacy plan ' || number,
      '{"objectives":"Legacy objectives","activities":"Legacy activities"}'::jsonb, 'Draft' FROM generate_series(1, 101) AS series(number)`;
  await page.reload();
  await page.locator('.page-preloader').waitFor({ state: 'detached' });
  await navigate(page, 'Class Workflow');
  assert.equal(await page.locator('.teacher-workflow-row').count(), 2, 'Older syllabuses remain available beyond 100 newer records');
  await page.getByRole('button', { name: 'Meeting journal for meeting 1', exact: true }).click();
  await page.getByRole('button', { name: 'Student & Class Feedback', exact: true }).click();
  assert.equal(await page.getByRole('group', { name: 'Afektif alicia', exact: true }).getByRole('button', { name: '3 / Proficient', exact: true }).getAttribute('aria-pressed'), 'true');
  await navigate(page, 'Lesson Plans');
  await page.locator('.teacher-history-list > button').filter({ has: page.getByText('Legacy plan 1', { exact: true }) }).click();
  assert.equal(await page.getByLabel('Learning activities & timing').inputValue(), 'Legacy activities');
  await save(page, true);
  assert.deepEqual(errors, []);
  console.log('Teacher persistence, photos, access control, admin review, and notifications passed.');
} finally {
  for (const ctx of contexts) await ctx.close();
  await browser.close();
  await sql`DELETE FROM teaching_records WHERE teacher_email = ${teacherEmail}`;
  await sql`DELETE FROM portal_users WHERE email = ${teacherEmail}`;
  await sql.end();
}
