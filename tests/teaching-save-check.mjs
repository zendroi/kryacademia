import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import { academy } from '../scripts/academic-modules.mjs';

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')}`;
const demo = moduleUrl(await readFile(new URL('../app/admin/adminData.ts', import.meta.url), 'utf8'));
const data = await import(moduleUrl((await readFile(new URL('../app/teacher/teacherData.ts', import.meta.url), 'utf8')).replace("'../admin/adminData'", JSON.stringify(demo))));
const config = { semesterStart: '2027-01-11', deadline: '2027-01-04', sample: true, canvaTemplate: '' };
const klass = { id: 'save-check', coachIds: ['save-coach'], deadlines: { semesterStart: '2027-02-01', syllabus: '2027-01-25', meetings: [] } };
const catalog = { klasses: [klass], students: [], institutions: [], coaches: [{ id: 'save-coach', portalEmail: 'save@example.com' }] };
let committed = false;
let failRefresh = true;
let failWrite = false;
let revision = 0;
let current;
let notices = 0;
let role = 'teacher';
const tx = async (parts, ...values) => {
  const query = parts.join('');
  if (query.includes('FROM portal_users')) return [{ email: 'save@example.com' }];
  if (query.includes('FROM portal_sessions')) return [{ id: randomUUID() }];
  if (query.includes('SELECT details.*')) return current ? [{ id: current.id, revision: current.revision, status: current.status, content: current.content, files: current.files }] : [];
  if (query.includes('INSERT INTO teaching_records')) {
    if (failWrite) throw Object.assign(new Error('write failed'), { code: 'CONNECTION_CLOSED' });
    current = { id: values[0], teacherEmail: values[1], kind: values[2], classId: values[3], date: values[4], title: values[5], status: values[6], revision: revision++, content: {}, files: [], reviewerNote: '', updatedAt: new Date().toISOString() };
    return [{ id: current.id }];
  }
  if (query.includes('UPDATE teaching_records SET status')) {
    current = { ...current, status: values[0], reviewerNote: values[1], revision: current.revision + 1 };
    return [{ teacher_email: current.teacherEmail, title: current.title }];
  }
  if (query.includes('FROM teaching_record_details')) return [current];
  return [];
};
tx.json = (value) => value;
const sql = { begin: async (fn) => { const result = await fn(tx); committed = true; return result; } };
const refresh = async () => { if (failRefresh) throw Object.assign(new Error('refresh failed'), { code: 'CONNECTION_CLOSED' }); return [current]; };
const dependencies = {
  randomUUID, db: () => sql, requireRole: async () => ({ email: 'save@example.com', role, id: randomUUID() }),
  readAcademyCatalog: async () => catalog, assignedCatalog: academy.assignedCatalog, validDate: academy.validDate,
  teachingConfig: () => config, recordLabels: data.recordLabels, validateDraft: data.validateDraft,
  writeTeachingWorkflow: async (_tx, input) => { current.content = input.content; },
  notifyTeacher: async () => { notices++; }, loadTeachingRecords: refresh, loadTeacherNotifications: refresh,
};
function withoutImports(source) {
  const file = ts.createSourceFile('module.ts', source, ts.ScriptTarget.Latest, true);
  return ts.createPrinter().printFile(ts.factory.updateSourceFile(file, file.statements.filter((node) => !ts.isImportDeclaration(node))));
}
globalThis.teachingSaveDependencies = dependencies;
const teaching = await import(moduleUrl('const {db}=globalThis.teachingSaveDependencies;\n' + withoutImports(await readFile(new URL('../lib/teaching.ts', import.meta.url), 'utf8'))));
dependencies.readTeachingRecord = teaching.readTeachingRecord;
const actions = await import(moduleUrl(`const {${Object.keys(dependencies).join(',')}}=globalThis.teachingSaveDependencies;\n` + withoutImports(await readFile(new URL('../app/teacher/actions.ts', import.meta.url), 'utf8'))));
const draft = { kind: 'request', classId: klass.id, date: klass.deadlines.semesterStart, title: 'Semester supplies', files: [], submit: true, content: { workflowVersion: 2, timing: 'Before semester', items: 'Science tools', reason: 'Class preparation' } };
const saved = await actions.saveTeachingRecord(draft);
assert.equal(committed, true);
assert.equal(saved.ok, true);
assert.ok(saved.refreshError);
assert.equal(saved.record.date, klass.deadlines.semesterStart);
assert.equal(saved.record.revision, 0);
assert.equal(saved.record.status, 'Submitted');
assert.equal(notices, 1);
role = 'admin';
const reviewed = await actions.reviewTeachingRecord(saved.record.id, 'Approved', 'Ready', saved.record.revision);
assert.equal(reviewed.ok, true);
assert.ok(reviewed.refreshError);
assert.equal(reviewed.record.status, 'Approved');
assert.equal(reviewed.record.revision, 1);
assert.equal(notices, 2);
failRefresh = false;
const rereviewed = await actions.reviewTeachingRecord(saved.record.id, 'Approved', 'Updated note', reviewed.record.revision);
assert.equal(rereviewed.ok, true);
assert.deepEqual(rereviewed.records, [current]);
role = 'teacher'; current = undefined; committed = false; failWrite = true;
const rejected = await actions.saveTeachingRecord(draft);
assert.equal(rejected.ok, false);
assert.equal(committed, false);
assert.equal(notices, 3, 'A failed write must not confirm a submission');
delete globalThis.teachingSaveDependencies;
console.log('Committed save/review survive refresh outages; failed writes stay failures; class-specific semester requests pass.');
