import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { academy } from '../scripts/academic-modules.mjs';
import { textColumn } from '../lib/sql-dialect.mjs';

async function declarations(path, names, dependencies) {
  const source = ts.createSourceFile(path, await readFile(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const selected = source.statements.filter((node) => ts.isFunctionDeclaration(node) ? names.includes(node.name?.text) : ts.isVariableStatement(node) && node.declarationList.declarations.some((item) => names.includes(item.name.getText(source))));
  assert.equal(selected.length, names.length, `Missing regression target in ${path}`);
  const code = selected.map((node) => ts.createPrinter().printNode(ts.EmitHint.Unspecified, node, source)).join('\n');
  const js = ts.transpileModule(code, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const injected = { React, exports: {}, ...dependencies };
  return new Function(...Object.keys(injected), `${js}\nreturn {${names.join(',')}};`)(...Object.values(injected));
}

const none = () => null;
const attendanceCatalog = { klasses: Array.from({ length: 3 }, (_, index) => ({ id: `attendance-${index}`, title: `Subject ${index}`, school: 'Fixture school', coachIds: ['attendance-coach'], deadlines: { semesterStart: '2026-10-01', meetings: Array.from({ length: 15 }, (_, day) => ({ date: `2026-10-${String(day + 1).padStart(2, '0')}` })) } })) };
const attendanceCoach = { id: 'attendance-coach', portalEmail: 'attendance@example.com' };
const attendanceRecords = [
  { classId: 'attendance-0', status: 'Approved', date: '2026-10-01', content: { teacherAttendance: 'Present' } },
  { classId: 'attendance-1', status: 'Approved', date: '2026-10-02', content: { teacherAttendance: 'Late' } },
  { classId: 'attendance-2', status: 'Submitted', date: '2026-10-03', content: { teacherAttendance: 'Present' } },
  ...['Draft', 'Rejected', 'Needs revision'].map((status) => ({ classId: 'attendance-0', status, date: '2026-10-04', content: { teacherAttendance: 'Present' } })),
  { classId: 'attendance-0', status: 'Approved', date: '2026-10-05', content: { teacherAttendance: 'Absent' } },
  { classId: 'attendance-0', status: 'Approved', date: '2026-10-06', content: { teacherAttendance: 'Excused' } },
  { classId: 'attendance-0', status: 'Approved', date: '2026-09-30', content: { teacherAttendance: 'Present' } },
].map((record) => ({ ...record, kind: 'meeting', teacherEmail: attendanceCoach.portalEmail }));
const totals = academy.coachAttendance(attendanceCoach, attendanceCatalog, attendanceRecords, '2026-10');
assert.equal(totals.planned, 45); assert.equal(totals.monthVerified, 2); assert.equal(totals.monthSubmitted, 1); assert.equal(totals.semesterVerified, 2);
assert.equal(academy.coachAttendance({ ...attendanceCoach, portalEmail: '' }, attendanceCatalog, attendanceRecords, '2026-10').monthVerified, 0);
const sharedAttendance = academy.coachAttendance(attendanceCoach, { ...attendanceCatalog, coaches: [attendanceCoach, { id: 'other-coach', portalEmail: attendanceCoach.portalEmail }], klasses: attendanceCatalog.klasses.map((klass, index) => ({ ...klass, coachIds: [index ? 'other-coach' : attendanceCoach.id] })) }, attendanceRecords, '2026-10');
assert.equal(sharedAttendance.monthVerified, 1); assert.equal(sharedAttendance.planned, 15); assert.equal(sharedAttendance.rows.length, 1, 'Shared demo logins must not attribute another coach profile\'s classes to this coach');
const { LoginForm } = await declarations('app/login/LoginForm.tsx', ['errors', 'LoginForm'], {
  login: none, FormPagePreloader: none, SubmitButton: none, AnimatedInput: none, ShieldCheck: none, Link003: none,
});
for (const error of ['invalid', 'unknown', '__proto__', 'constructor', 'toString']) {
  assert.match(renderToStaticMarkup(React.createElement(LoginForm, { error })), /Email atau password tidak sesuai/);
}

const klass = { id: 'group-a', title: 'Coding', school: 'School A', schedule: 'Saturday 08:00', mode: 'Online', deadlines: { semesterStart: '2027-01-11', syllabus: '2027-01-08' } };
const sibling = { ...klass, id: 'group-b', school: 'School B' };
assert.notEqual(academy.klassGroupLabel(klass, [klass, sibling]), academy.klassGroupLabel(sibling, [klass, sibling]));
assert.equal(academy.klassGroupLabel({ ...klass, schedule: '' }, []), 'Coding / School A / Online');
const identical = { ...klass, id: 'group-c' };
assert.notEqual(academy.klassGroupLabel(klass, [klass, identical]), academy.klassGroupLabel(identical, [klass, identical]));
const syllabus = { id: 'syllabus', kind: 'syllabus', classId: klass.id, date: '2027-01-11', title: 'Coding semester', status: 'Submitted', content: { deadline: '2027-01-04', sessions: [] } };
assert.equal(academy.syllabusDeadline(klass.deadlines, syllabus), '2027-01-08');
assert.equal(academy.syllabusDeadline(klass.deadlines, { ...syllabus, date: '2026-01-11' }), '2027-01-04');
assert.equal(academy.syllabusDeadline({ ...klass.deadlines, syllabus: '' }, syllabus), '');
const catalog = { klasses: [klass, sibling], students: [] };
const { ClassWorkflow } = await declarations('app/teacher/TeacherDashboard.tsx', ['ClassWorkflow'], {
  CatalogContext: {}, useContext: () => catalog, useState: React.useState, classRoster: () => [], semesterRecords: () => [syllabus],
  TeacherSelect: ({ options }) => React.createElement('div', null, options.map((option) => React.createElement('span', { key: option.id }, option.label))),
  dateLabel: (date) => date, BookOpen: none, Clock3: none, Status: none,
  klassGroupLabel: academy.klassGroupLabel, syllabusDeadline: academy.syllabusDeadline,
});
const workflow = renderToStaticMarkup(React.createElement(ClassWorkflow, { records: [syllabus], initialClass: klass.id }));
assert.match(workflow, /2027-01-08/); assert.doesNotMatch(workflow, /2027-01-04/);
assert.match(workflow, /School A/); assert.match(workflow, /School B/);
const { SyllabusFields } = await declarations('app/teacher/TeachingControls.tsx', ['SyllabusFields'], {
  sourceSyllabus: () => undefined, syllabusDeadline: academy.syllabusDeadline, CoachFields: none, RubricGuide: none,
  AnimatedInput: none, TeacherSelect: none, TeacherTextArea: none, Plus: none, Trash2: none, FileText: none, learningPhases: ['Creating'],
});
const scheduledDraft = { id: 'existing-draft', date: '2027-01-11', content: { sessions: [{ date: '2027-01-11', time: '08:00', topic: 'Preserved topic', phase: 'Creating' }] } };
const schedule = { semesterStart: '2027-01-11', syllabus: '2027-01-08', meetings: [{ date: '2027-01-11' }, { date: '2027-01-18' }] };
assert.match(renderToStaticMarkup(React.createElement(SyllabusFields, { draft: scheduledDraft, deadlines: schedule, patch: none })), /Sync admin meeting schedule/);
assert.doesNotMatch(renderToStaticMarkup(React.createElement(SyllabusFields, { draft: scheduledDraft, deadlines: { ...schedule, meetings: schedule.meetings.slice(0, 1) }, patch: none })), /Sync admin meeting schedule/);

const planned = { ...syllabus, content: { ...syllabus.content, sessions: [{ date: '2027-01-11', topic: 'Meeting one' }, { date: '2027-01-18', topic: 'Meeting two' }] } };
const { blank } = await declarations('app/teacher/TeacherDashboard.tsx', ['blank'], {
  semesterRecords: () => [planned], classRoster: () => [], emptyRatings: () => ({}), today: () => '2027-01-11',
});
const journal = { kind: 'meeting', date: '2027-01-11', content: { syllabusId: planned.id } };
for (const status of ['Draft', 'Rejected', 'Needs revision']) assert.equal(blank(catalog, 'meeting', klass.id, {}, [{ ...journal, status }]).date, '2027-01-11');
for (const status of ['Submitted', 'Approved']) assert.equal(blank(catalog, 'meeting', klass.id, {}, [{ ...journal, status }]).date, '2027-01-18');

const student = { id: 'student', name: 'Test student', school: 'School A', klass: 'Coding', classIds: [klass.id] };
const { StudentDetail } = await declarations('app/admin/AdminDashboard.tsx', ['StudentDetail'], {
  Download: none, downloadCsv: none, KlassLinks: none, dateLabel: (date) => date, initials: () => 'TS',
});
const journals = ['Draft', 'Rejected', 'Needs revision', 'Submitted', 'Approved'].map((status, index) => ({
  id: `journal-${index}`, kind: 'meeting', classId: klass.id, date: '2027-01-11', title: `Journal ${status}`, status,
  content: { students: [{ id: student.id, attendance: ['Submitted', 'Approved'].includes(status) ? 'Present' : 'Absent', feedback: `Feedback ${status}` }] },
}));
const detail = renderToStaticMarkup(React.createElement(StudentDetail, { item: student, records: catalog, submissions: journals }));
for (const status of ['Draft', 'Rejected', 'Needs revision']) assert.ok(!detail.includes(`Feedback ${status}`));
for (const status of ['Submitted', 'Approved']) assert.ok(detail.includes(`Feedback ${status}`));
assert.match(detail, /Recorded attendance<\/span><strong>100/);
assert.match(detail, /Meeting records<\/span><strong>2/);

let failRead = true; let failWrite = false; let writes = 0;
const retryTx = async (parts) => {
  if (failWrite) throw new Error('Write unavailable');
  if (parts.join('').includes('UPDATE notification_jobs')) writes++;
  return [{ id: '11111111-1111-4111-8111-111111111111' }];
};
retryTx.unsafe = (text) => text;
const { retryNotificationJob } = await declarations('app/admin/notification-actions.ts', ['retryNotificationJob'], {
  textColumn,
  requireRole: async () => ({ email: 'admin@example.com' }),
  db: () => ({ begin: (fn) => fn(retryTx) }),
  loadNotificationJobs: async () => { if (failRead) throw new Error('Read unavailable'); return []; },
});
const jobId = '11111111-1111-4111-8111-111111111111';
const retry = await retryNotificationJob(jobId);
assert.equal(retry.ok, true); assert.equal(retry.job.id, jobId); assert.ok(retry.refreshError); assert.equal(writes, 1);
failRead = false; assert.deepEqual((await retryNotificationJob(jobId)).jobs, []);
failWrite = true; assert.equal((await retryNotificationJob(jobId)).ok, false);
assert.equal((await retryNotificationJob('invalid')).ok, false);

const compiledConfig = ts.transpileModule(await readFile('next.config.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { default: config } = await import(`data:text/javascript;base64,${Buffer.from(compiledConfig).toString('base64')}`);
const [rule] = await config.headers();
assert.equal(rule.source, '/:path*');
const headers = Object.fromEntries(rule.headers.map(({ key, value }) => [key, value]));
assert.equal(headers['X-Frame-Options'], 'DENY');
assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/);
assert.equal(headers['X-Content-Type-Options'], 'nosniff');
assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
console.log('Login error keys, group labels, current/historical deadlines, student journal status, committed retry and portable headers passed.');
