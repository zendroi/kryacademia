import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
import postgres from 'postgres';
import { chromium } from 'playwright';

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')}`;
const demo = moduleUrl(await readFile(new URL('../app/admin/adminData.ts', import.meta.url), 'utf8'));
const { seedCatalog, catalogCounts, assignedCatalog, approvedSyllabuses, coachTasks, validDate } = await import(moduleUrl((await readFile(new URL('../lib/academy.ts', import.meta.url), 'utf8')).replace("'@/app/admin/adminData'", JSON.stringify(demo))));
const seed = seedCatalog();
assert.equal(seed.klasses.find((item) => item.id === 'biotech-10').students, 2);
seed.students[0].classIds.push('coding');
const multiple = catalogCounts(seed);
assert.equal(multiple.klasses.find((item) => item.id === 'coding').students, 2);
assert.match(multiple.students[0].klass, /Biotechnology.*Coding/);
assert.equal(assignedCatalog(seed, 'unknown@example.com').klasses.length, 0);
assert.equal(assignedCatalog(seed, 'teacher@krya.global').klasses.length, 3);
assert.equal(validDate('2026-02-30'), false);
assert.equal(validDate('2028-02-29'), true);
assert.equal(coachTasks(seed.coaches[0], seed, [], '2026-10-06').length, 0, 'No configured deadline must not invent overdue tasks');
assert.deepEqual(approvedSyllabuses([{ kind: 'syllabus', classId: 'x', status: 'Submitted' }, { kind: 'syllabus', classId: 'x', status: 'Approved', id: 'approved', date: '2026-09-05', updatedAt: '' }], 'x').map((item) => item.id), ['approved']);

