import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';
import { mysqlPool, inspectMySQL } from '../lib/mysql-connection.mjs';
import { exportHostinger, loadHostingerExport, prepareHostinger, importHostinger, restoreMySQLCheck, tables } from '../scripts/hostinger-data.mjs';
import { stagePrivateFile, readPrivateFile, privateFileDirectory, cleanupPrivateFiles } from '../lib/private-files.mjs';
import { core, workflow } from '../scripts/academic-modules.mjs';
import { hashPassword, verifyPassword } from '../lib/passwords.mjs';
import { prepareMySQLRuntime } from '../scripts/mysql-runtime.mjs';
import { mysqlSql } from '../lib/mysql-tag.mjs';
import { notifyTeacher, runNotificationJobs } from '../lib/notification-jobs.mjs';
import { hostingerBrowserCheck } from './hostinger-browser-check.mjs';

// Local disposable Docker databases only; never use .env.local for this test.
const sourceURL = new URL('postgres://postgres:krya_local_migration_check@127.0.0.1:5433/krya_migration_check');
const mariaDB = process.argv.includes('--mariadb');
const targetURL = new URL(`mysql://root:krya_local_migration_check@127.0.0.1:${mariaDB ? 3308 : 3307}/krya_migration_check`);
const name = `hostinger_check_${randomUUID().replaceAll('-', '')}`;
const violatesCheck = (error) => [3819, 4025].includes(error.errno);
const admin = postgres(sourceURL.href, { max: 1, onnotice: () => {} });
sourceURL.searchParams.set('options', `-c search_path=${name},public`);
const source = postgres(sourceURL.href, { max: 1, onnotice: () => {} });
const root = await mkdtemp(join(tmpdir(), 'krya-hostinger-check-'));
assert.throws(() => privateFileDirectory(join(process.cwd(), 'uploads')), /outside/);
assert.throws(() => privateFileDirectory(join(tmpdir(), 'public_html', 'uploads')), /outside/);
assert.throws(() => privateFileDirectory('uploads'), /absolute/);
await mkdir(join(root, 'source-files'));
process.env.DATABASE_URL = sourceURL.href;
process.env.PORTAL_LOCAL_FILE_DIR = join(root, 'source-files');
process.env.BACKUP_KEY = randomBytes(32).toString('hex');
const targetAdmin = mysqlPool(targetURL.href);
await targetAdmin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`);
targetURL.pathname = `/${name}`;
const target = mysqlPool(targetURL.href); const connection = await target.getConnection();
let sourceCreated = false;
try {
  const server = await inspectMySQL(connection);
  assert.equal(server.engine, mariaDB ? 'mariadb' : 'mysql');
  console.log(`Testing ${server.engine} ${server.version} on an isolated local database.`);
  await admin`CREATE SCHEMA ${admin(name)}`; sourceCreated = true;
  await source.begin(async (tx) => {
    await tx`SET LOCAL search_path TO ${tx(name)}`;
    for (const file of ['init', 'teacher', 'academy', 'academic-core', 'inquiry', 'security', 'phase3', 'phase4', 'phase5', 'portal-revisions']) await tx.unsafe(await readFile(new URL(`../database/${file}.sql`, import.meta.url), 'utf8'));
  });
  assert.equal((await source`SELECT current_schema() AS name`)[0].name, name);
  await source`ALTER TABLE portal_users ADD COLUMN ktp_number TEXT NOT NULL DEFAULT '', ADD COLUMN bank_name TEXT NOT NULL DEFAULT '', ADD COLUMN bank_account TEXT NOT NULL DEFAULT '', ADD COLUMN phone TEXT NOT NULL DEFAULT '', ADD COLUMN temp_password TEXT NOT NULL DEFAULT ''`;
  await source`ALTER TABLE class_groups ADD COLUMN canva_url TEXT NOT NULL DEFAULT '', ADD COLUMN target_meetings INT NOT NULL DEFAULT 0`;
  await source.begin(core.initializeAcademicCore);
  const password = 'Hostinger-test-only-2026!';
  await source`UPDATE portal_users SET password_hash = ${await hashPassword(password)}`;
  const [{ id: archivedInstitution }] = await source`SELECT id FROM institutions ORDER BY id LIMIT 1`;
  await source`UPDATE institutions SET active=FALSE WHERE id=${archivedInstitution}`;
  const meeting = randomUUID(); const image = randomUUID(); const identity = randomUUID();
  const timestamp = '2026-11-02 09:15:12.123456+00';
  await source`INSERT INTO teaching_records (id,teacher_email,kind,class_id,meeting_date,title,content,files,status,reviewer_note,updated_at) VALUES (${meeting},'teacher@krya.global','meeting','coding','2026-11-02','中文 / Pertemuan ✅',${source.json({ notes: 'Private fixture content', students: [] })},${source.json([])},'Approved','Reviewed',${timestamp}::text::timestamptz)`;
  const bytes = Buffer.from('Synthetic private document. Never execute uploaded content.');
  const objectId = await stagePrivateFile(source, { bytes, mime: 'image/webp' });
  await source`INSERT INTO academy_images (id,name,mime,object_id) VALUES (${image},'fixture.webp','image/webp',${objectId})`;
  await source`INSERT INTO teacher_onboarding (email,invitation_hash,expires_at,completed_at,identity_object_id,bank_name,bank_account,account_holder) VALUES ('teacher@krya.global',${identity},NOW()+INTERVAL '1 day',NOW(),${objectId},'Fixture Bank','00001234','Fixture Teacher')`;
  await source`INSERT INTO teaching_files (id,record_id,name,mime,bytes,size,position) VALUES (${randomUUID()},${meeting},'legacy.webp','image/webp',${bytes},${bytes.length},0)`;
  const invitation = randomUUID();
  await source`INSERT INTO inquiries (id,submission_hash,name,email,phone,place,type,affiliation,institution,message,language,details) VALUES (${invitation},'test','中文 Student','fixture@example.com','0812345678','Surabaya','Klass','Parent','','Fixture message','id',${source.json({ z: null, a: [1, true, '中文'] })})`;
  assert.equal((await prepareHostinger(connection)).tables, tables.length);
  await assert.rejects(prepareHostinger(connection), /empty dedicated database/);
  const output = join(root, 'export');
  const exported = await exportHostinger(output);
  assert.equal(exported.files, 1);
  assert.ok(exported.rows > 10);
  for (const file of await readdir(output)) assert.ok(file.endsWith('.enc'));
  const original = await readFile(join(output, 'inquiries.enc'));
  assert.equal(original.includes(Buffer.from('fixture@example.com')), false, 'No plaintext PII in exports');
  const damaged = Buffer.from(original); damaged[damaged.length - 1] ^= 1;
  await writeFile(join(output, 'inquiries.enc'), damaged);
  await assert.rejects(loadHostingerExport(output));
  await writeFile(join(output, 'inquiries.enc'), original);
  const previousKey = process.env.BACKUP_KEY; process.env.BACKUP_KEY = randomBytes(32).toString('hex');
  await assert.rejects(loadHostingerExport(output)); process.env.BACKUP_KEY = previousKey;
  const preview = await importHostinger(connection, output, join(root, 'target-files'));
  assert.equal(preview.applied, false);
  assert.equal(Number((await connection.query('SELECT COUNT(*) AS count FROM portal_users'))[0][0].count), 0);
  await connection.query("ALTER TABLE inquiries ADD CONSTRAINT migration_failure_test CHECK (language='zh')");
  await assert.rejects(importHostinger(connection, output, join(root, 'rollback-files'), true), violatesCheck);
  for (const table of tables) assert.equal(Number((await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``))[0][0].count), 0, 'Failed import must roll back every table');
  await connection.query(`ALTER TABLE inquiries DROP ${mariaDB ? 'CONSTRAINT' : 'CHECK'} migration_failure_test`);
  const applied = await importHostinger(connection, output, join(root, 'target-files'), true);
  assert.equal(applied.applied, true);
  await assert.rejects(importHostinger(connection, output, join(root, 'duplicate-files'), true), /not empty/);
  const [[user]] = await connection.execute('SELECT password_hash FROM portal_users WHERE email=?', ['teacher@krya.global']);
  assert.equal(await verifyPassword(password, user.password_hash), true);
  assert.equal((await connection.execute('SELECT active FROM institutions WHERE id=?', [archivedInstitution]))[0][0].active, 0, 'Archived records must remain archived');
  const [[record]] = await connection.execute('SELECT status,title,updated_at FROM teaching_records WHERE id=?', [meeting]);
  assert.equal(record.status, 'Approved'); assert.equal(record.title, '中文 / Pertemuan ✅'); assert.equal(record.updated_at, '2026-11-02 09:15:12.123456');
  const [[onboarding]] = await connection.query("SELECT bank_account FROM teacher_onboarding WHERE email='teacher@krya.global'");
  assert.equal(onboarding.bank_account, '00001234');
  const [[object]] = await connection.execute('SELECT * FROM portal_file_objects WHERE id=?', [objectId]);
  process.env.PORTAL_LOCAL_FILE_DIR = join(root, 'target-files');
  assert.deepEqual(await readPrivateFile(object), bytes);
  assert.equal((await source`SELECT provider FROM portal_file_objects WHERE id=${objectId}`)[0].provider, 'local');
  assert.equal((await source`SELECT updated_at::text AS value FROM teaching_records WHERE id=${meeting}`)[0].value, '2026-11-02 09:15:12.123456+00');
  await assert.rejects(connection.execute('UPDATE teacher_onboarding SET identity_object_id=? WHERE email=?', [randomUUID(),'teacher@krya.global']), /foreign key constraint/);
  await assert.rejects(connection.execute('UPDATE portal_users SET role=? WHERE email=?', ['owner','teacher@krya.global']), violatesCheck);
  await assert.rejects(connection.execute('UPDATE portal_file_objects SET sha256=? WHERE id=?', ['A'.repeat(64), objectId]), violatesCheck);
  await prepareMySQLRuntime(connection);
  const runtime = mysqlSql(targetURL.href);
  try {
    const catalog = await runtime.begin(core.readAcademicCore);
    const prior = await source.begin(core.readAcademicCore);
    assert.deepEqual(catalog, prior, 'Catalog must render identically on both engines');
    await runtime.begin(async (tx) => {
      const current = await core.readAcademicCore(tx);
      const next = structuredClone(current); next.klasses[0].reportedStudents = 42;
      next.klasses[0].deadlines = { semesterStart: '2027-01-11', syllabus: '2027-01-04', semesterRequest: '2027-01-04', meetings: [{ date: '2027-01-12', canvaUrl: '', worksheetUrl: '', lessonPlan: '2027-01-11', feedback: '2027-01-13', request: '2027-01-11' }] };
      await core.writeAcademicCore(tx, next, current);
    });
    assert.equal((await runtime.begin(core.readAcademicCore)).klasses[0].reportedStudents, 42);
    const cases = [
      ['syllabus', { workflowVersion: 2, academicYear: '2026/2027', semester: '1', deadline: '2026-11-01', sessions: [{ date: '2026-11-03', time: '15:00', topic: '中文', phase: 'Inspiring' }] }],
      ['lesson-plan', { workflowVersion: 2, steps: [{ title: 'Explore', phase: 'Exploring', minutes: '10', purpose: 'Learn', teacherActivity: 'Coach', studentActivity: 'Make' }] }],
      ['meeting', { workflowVersion: 2, teacherAttendance: 'Present', reflection: 'Class feedback', students: [{ id: 'historical-student', name: 'Fixture pupil', attendance: 'Present', score: '100', feedback: 'Good progress', ratings: { affective: '4', problemSolving: '3', storytelling: '2', performance: '1' } }] }],
      ['slides', { workflowVersion: 2, canvaUrl: 'https://www.canva.com/design/fixture/view' }],
      ['request', { workflowVersion: 2, timing: 'Before class', reason: 'Practice', requestLines: [{ id: randomUUID(), name: 'Paper', quantity: '2', adminNote: 'Approved item' }] }],
    ];
    cases[0][1].sessions.push({ date: '2026-11-02', time: '09:30', topic: 'Second position, earlier date', phase: 'Creating' });
    cases[1][1].steps.push({ title: 'Apply', phase: 'Applying', minutes: '15', purpose: 'Practice', teacherActivity: 'Guide', studentActivity: 'Build' });
    cases[2][1].students.push({ id: 'historical-student-2', name: 'Second pupil', attendance: 'Absent', score: '', feedback: '' });
    cases[4][1].requestLines.push({ id: randomUUID(), name: 'Second item', quantity: '3', adminNote: '' });
    for (const [kind, content] of cases) {
      const record = { id: randomUUID(), kind, classId: 'coding', date: '2026-11-03', content };
      for (const sql of [source, runtime]) await sql.begin(async (tx) => {
        await tx`INSERT INTO teaching_records (id,teacher_email,kind,class_id,meeting_date,title,status) VALUES (${record.id},'teacher@krya.global',${kind},'coding',${record.date},'Fixture document','Draft')`;
        await workflow.writeTeachingWorkflow(tx, record);
      });
      const [pgView] = await source`SELECT content,files FROM teaching_record_details WHERE id=${record.id}`;
      const [myView] = await runtime`SELECT content,files FROM teaching_record_details WHERE id=${record.id}`;
      assert.deepEqual(myView, pgView, `${kind} view must preserve content, order and types`);
    }
    await assert.rejects(runtime.begin(async (tx) => { await tx`UPDATE portal_users SET display_name='must rollback' WHERE email='teacher@krya.global'`; throw new Error('rollback fixture'); }), /rollback fixture/);
    assert.notEqual((await runtime`SELECT display_name FROM portal_users WHERE email='teacher@krya.global'`)[0].display_name, 'must rollback');
    await runtime.begin(async (tx) => {
      await assert.rejects(tx.savepoint(async (sp) => { await sp`UPDATE portal_users SET display_name='savepoint rollback' WHERE email='teacher@krya.global'`; throw new Error('savepoint fixture'); }), /savepoint fixture/);
      assert.notEqual((await tx`SELECT display_name FROM portal_users WHERE email='teacher@krya.global'`)[0].display_name, 'savepoint rollback');
    });
    const notification = { key: 'fixture:dedupe', teacherEmail: 'teacher@krya.global', recordId: meeting, title: 'Fixture', message: 'Fixture message' };
    await Promise.all([runtime.begin((tx) => notifyTeacher(tx, notification)), runtime.begin((tx) => notifyTeacher(tx, notification))]);
    assert.equal(Number((await runtime`SELECT count(*) AS count FROM notification_jobs WHERE dedupe_key='fixture:dedupe'`)[0].count), 1);
    const [{ tomorrow }] = await runtime`SELECT CAST(DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR) + INTERVAL 1 DAY AS CHAR) AS tomorrow`;
    await runtime`INSERT INTO submission_deadlines (id,class_group_id,kind,meeting_date,due_date) VALUES ('fixture-reminder','coding','meeting','2030-01-01',${tomorrow})`;
    const jobs = await runNotificationJobs(runtime);
    assert.ok(jobs.delivered >= 1, `Due reminders should be delivered: ${JSON.stringify(jobs)}`);
    assert.equal((await runNotificationJobs(runtime)).delivered, 0, 'Reminder rerun must not duplicate delivery');
    const orphanId = await stagePrivateFile(runtime, { bytes, mime: 'image/webp' });
    const [orphan] = await runtime`SELECT * FROM portal_file_objects WHERE id=${orphanId}`;
    assert.deepEqual(await readPrivateFile(orphan), bytes, 'New MySQL uploads must survive disk read and integrity verification');
    await runtime`UPDATE portal_file_objects SET created_at=UTC_TIMESTAMP() - INTERVAL 25 HOUR WHERE id=${orphanId}`;
    assert.equal(await cleanupPrivateFiles(runtime), 1);
    assert.equal((await runtime`SELECT id FROM portal_file_objects WHERE id=${orphanId}`).length, 0);
    assert.deepEqual(await readPrivateFile(object), bytes, 'Cleanup must keep referenced identity/documentation files');
    process.env.DATABASE_URL = targetURL.href;
    if (process.argv.includes('--browser')) await hostingerBrowserCheck(runtime, targetURL.href, password, objectId);
    const workbook = process.argv.find((arg) => arg.startsWith('--company-workbook='))?.slice('--company-workbook='.length);
    if (workbook) {
      const run = (file, args = []) => JSON.parse(execFileSync(process.execPath, [file, ...args], { env: process.env, encoding: 'utf8', windowsHide: true, timeout: 180000, maxBuffer: 2000000 }));
      assert.equal(run('scripts/import-class-request-catalog.mjs').applied, false);
      run('scripts/import-class-request-catalog.mjs', ['--apply']);
      assert.equal(run('scripts/import-class-request-catalog.mjs', ['--apply']).additions.length, 0);
      assert.equal(run('scripts/import-company-catalog.mjs', [workbook]).applied, false);
      run('scripts/import-company-catalog.mjs', [workbook, '--apply']);
      assert.equal(run('scripts/import-company-catalog.mjs', [workbook, '--apply']).changes.length, 0);
      assert.equal(run('scripts/archive-pilot-catalog.mjs').applied, false);
      run('scripts/archive-pilot-catalog.mjs', ['--apply']);
      assert.ok(Object.values(run('scripts/archive-pilot-catalog.mjs', ['--apply']).archive).every((items) => items.length === 0));
      assert.equal(run('scripts/import-company-catalog.mjs', [workbook, '--apply']).changes.length, 0, 'Reimport must preserve archives and confirmed schedules');
      console.log('MySQL company CLI: preview/apply, repeated imports and archival preserve history and remain idempotent.');
    }
    const mysqlBackup = join(root, 'mysql-backup');
    const saved = await exportHostinger(mysqlBackup);
    await assert.rejects(exportHostinger(mysqlBackup), { code: 'EEXIST' });
    assert.ok(saved.rows > exported.rows);
    const restoreName = `${name}_restore`;
    await targetAdmin.query(`CREATE DATABASE \`${restoreName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`);
    const restoreURL = new URL(targetURL); restoreURL.pathname = `/${restoreName}`;
    process.env.MYSQL_RESTORE_DATABASE_URL = targetURL.href;
    process.env.MYSQL_RESTORE_FILE_DIR = join(root, 'restored-files');
    try {
      await assert.rejects(restoreMySQLCheck(mysqlBackup), /differ from the live database/);
      process.env.MYSQL_RESTORE_DATABASE_URL = restoreURL.href;
      assert.equal((await restoreMySQLCheck(mysqlBackup)).verified, true);
    } finally { await targetAdmin.query(`DROP DATABASE \`${restoreName}\``); }
    process.env.DATABASE_URL = sourceURL.href;
    console.log(`${server.engine} runtime: catalog read/write, five teaching document kinds, ordered JSON views, transaction/savepoint rollback, notification concurrency and reminder deduplication passed.`);
  } finally { await runtime.end(); }
  console.log(`Hostinger migration passed: ${tables.length} tables, encrypted export, tamper rejection, preview, full content verification, password, archive/history fields, binary files, UTC microseconds, leading-zero bank account, FK/check constraints, nonempty-target refusal. Synthetic artifacts: ${root}`);
} finally {
  connection.release(); await target.end();
  await targetAdmin.query(`DROP DATABASE \`${name}\``); await targetAdmin.end();
  await source.end();
  if (sourceCreated) await admin`DROP SCHEMA ${admin(name)} CASCADE`;
  await admin.end();
}
