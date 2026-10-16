import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import postgres from 'postgres';
import { chromium } from 'playwright';
import ts from 'typescript';
import { core, academy, updateCatalog } from './academic-fixture.mjs';
import { fixtureSession, clearFixtureSessions } from './session-fixture.mjs';
import { notifyTeacher, planDeadlineReminders, runNotificationJobs } from '../lib/notification-jobs.mjs';

const schema = process.env.PORTAL_TEST_SCHEMA;
assert.ok(schema?.startsWith('security_check_'), 'Phase 5 checks require an isolated schema');
assert.equal(new URL(process.env.DATABASE_URL).searchParams.get('options'), `-c search_path=${schema},public`);
const options = { ssl: process.env.DATABASE_URL.includes('localhost') ? false : 'require', max: 1, onnotice: () => {} };
const sql = postgres(process.env.DATABASE_URL, options);
const workerName = `phase5-worker-${randomUUID()}`;
const second = postgres(process.env.DATABASE_URL, { ...options, connection: { application_name: workerName } });
const email = `reminders-${randomUUID()}@example.com`;
const coachId = randomUUID();
const groups = [];
const base = process.env.BASE_URL;
let browser;
let trigger = false;
async function count(table) { return (await sql`SELECT count(*)::int AS n FROM ${sql(table)} WHERE teacher_email = ${email}`)[0].n; }
async function catalog(change) { return sql.begin((tx) => updateCatalog(tx, change)); }
async function group(deadlines) {
  const id = randomUUID(); groups.push(id);
  await catalog((data) => data.klasses.push({ id, title: `Reminder fixture ${id}`, category: 'Science', mode: 'Online', school: '', institutionId: '', coachIds: [coachId], image: '/activities/collaboration.jpg', schedule: 'Fixture', description: 'Isolated reminder test', coaches: [], students: 0, revision: 0, deadlines }));
  return id;
}
async function drain() {
  const results = [];
  for (let i = 0; i < 15; i++) {
    const result = await runNotificationJobs(sql, 1); results.push(result);
    if (!result.remaining) return results;
  }
  throw new Error('Reminder queue did not drain');
}
try {
  await assert.rejects(runNotificationJobs(sql, 0), /1 to 100 jobs/);
  await assert.rejects(runNotificationJobs(sql, 101), /1 to 100 jobs/);
  assert.equal((await sql`SELECT current_schema() AS name`)[0].name, schema);
  const [{ hash }] = await sql`SELECT md5(content::text) AS hash FROM academy_catalog WHERE id = 1`;
  const [{ n: notifications }] = await sql`SELECT count(*)::int AS n FROM teacher_notifications`;
  for (let i = 0; i < 2; i++) await sql.unsafe(await readFile(new URL('../database/phase5.sql', import.meta.url), 'utf8'));
  assert.equal((await sql`SELECT md5(content::text) AS hash FROM academy_catalog WHERE id = 1`)[0].hash, hash);
  assert.equal((await sql`SELECT count(*)::int AS n FROM teacher_notifications`)[0].n, notifications);
  const [{ today }] = await sql`SELECT (NOW() AT TIME ZONE 'Asia/Jakarta')::date::text AS today`;
  const day = (offset) => new Date(Date.parse(`${today}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
  await sql`INSERT INTO portal_users (email, password_hash, role, status) VALUES (${email}, 'fixture-not-a-password', 'teacher', 'active')`;
  await catalog((data) => data.coaches.push({ id: coachId, name: 'Reminder fixture coach', email, portalEmail: email, specialty: 'Science', level: 'Coach', image: '', bio: '', classes: 0, students: 0, revision: 0 }));
  const a = await group({ semesterStart: day(7), syllabus: day(3), semesterRequest: day(1), meetings: [{ date: day(10), lessonPlan: '', feedback: '', request: day(1) }] });
  await group({ semesterStart: day(-20), syllabus: day(-21), semesterRequest: '', meetings: [{ date: day(-2), lessonPlan: '', feedback: day(-1), request: '' }] });
  const legacyId = randomUUID();
  await sql`INSERT INTO submission_deadlines (id, class_group_id, kind, meeting_date, due_date) VALUES (${legacyId}, ${a}, 'request', ${day(10)}, ${day(3)})`;
  await catalog(() => {});
  assert.equal((await sql`SELECT count(*)::int AS n FROM submission_deadlines WHERE id = ${legacyId}`)[0].n, 1, 'Unscoped request deadlines must survive catalog writes');
  const restored = await sql.begin(core.readAcademicCore);
  assert.equal(restored.klasses.find((item) => item.id === a).deadlines.semesterRequest, day(1));
  assert.equal(restored.klasses.find((item) => item.id === a).deadlines.meetings[0].request, day(1));
  assert.equal(academy.coachTasks(restored.coaches.find((item) => item.id === coachId), restored, [], today).length, 5);
  const event = { key: `fixture:${randomUUID()}`, teacherEmail: email, recordId: null, title: 'Immediate fixture', message: 'Atomic delivery' };
  await assert.rejects(sql.begin(async (tx) => { await notifyTeacher(tx, event); throw new Error('rollback fixture'); }), /rollback fixture/);
  assert.equal(await count('notification_jobs'), 0); assert.equal(await count('teacher_notifications'), 0);
  await sql.begin(async (tx) => { await notifyTeacher(tx, event); await notifyTeacher(tx, event); });
  assert.equal(await count('notification_jobs'), 1); assert.equal(await count('teacher_notifications'), 1);
  const [{ comparison }] = await sql`SELECT CASE WHEN (NOW() AT TIME ZONE 'Etc/GMT-14')::date != (NOW() AT TIME ZONE 'Asia/Jakarta')::date
    THEN 'Etc/GMT-14' ELSE 'Etc/GMT+12' END AS comparison`;
  await sql`SELECT set_config('TimeZone', ${comparison}, false)`;
  assert.notEqual((await sql`SELECT CURRENT_DATE::text AS day`)[0].day, today, 'Timezone fixture must cross a date boundary');
  assert.equal(await planDeadlineReminders(sql), 5, 'Planning must follow Jakarta, not the connection timezone');
  await sql`SET TIME ZONE 'UTC'`;
  assert.equal(await planDeadlineReminders(sql), 0);
  assert.deepEqual((await sql`SELECT stage, count(*)::int AS n FROM notification_jobs WHERE teacher_email = ${email} AND stage IS NOT NULL GROUP BY stage ORDER BY stage`).map((row) => [row.stage, row.n]), [['h1', 2], ['h3', 1], ['overdue', 2]]);
  await sql`INSERT INTO teaching_records (id, teacher_email, kind, class_id, meeting_date, title, content, status)
    VALUES (${randomUUID()}, ${email}, 'syllabus', ${a}, ${day(7)}, 'Completed fixture syllabus', '{}', 'Submitted')`;
  await catalog((data) => { data.klasses.find((item) => item.id === a).deadlines.semesterRequest = day(2); });
  const first = await drain();
  assert.equal(first.reduce((n, result) => n + result.cancelled, 0), 2);
  assert.equal(first.reduce((n, result) => n + result.delivered, 0), 3);
  assert.equal(await count('teacher_notifications'), 4);
  assert.equal((await runNotificationJobs(sql)).delivered, 0);
  await catalog((data) => { data.klasses.find((item) => item.id === a).deadlines.meetings[0].request = day(3); });
  assert.equal(await planDeadlineReminders(sql), 1);
  await catalog((data) => { data.klasses.find((item) => item.id === a).coachIds = []; });
  assert.equal((await runNotificationJobs(sql)).cancelled, 1);
  await catalog((data) => { data.klasses.find((item) => item.id === a).coachIds = [coachId]; });
  assert.equal((await runNotificationJobs(sql)).delivered, 1, 'Reassignment must reactivate an undelivered cancelled reminder');
  await catalog((data) => { data.klasses.find((item) => item.id === a).deadlines.semesterRequest = day(3); });
  assert.equal(await planDeadlineReminders(sql), 1);
  await sql`UPDATE portal_users SET status = 'suspended' WHERE email = ${email}`;
  assert.equal((await runNotificationJobs(sql)).cancelled, 1);
  await sql`UPDATE portal_users SET status = 'active' WHERE email = ${email}`;
  assert.equal((await runNotificationJobs(sql)).delivered, 1);
  const c = await group({ semesterStart: day(7), syllabus: day(1), meetings: [] });
  await planDeadlineReminders(sql);
  await sql.unsafe("CREATE FUNCTION fail_fixture_notification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private fixture failure must not leak'; END $$; CREATE TRIGGER fail_fixture_notification BEFORE INSERT ON teacher_notifications FOR EACH ROW EXECUTE FUNCTION fail_fixture_notification()");
  trigger = true;
  const beforeFailure = await count('teacher_notifications');
  for (let attempt = 1; attempt <= 5; attempt++) {
    if (attempt > 1) await sql`UPDATE notification_jobs SET available_at = NOW() WHERE class_id = ${c}`;
    const result = await runNotificationJobs(sql, 1);
    assert.equal(result[attempt === 5 ? 'failed' : 'retried'], 1);
    const [job] = await sql`SELECT attempts, status, last_error, available_at > NOW() AS delayed FROM notification_jobs WHERE class_id = ${c}`;
    assert.equal(job.attempts, attempt); assert.equal(job.status, attempt === 5 ? 'failed' : 'pending');
    assert.equal(job.delayed, true); assert.doesNotMatch(job.last_error, /private fixture/);
    if (attempt < 5) assert.equal((await runNotificationJobs(sql, 1)).retried, 0, 'Backoff must prevent a tight retry loop');
  }
  assert.equal(await count('teacher_notifications'), beforeFailure, 'Failed delivery must not leave a partial inbox entry');
  await sql.unsafe('DROP TRIGGER fail_fixture_notification ON teacher_notifications; DROP FUNCTION fail_fixture_notification()'); trigger = false;
  console.log('Phase 5 migration, deadline round-trip, atomic delivery, deduplication, stale cancellation, reassignment, suspension and retry limits passed.');

  browser = await chromium.launch();
  const admin = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
  const teacher = await browser.newContext();
  const anonymous = await browser.newContext();
  const adminToken = await fixtureSession(sql, 'admin@krya.global', 'admin');
  const teacherToken = await fixtureSession(sql, email, 'teacher');
  await admin.addCookies([{ name: 'krya_session', value: adminToken, url: base }]);
  await teacher.addCookies([{ name: 'krya_session', value: teacherToken, url: base }]);
  const page = await admin.newPage(); const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  page.setDefaultTimeout(30000); await page.goto(`${base}/admin`); await page.locator('.page-preloader').waitFor({ state: 'detached' });
  await page.getByRole('navigation', { name: 'Admin navigation' }).getByRole('button', { name: 'Delivery jobs', exact: true }).click();
  const retry = page.getByRole('button', { name: 'Retry Upcoming deadline: Syllabus', exact: true }); await retry.waitFor();
  const screenshots = join(tmpdir(), 'kryacademia-phase5-check'); await mkdir(screenshots, { recursive: true });
  for (const width of [1440, 390, 360]) {
    await page.setViewportSize({ width, height: 960 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Delivery jobs page overflow');
    await page.screenshot({ path: join(screenshots, `jobs-${width}.png`), fullPage: true });
  }
  const capture = page.waitForRequest((request) => request.method() === 'POST' && Boolean(request.headers()['next-action']));
  await retry.click(); const request = await capture;
  await retry.waitFor({ state: 'detached' });
  const [retried] = await sql`SELECT status, attempts, retried_by FROM notification_jobs WHERE class_id = ${c}`;
  assert.deepEqual({ ...retried }, { status: 'pending', attempts: 0, retried_by: 'admin@krya.global' });
  const headers = { ...request.headers(), origin: base }; delete headers.cookie; delete headers['content-length'];
  const stale = await admin.request.post(`${base}/admin`, { headers: { ...headers, cookie: `krya_session=${adminToken}` }, data: request.postDataBuffer() });
  assert.match(await stale.text(), /This job changed/);
  await sql`UPDATE notification_jobs SET status = 'failed', attempts = 5 WHERE class_id = ${c}`;
  for (const [context, token] of [[teacher, teacherToken], [anonymous, null]]) {
    const denied = await context.request.post(`${base}/admin`, { headers: { ...headers, ...(token ? { cookie: `krya_session=${token}` } : {}) }, data: request.postDataBuffer() });
    assert.doesNotMatch(await denied.text(), /"ok":true/);
    assert.equal((await sql`SELECT status FROM notification_jobs WHERE class_id = ${c}`)[0].status, 'failed', 'Only admin may reset a failed job');
  }
  assert.match(await (await admin.request.post(`${base}/admin`, { headers: { ...headers, cookie: `krya_session=${adminToken}` }, data: request.postDataBuffer() })).text(), /"ok":true/);
  assert.equal((await sql`SELECT attempts FROM notification_jobs WHERE class_id = ${c}`)[0].attempts, 0);
  const endpoint = `${base}/api/internal/notification-jobs`;
  for (const authorization of ['', 'Bearer incorrect', `Bearer ${process.env.CRON_SECRET.slice(1)}`]) {
    const denied = await teacher.request.get(endpoint, { headers: { authorization, cookie: `krya_session=${teacherToken}` } });
    assert.equal(denied.status(), 401); assert.match(denied.headers()['cache-control'], /no-store/);
  }
  const response = await anonymous.request.get(endpoint, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  assert.equal(response.status(), 200); const result = await response.json(); assert.equal(result.delivered, 1);
  assert.doesNotMatch(JSON.stringify(result), /@|Reminder fixture/);
  assert.equal((await anonymous.request.post(endpoint)).status(), 405);
  assert.equal((await (await anonymous.request.get(endpoint, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })).json()).delivered, 0);
  // Load only the route boundary to exercise a missing secret without changing the running server's environment.
  const routeSource = (await readFile(new URL('../app/api/internal/notification-jobs/route.ts', import.meta.url), 'utf8'))
    .replace("import { db } from '@/lib/db';", "const db = () => { throw new Error('Must not connect'); };")
    .replace("import { runNotificationJobs } from '@/lib/notification-jobs.mjs';", 'const runNotificationJobs = db;');
  const compiled = ts.transpileModule(routeSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const route = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  const secret = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET; assert.equal((await route.GET(new Request(endpoint))).status, 503);
    process.env.CRON_SECRET = 'short'; assert.equal((await route.GET(new Request(endpoint))).status, 503);
  }
  finally { process.env.CRON_SECRET = secret; }
  for (let i = 0; i < 2; i++) await group({ semesterStart: day(8), syllabus: day(1), meetings: [] });
  const beforeConcurrent = await count('teacher_notifications');
  const concurrent = await Promise.all([runNotificationJobs(sql, 1), runNotificationJobs(second, 1)]);
  assert.equal(concurrent.reduce((n, item) => n + item.queued, 0), 2);
  assert.equal(concurrent.reduce((n, item) => n + item.delivered, 0), 2);
  assert.equal(await count('teacher_notifications'), beforeConcurrent + 2);
  assert.equal((await sql`SELECT count(*)::int AS n FROM (SELECT source_job_id FROM teacher_notifications WHERE teacher_email = ${email} GROUP BY source_job_id HAVING count(*) > 1) duplicates`)[0].n, 0);
  const reviewedClass = await group({ semesterStart: day(9), syllabus: day(1), meetings: [] });
  const reviewedRecord = randomUUID();
  await sql`INSERT INTO teaching_records (id, teacher_email, kind, class_id, meeting_date, title, content, status)
    VALUES (${reviewedRecord}, ${email}, 'syllabus', ${reviewedClass}, ${day(9)}, 'Concurrent review fixture', '{}', 'Draft')`;
  await planDeadlineReminders(sql);
  let worker;
  await sql.begin(async (tx) => {
    await tx`SELECT id FROM teaching_records WHERE id = ${reviewedRecord} FOR UPDATE`;
    worker = runNotificationJobs(second, 1);
    let waiting = false;
    for (let i = 0; i < 100; i++) {
      await tx`SELECT pg_stat_clear_snapshot()`;
      const [state] = await tx`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name = ${workerName}
        AND wait_event_type = 'Lock' AND query LIKE '%teaching_records%') AS waiting`;
      if (state.waiting) { waiting = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(waiting, 'Worker must wait for the concurrent review');
    await tx`UPDATE teaching_records SET status = 'Approved' WHERE id = ${reviewedRecord}`;
    await notifyTeacher(tx, { ...event, key: `fixture-review:${randomUUID()}`, recordId: reviewedRecord });
  });
  assert.equal((await worker).cancelled, 1, 'A concurrent completed review must cancel the reminder without a deadlock retry');
  const [h1] = await sql`SELECT * FROM notification_jobs WHERE class_id = ${c} AND stage = 'h1'`;
  await sql`INSERT INTO notification_jobs (id, dedupe_key, teacher_email, class_id, deadline_id, due_date, stage, title, message)
    VALUES (${randomUUID()}, ${`expired-stage:${randomUUID()}`}, ${email}, ${c}, ${h1.deadline_id}, ${day(1)}, 'h3', 'Expired advance reminder', 'Do not deliver a stale H-3 alongside H-1.')`;
  assert.equal((await runNotificationJobs(sql)).cancelled, 1, 'Expired advance stages must not pile up alongside current reminders');
  assert.deepEqual(errors, []);
  console.log(`Phase 5 admin retry/role checks, cron authorization, concurrent workers and desktop/mobile layout passed. Screenshots: ${screenshots}`);
} finally {
  if (browser) await browser.close();
  if (trigger) await sql.unsafe('DROP TRIGGER IF EXISTS fail_fixture_notification ON teacher_notifications; DROP FUNCTION IF EXISTS fail_fixture_notification()');
  await clearFixtureSessions(sql);
  await sql.begin(async (tx) => {
    await tx`DELETE FROM teaching_records WHERE teacher_email = ${email}`;
    await tx`DELETE FROM teacher_notifications WHERE teacher_email = ${email}`;
    await tx`DELETE FROM notification_jobs WHERE teacher_email = ${email}`;
    await updateCatalog(tx, (data) => { data.klasses = data.klasses.filter((item) => !groups.includes(item.id)); data.coaches = data.coaches.filter((item) => item.id !== coachId); });
    await tx`DELETE FROM portal_users WHERE email = ${email}`;
  });
  await second.end(); await sql.end();
}
