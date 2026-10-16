import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixtureSession, clearFixtureSessions } from './session-fixture.mjs';
import { core, workflow, updateCatalog } from './academic-fixture.mjs';
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
const accountEmail = `academy-${randomUUID()}@example.com`;
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
async function cookie(role) { return fixtureSession(sql, `${role}@krya.global`, role); }
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
async function record(kind, id) { return (await sql.begin(core.readAcademicCore))[kind].find((item) => item.id === id); }
async function save(page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes', exact: true }).click();
  const outcome = await Promise.race([
    page.getByText('Record saved to the database.', { exact: true }).waitFor().then(() => ''),
    page.getByRole('alert').waitFor().then(async () => page.getByRole('alert').innerText()),
  ]);
  if (outcome) throw new Error(`Catalog save failed: ${outcome}`);
  await page.getByRole('dialog', { name: /details$/ }).waitFor();
}
const screenshots = join(tmpdir(), 'kryacademia-academy-check');
const browser = await chromium.launch();
const errors = [];
let saveRequest;
let uploadedImageId;
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await ctx.addCookies([{ name: 'krya_session', value: await cookie('admin'), url: base }]);
  const page = await ctx.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/admin`); await page.waitForLoadState('networkidle');
  await sql.begin(async (tx) => {
    await tx`INSERT INTO portal_users (email, password_hash, role, status) VALUES (${accountEmail}, crypt(${randomUUID()}, gen_salt('bf')), 'teacher', 'pending')`;
    await updateCatalog(tx, (catalog) => { for (const kind of Object.keys(fixtures)) catalog[kind].push(...fixtures[kind]); });
    for (const [id, kind, date, status, content] of [
      [ids.syllabus, 'syllabus', '2026-09-05', 'Approved', { deadline: '2026-08-29', mainCoach: 'Fixture coach', sessions }],
      [ids.pendingSyllabus, 'syllabus', '2027-01-11', 'Submitted', { sessions: [{ ...sessions[0], date: '2027-01-11', topic: 'Unapproved topic must not appear' }] }],
      [ids.meeting, 'meeting', '2026-09-05', 'Submitted', { teacherAttendance: 'Present', reflection: 'Students tested their hypotheses.', students: [{ id: ids.student, name: fixtures.students[0].name, attendance: 'Present', score: '88', feedback: 'Recorded personal feedback.' }] }],
      [ids.draft, 'meeting', '2026-09-12', 'Draft', { teacherAttendance: 'Present', reflection: '', students: [{ id: ids.student, name: fixtures.students[0].name, attendance: 'Present', score: '', feedback: '' }] }],
      [ids.plan, 'lesson-plan', '2026-09-05', 'Submitted', { objectives: 'Explore evidence.' }],
    ]) await tx`INSERT INTO teaching_records (id, teacher_email, kind, class_id, meeting_date, title, content, status) VALUES (${id}, 'teacher@krya.global', ${kind}, ${ids.klass}, ${date}, ${`${marker} ${id === ids.pendingSyllabus ? 'Pending syllabus' : kind}`}, ${sql.json(content)}, ${status})`;
  });
  await sql.begin(workflow.migrateTeachingWorkflow);
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
  await page.getByLabel('Klass image', { exact: true }).setInputFiles({ name: 'klass-documentation.webp', mimeType: 'image/webp', buffer: await readFile(new URL('../public/klass/biotechnology-xin-zhong.webp', import.meta.url)) });
  await page.getByText(/klass-documentation\.webp \/ \d+ KB/).waitFor();
  await page.getByRole('textbox', { name: 'Schedule', exact: true }).fill('Saturday, 09:00');
  await page.getByRole('textbox', { name: 'Description', exact: true }).fill('Updated class overview.');
  await page.getByRole('button', { name: 'Add meeting deadline', exact: true }).click();
  await page.getByLabel('Meeting deadline 3 date', { exact: true }).fill('2026-09-19');
  await page.getByLabel('Meeting deadline 3 lessonPlan', { exact: true }).fill('2026-09-18');
  await page.getByLabel('Meeting deadline 3 feedback', { exact: true }).fill('2026-09-20');
  await page.getByLabel('Semester request deadline', { exact: true }).fill('2026-09-03');
  await page.getByLabel('Meeting deadline 3 request', { exact: true }).fill('2026-09-17');
  const classCapture = page.waitForRequest((request) => request.method() === 'POST' && request.headers()['next-action']);
  await save(page); const classSaveRequest = await classCapture;
  const savedKlass = await record('klasses', ids.klass);
  const beforeStaleUpload = (await sql`SELECT count(*)::int AS count FROM portal_file_objects`)[0].count;
  const staleUpload = await ctx.request.post(`${base}/admin`, { headers: { ...classSaveRequest.headers(), origin: base }, data: classSaveRequest.postDataBuffer() });
  assert.match(await staleUpload.text(), /This record changed/);
  assert.equal((await sql`SELECT count(*)::int AS count FROM portal_file_objects`)[0].count, beforeStaleUpload, 'A stale catalog upload must not stage another file');
  assert.equal(savedKlass.schedule, 'Saturday, 09:00');
  const [coreKlass] = await sql`SELECT g.mode, t.description, s.schedule_text AS schedule FROM class_groups g JOIN klass_types t ON t.id = g.klass_type_id JOIN class_schedules s ON s.class_group_id = g.id WHERE g.id = ${ids.klass} AND g.active`;
  assert.equal(coreKlass.schedule, 'Saturday, 09:00'); assert.equal(coreKlass.description, 'Updated class overview.');
  assert.equal((await sql`SELECT count(*)::int AS count FROM submission_deadlines WHERE class_group_id = ${ids.klass}`)[0].count, 9);
  assert.equal(savedKlass.deadlines.semesterRequest, '2026-09-03');
  assert.equal(savedKlass.deadlines.meetings[2].request, '2026-09-17');
  const deadlineArgs = ['klasses', ids.klass, savedKlass.revision, { ...savedKlass, studentIds: [ids.student] }];
  const deadlineHeaders = { ...classSaveRequest.headers(), origin: base }; delete deadlineHeaders['content-length'];
  deadlineArgs[3].deadlines = { ...savedKlass.deadlines, semesterRequest: savedKlass.deadlines.semesterStart };
  assert.match(await (await ctx.request.post(`${base}/admin`, { headers: deadlineHeaders, data: JSON.stringify(deadlineArgs) })).text(), /Class needs deadlines must be before/);
  deadlineArgs[3].deadlines = { ...savedKlass.deadlines, meetings: savedKlass.deadlines.meetings.map((meeting, index) => index ? meeting : { ...meeting, request: '2026-09-04' }) };
  assert.match(await (await ctx.request.post(`${base}/admin`, { headers: deadlineHeaders, data: JSON.stringify(deadlineArgs) })).text(), /Use one class needs deadline/);
  assert.equal((await record('klasses', ids.klass)).revision, savedKlass.revision, 'Invalid request deadlines must not mutate the class');
  const [audit] = await sql`SELECT actor_email AS "actorEmail", action FROM academy_events WHERE entity_kind = 'klasses' AND entity_id = ${ids.klass} ORDER BY created_at DESC LIMIT 1`;
  assert.equal(audit.actorEmail, 'admin@krya.global'); assert.equal(audit.action, 'update');
  assert.match(savedKlass.image, /^\/api\/academy-images\/[a-f0-9-]{36}$/i);
  uploadedImageId = savedKlass.image.split('/').at(-1);
  const storedImage = await ctx.request.get(`${base}${savedKlass.image}`);
  assert.equal(storedImage.status(), 200); assert.equal(storedImage.headers()['content-type'], 'image/webp');
  const storedBytes = Buffer.from(await storedImage.body()); assert.equal(storedBytes.toString('ascii', 0, 4), 'RIFF'); assert.equal(storedBytes.toString('ascii', 8, 12), 'WEBP');
  const anonymousImageContext = await browser.newContext(); assert.equal((await anonymousImageContext.request.get(`${base}${savedKlass.image}`)).status(), 401); await anonymousImageContext.close();
  const forgedArgs = JSON.parse(classSaveRequest.postData());
  const dangerous = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  forgedArgs[2] = savedKlass.revision; forgedArgs[3].imageUpload = { id: randomUUID(), name: 'unsafe.svg', mime: 'image/svg+xml', size: dangerous.length, data: `data:image/svg+xml;base64,${dangerous.toString('base64')}` };
  const forgedHeaders = { ...classSaveRequest.headers(), origin: base }; delete forgedHeaders['content-length'];
  const rejectedImage = await ctx.request.post(`${base}/admin`, { headers: forgedHeaders, data: JSON.stringify(forgedArgs) });
  assert.match(await rejectedImage.text(), /valid JPEG, PNG, or WebP image/, 'Server accepted a forged active image payload');
  assert.equal((await record('klasses', ids.klass)).revision, savedKlass.revision, 'Rejected upload changed the catalog');
  await close(page);
  await navigate(page, 'Coaches'); await page.locator('.admin-coach-card').filter({ hasText: `${marker} Coach` }).click();
  await page.getByRole('button', { name: 'Edit coach', exact: true }).click(); await page.getByRole('dialog', { name: 'Edit coach' }).waitFor();
  await page.getByRole('textbox', { name: 'Teaching specialty', exact: true }).fill('Coding & biotechnology');
  await page.getByRole('textbox', { name: 'Teacher login email', exact: true }).fill(accountEmail);
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'approved, active teacher account' }).waitFor();
  assert.equal((await record('coaches', ids.coach)).portalEmail, 'teacher@krya.global', 'Pending accounts must not gain a coach assignment');
  await sql`UPDATE portal_users SET status = 'active' WHERE email = ${accountEmail}`;
  await save(page);
  await sql`UPDATE portal_users SET status = 'suspended' WHERE email = ${accountEmail}`;
  await page.getByRole('button', { name: 'Edit coach', exact: true }).click();
  await page.getByRole('dialog', { name: 'Edit coach' }).waitFor();
  await page.getByRole('textbox', { name: 'Teaching specialty', exact: true }).fill('Coding & science');
  await save(page);
  assert.equal((await record('coaches', ids.coach)).portalEmail, accountEmail, 'Suspension must not block other coach profile edits');
  await page.getByRole('button', { name: 'Edit coach', exact: true }).click();
  await page.getByRole('dialog', { name: 'Edit coach' }).waitFor();
  await page.getByRole('textbox', { name: 'Teacher login email', exact: true }).fill('teacher@krya.global');
  await save(page); await close(page);
  await navigate(page, 'Students'); await page.locator('.admin-student-card').filter({ hasText: `${marker} Student` }).click();
  await page.getByRole('button', { name: 'Edit student', exact: true }).click(); await page.getByRole('dialog', { name: 'Edit student' }).waitFor();
  await page.getByRole('checkbox', { name: `${marker} Other Klass`, exact: true }).uncheck(); await save(page);
  assert.equal((await record('students', ids.student)).classIds.length, 1); await close(page);
  await page.reload(); await page.waitForLoadState('networkidle'); await navigate(page, 'Klass');
  await page.locator('.admin-klass-card').filter({ hasText: `${marker} Klass` }).click();
  await page.getByText('Updated class overview.', { exact: true }).waitFor(); await close(page);
  const teacher = await browser.newContext(); await teacher.addCookies([{ name: 'krya_session', value: await cookie('teacher'), url: base }]);
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
  const [historical] = await sql`SELECT content FROM teaching_record_details WHERE id = ${ids.draft}`;
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
  await sql`UPDATE class_groups SET klass_type_id = ${ids.klass} WHERE id = ${ids.otherKlass}`;
  const sharedCatalog = await sql.begin(core.readAcademicCore);
  const editArgs = (id) => {
    const klass = sharedCatalog.klasses.find((item) => item.id === id);
    return ['klasses', id, klass.revision, { ...klass, studentIds: sharedCatalog.students.filter((student) => student.classIds.includes(id)).map((student) => student.id) }];
  };
  const firstGroupEdit = editArgs(ids.klass); firstGroupEdit[3].description = 'Updated shared Klass description.';
  delete firstGroupEdit[3].deadlines.semesterRequest;
  for (const meeting of firstGroupEdit[3].deadlines.meetings) delete meeting.request;
  const siblingEdit = editArgs(ids.otherKlass); siblingEdit[3].schedule = 'Updated sibling schedule';
  const sharedHeaders = { ...classSaveRequest.headers(), origin: base }; delete sharedHeaders['content-length'];
  const firstReply = await ctx.request.post(`${base}/admin`, { headers: sharedHeaders, data: JSON.stringify(firstGroupEdit) });
  assert.match(await firstReply.text(), /"ok":true/);
  assert.equal((await record('klasses', ids.klass)).deadlines.semesterRequest, '2026-09-03', 'Older clients must not erase newly configured deadlines');
  assert.equal((await record('klasses', ids.klass)).deadlines.meetings[2].request, '2026-09-17');
  assert.equal((await record('klasses', ids.otherKlass)).revision, siblingEdit[2] + 1, 'Shared type edits must invalidate sibling group forms');
  const siblingReply = await ctx.request.post(`${base}/admin`, { headers: sharedHeaders, data: JSON.stringify(siblingEdit) });
  assert.match(await siblingReply.text(), /This record changed/, 'Stale sibling forms must not restore old shared fields');
  assert.equal((await record('klasses', ids.klass)).description, 'Updated shared Klass description.');
  const freshSibling = await record('klasses', ids.otherKlass);
  const firstRevision = (await record('klasses', ids.klass)).revision;
  siblingEdit[2] = freshSibling.revision; siblingEdit[3] = { ...siblingEdit[3], ...freshSibling, schedule: 'Updated sibling schedule' };
  const freshReply = await ctx.request.post(`${base}/admin`, { headers: sharedHeaders, data: JSON.stringify(siblingEdit) });
  assert.match(await freshReply.text(), /"ok":true/, 'A refreshed sibling form must remain editable');
  assert.equal((await record('klasses', ids.otherKlass)).schedule, 'Updated sibling schedule');
  assert.equal((await record('klasses', ids.klass)).revision, firstRevision, 'Group-only changes must not invalidate sibling forms');
  await teacher.close(); await ctx.close(); assert.deepEqual(errors, []); console.log('Catalog persistence, profile links, multi-enrollment, approved journey, deadlines, role protection and desktop/mobile checks passed.'); console.log(`Screenshots: ${screenshots}`);
} finally {
  await browser.close();
  await sql.begin(async (tx) => {
    await updateCatalog(tx, (catalog) => { for (const kind of Object.keys(fixtures)) catalog[kind] = catalog[kind].filter((item) => !Object.values(ids).includes(item.id)); });
    await tx`DELETE FROM teaching_records WHERE id IN ${sql([ids.syllabus, ids.pendingSyllabus, ids.meeting, ids.draft, ids.plan])}`;
    await tx`DELETE FROM portal_users WHERE email = ${accountEmail}`;
    if (uploadedImageId) await tx`DELETE FROM academy_images WHERE id = ${uploadedImageId}`;
  });
  await clearFixtureSessions(sql);
  await sql.end();
}