if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET) throw new Error('DATABASE_URL and SESSION_SECRET required');
const sql = postgres(process.env.DATABASE_URL, { ssl: process.env.DATABASE_URL.includes('localhost') ? false : 'require' });
const base = process.env.BASE_URL || 'http://127.0.0.1:3001';
const marker = `Academy check ${randomUUID()}`;
const ids = Object.fromEntries(['institution', 'coach', 'klass', 'otherKlass', 'student', 'syllabus', 'pendingSyllabus', 'meeting', 'draft', 'plan'].map((key) => [key, randomUUID()]));
const fixtures = {
  institutions: [{ id: ids.institution, name: `${marker} Institution`, city: 'Surabaya', country: 'Indonesia', classes: 0, students: 0, logo: '/partners/4.jpg', about: '', address: '', contactName: '', email: '', phone: '', website: '', revision: 0 }],
  coaches: [{ id: ids.coach, name: `${marker} Coach`, specialty: 'Biotechnology', level: 'Coach', image: '/coaches/rahayu-widyawati.jpg', email: 'fixture@example.com', portalEmail: 'teacher@krya.global', bio: '', classes: 0, students: 0, revision: 0 }],
  klasses: [
    { id: ids.klass, title: `${marker} Klass`, category: 'Science', school: '', institutionId: ids.institution, coachIds: [ids.coach], coaches: [], students: 0, mode: 'Onsite', image: '/klass/biotechnology-xin-zhong.webp', schedule: 'Saturday, 08:00', description: 'Investigation through hands-on projects.', revision: 0, deadlines: { semesterStart: '2026-09-05', syllabus: '2026-08-29', meetings: [{ date: '2026-09-05', lessonPlan: '2026-09-04', feedback: '2026-09-06' }, { date: '2026-09-12', lessonPlan: '2026-09-11', feedback: '2026-09-13' }] } },
    { id: ids.otherKlass, title: `${marker} Other Klass`, category: 'Coding', school: '', institutionId: ids.institution, coachIds: [], coaches: [], students: 0, mode: 'Online', image: '/klass/digitechnology-coding.webp', schedule: 'Sunday, 08:00', description: 'Learn computational thinking.', revision: 0, deadlines: { semesterStart: '', syllabus: '', meetings: [] } },
  ],
  students: [{ id: ids.student, name: `${marker} Student`, institutionId: ids.institution, school: '', grade: 'Grade 10', klass: '', classIds: [ids.klass, ids.otherKlass], score: 0, attendance: 0, revision: 0 }],
};
const sessions = [{ date: '2026-09-05', time: '08:00', topic: 'Approved investigation', phase: 'Inspiring' }, { date: '2026-09-12', time: '08:00', topic: 'Approved project', phase: 'Creating' }];
function cookie(role) {
  const payload = Buffer.from(JSON.stringify({ email: `${role}@krya.global`, role, exp: Date.now() + 3600000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', process.env.SESSION_SECRET).update(payload).digest('base64url')}`;
}
async function navigate(page, name) {
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation', { name: 'Admin navigation' }).getByRole('button', { name, exact: true }).click();
  await page.waitForTimeout(350);
}
async function close(page) { await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' }); }
async function layout(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Page overflow');
  if (await page.getByRole('dialog').count()) assert.equal(await page.locator('.admin-detail-modal').evaluate((element) => element.scrollWidth > element.clientWidth + 1), false, 'Dialog overflow');
}
async function record(kind, id) { return (await sql`SELECT content FROM academy_catalog WHERE id = 1`)[0].content[kind].find((item) => item.id === id); }
async function save(page) { await page.getByRole('dialog').getByRole('button', { name: 'Save changes', exact: true }).click(); await page.getByText('Record saved to the database.', { exact: true }).waitFor(); await page.getByRole('dialog', { name: /details$/ }).waitFor(); }
const screenshots = join(tmpdir(), 'kryacademia-academy-check');
const browser = await chromium.launch();
const errors = [];
let saveRequest;
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await ctx.addCookies([{ name: 'krya_session', value: cookie('admin'), url: base }]);
  const page = await ctx.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/admin`); await page.waitForLoadState('networkidle');
  await sql.begin(async (tx) => {
    const [row] = await tx`SELECT content FROM academy_catalog WHERE id = 1 FOR UPDATE`;
    for (const kind of Object.keys(fixtures)) row.content[kind].push(...fixtures[kind]);
    await tx`UPDATE academy_catalog SET content = ${sql.json(row.content)} WHERE id = 1`;
    for (const [id, kind, date, status, content] of [
      [ids.syllabus, 'syllabus', '2026-09-05', 'Approved', { deadline: '2026-08-29', mainCoach: 'Fixture coach', sessions }],
      [ids.pendingSyllabus, 'syllabus', '2027-01-11', 'Submitted', { sessions: [{ ...sessions[0], date: '2027-01-11', topic: 'Unapproved topic must not appear' }] }],
      [ids.meeting, 'meeting', '2026-09-05', 'Submitted', { teacherAttendance: 'Present', reflection: 'Students tested their hypotheses.', students: [{ id: ids.student, name: fixtures.students[0].name, attendance: 'Present', score: '88', feedback: 'Recorded personal feedback.' }] }],
      [ids.draft, 'meeting', '2026-09-12', 'Draft', { teacherAttendance: 'Present', reflection: '', students: [{ id: ids.student, name: fixtures.students[0].name, attendance: 'Present', score: '', feedback: '' }] }],
      [ids.plan, 'lesson-plan', '2026-09-05', 'Submitted', { objectives: 'Explore evidence.' }],
    ]) await tx`INSERT INTO teaching_records (id, teacher_email, kind, class_id, meeting_date, title, content, status) VALUES (${id}, 'teacher@krya.global', ${kind}, ${ids.klass}, ${date}, ${`${marker} ${id === ids.pendingSyllabus ? 'Pending syllabus' : kind}`}, ${sql.json(content)}, ${status})`;
  });
  await page.reload(); await page.waitForLoadState('networkidle'); await mkdir(screenshots, { recursive: true });
  for (const width of (process.env.WIDTHS || '1440,390,360').split(',').map(Number)) {
    await page.setViewportSize({ width, height: 960 });
    await navigate(page, 'Klass');
    await page.locator('.admin-klass-card').filter({ hasText: `${marker} Klass` }).click();
    const dialog = page.getByRole('dialog', { name: 'klass details' }); await dialog.waitFor();
    await dialog.getByText('Approved investigation', { exact: true }).waitFor();
    assert.equal(await dialog.getByText('Unapproved topic must not appear', { exact: true }).count(), 0);
    assert.equal(await dialog.getByRole('button', { name: new RegExp(`${marker} Student`) }).count(), 1);
    await layout(page); await page.screenshot({ path: join(screenshots, `klass-${width}.png`) });
    await dialog.getByRole('button', { name: new RegExp(`${marker} Coach`) }).click();
    await page.getByRole('dialog', { name: 'coach details' }).waitFor();
    await page.getByRole('heading', { name: 'Outstanding tasks (2)' }).waitFor();
    assert.equal(await page.locator('.catalog-task .status-overdue').count(), 2);
    assert.equal(await page.getByText('Teaching approach', { exact: true }).count(), 0);
    await layout(page); await page.screenshot({ path: join(screenshots, `coach-${width}.png`) });
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('dialog', { name: 'klass details' }).getByRole('button', { name: new RegExp(`${marker} Student`) }).click();
    await page.getByRole('dialog', { name: 'student details' }).waitFor();
    assert.equal(await page.locator('.catalog-klass-links button').count(), 2);
    await page.getByText('Recorded personal feedback.', { exact: true }).waitFor();
    await page.getByText('No student work submitted yet. Student portal uploads are not available.', { exact: true }).waitFor();
    await layout(page); await page.screenshot({ path: join(screenshots, `student-${width}.png`) });
    await close(page);
    await navigate(page, 'Institutions');
    await page.locator('.admin-institution-card').filter({ hasText: `${marker} Institution` }).click();
    assert.equal(await page.getByText('Partnership overview', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Edit institution', exact: true }).click();
    await page.getByRole('dialog', { name: 'Edit institution' }).waitFor();
    await layout(page); await page.screenshot({ path: join(screenshots, `institution-editor-${width}.png`) });
    if (width === 1440) {
      await page.getByRole('textbox', { name: 'Contact person', exact: true }).fill('Richard');
      await page.getByRole('textbox', { name: 'Contact email', exact: true }).fill('institution@example.com');
      await page.getByRole('textbox', { name: 'Contact number', exact: true }).fill('+62 851 1121 2362');
      await page.getByRole('textbox', { name: 'Address', exact: true }).fill('Surabaya');
      const capture = page.waitForRequest((request) => request.method() === 'POST' && request.headers()['next-action']);
      await save(page); saveRequest = await capture;
      assert.equal((await record('institutions', ids.institution)).contactName, 'Richard');
      assert.equal(await page.getByRole('link', { name: 'institution@example.com' }).getAttribute('href'), 'mailto:institution@example.com');
      await close(page);
    } else await close(page);
    console.log(`Profile navigation and layout passed at ${width}px.`);
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  await navigate(page, 'Klass'); await page.locator('.admin-klass-card').filter({ hasText: `${marker} Klass` }).click();
  await page.getByRole('button', { name: 'Edit Klass', exact: true }).click(); await page.getByRole('dialog', { name: 'Edit Klass' }).waitFor();
  await page.getByRole('textbox', { name: 'Schedule', exact: true }).fill('Saturday, 09:00');
  await page.getByRole('textbox', { name: 'Description', exact: true }).fill('Updated class overview.');
  await page.getByRole('button', { name: 'Add meeting deadline', exact: true }).click();
  await page.getByLabel('Meeting deadline 3 date', { exact: true }).fill('2026-09-19');
  await page.getByLabel('Meeting deadline 3 lessonPlan', { exact: true }).fill('2026-09-18');
  await page.getByLabel('Meeting deadline 3 feedback', { exact: true }).fill('2026-09-20');
  await save(page); assert.equal((await record('klasses', ids.klass)).schedule, 'Saturday, 09:00'); await close(page);
  await navigate(page, 'Coaches'); await page.locator('.admin-coach-card').filter({ hasText: `${marker} Coach` }).click();
  await page.getByRole('button', { name: 'Edit coach', exact: true }).click(); await page.getByRole('dialog', { name: 'Edit coach' }).waitFor();
  await page.getByRole('textbox', { name: 'Teaching specialty', exact: true }).fill('Coding & biotechnology'); await save(page); await close(page);
  await navigate(page, 'Students'); await page.locator('.admin-student-card').filter({ hasText: `${marker} Student` }).click();
  await page.getByRole('button', { name: 'Edit student', exact: true }).click(); await page.getByRole('dialog', { name: 'Edit student' }).waitFor();
  await page.getByRole('checkbox', { name: `${marker} Other Klass`, exact: true }).uncheck(); await save(page);
  assert.equal((await record('students', ids.student)).classIds.length, 1); await close(page);
  await page.reload(); await page.waitForLoadState('networkidle'); await navigate(page, 'Klass');
  await page.locator('.admin-klass-card').filter({ hasText: `${marker} Klass` }).click();
  await page.getByText('Updated class overview.', { exact: true }).waitFor(); await close(page);
  const teacher = await browser.newContext(); await teacher.addCookies([{ name: 'krya_session', value: cookie('teacher'), url: base }]);
  const teacherPage = await teacher.newPage(); teacherPage.on('pageerror', (error) => errors.push(error.message)); await teacherPage.goto(`${base}/teacher`); await teacherPage.waitForLoadState('networkidle');
  await teacherPage.getByRole('heading', { name: `${marker} Klass`, exact: true }).waitFor();
  assert.equal(await teacherPage.getByRole('heading', { name: `${marker} Other Klass`, exact: true }).count(), 0, 'Unassigned class leaked into teacher catalog');
  await teacherPage.getByRole('button', { name: 'Semester Preparation', exact: true }).click();
  assert.equal(await teacherPage.getByLabel('Submission deadline', { exact: true }).getAttribute('readonly'), '');
  await navigate(page, 'Students'); await page.locator('.admin-student-card').filter({ hasText: `${marker} Student` }).click();
  await page.getByRole('button', { name: 'Edit student', exact: true }).click(); await page.getByRole('dialog', { name: 'Edit student' }).waitFor();
  await page.getByRole('checkbox', { name: `${marker} Klass`, exact: true }).uncheck(); await save(page); await close(page);
  await teacherPage.getByRole('button', { name: 'Refresh workspace', exact: true }).click();
  await teacherPage.getByText('Workspace updated.', { exact: true }).waitFor();
  await teacherPage.getByRole('button', { name: 'Overview', exact: true }).click();
  await teacherPage.getByRole('button', { name: `Open workflow for ${marker} Klass`, exact: true }).click();
  await teacherPage.locator('.teacher-workflow').waitFor();
  await teacherPage.getByRole('button', { name: `Semester syllabus: ${marker} Pending syllabus`, exact: true }).click();
  await teacherPage.getByRole('button', { name: `${marker} syllabus`, exact: true }).click();
  await teacherPage.getByRole('button', { name: 'Meeting journal for meeting 2', exact: true }).click();
  await teacherPage.getByText(fixtures.students[0].name, { exact: true }).waitFor();
  await teacherPage.getByRole('button', { name: 'Save draft', exact: true }).click();
  await teacherPage.getByText('Draft saved.', { exact: true }).waitFor();
  const [historical] = await sql`SELECT content FROM teaching_records WHERE id = ${ids.draft}`;
  assert.equal(historical.content.students.length, 1, 'Changing enrollment rewrote a historical roster');
  assert.equal(historical.content.students[0].name, fixtures.students[0].name);
  for (const context of [teacher, await browser.newContext()]) {
    const headers = { ...saveRequest.headers(), origin: base }; delete headers.cookie;
    const response = await context.request.post(`${base}/admin`, { headers, data: saveRequest.postDataBuffer() });
    assert.doesNotMatch(await response.text(), /"ok":true/, 'Non-admin was allowed to edit catalog');
    if (context !== teacher) await context.close();
  }
  const stale = await ctx.request.post(`${base}/admin`, { headers: { ...saveRequest.headers(), origin: base }, data: saveRequest.postDataBuffer() });
  assert.match(await stale.text(), /This record changed/, 'Stale edit must be rejected');
  await teacher.close(); await ctx.close(); assert.deepEqual(errors, []); console.log('Catalog persistence, profile links, multi-enrollment, approved journey, deadlines, role protection and desktop/mobile checks passed.'); console.log(`Screenshots: ${screenshots}`);
} finally {
  await browser.close();
  await sql.begin(async (tx) => {
    const [row] = await tx`SELECT content FROM academy_catalog WHERE id = 1 FOR UPDATE`;
    for (const kind of Object.keys(fixtures)) row.content[kind] = row.content[kind].filter((item) => !Object.values(ids).includes(item.id));
    await tx`UPDATE academy_catalog SET content = ${sql.json(row.content)} WHERE id = 1`;
    await tx`DELETE FROM teaching_records WHERE id IN ${sql([ids.syllabus, ids.pendingSyllabus, ids.meeting, ids.draft, ids.plan])}`;
  });
  await sql.end();
}
