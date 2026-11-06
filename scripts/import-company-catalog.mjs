import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { mysqlSql } from '../lib/mysql-tag.mjs';
import { textColumn } from '../lib/sql-dialect.mjs';
import { academy, core } from './academic-modules.mjs';
import { companyCatalog } from './company-catalog.mjs';

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith('--'));
const master = args.find((arg) => arg.startsWith('--master='))?.slice(9) || 'consensus';
if (!file || args.some((arg) => arg.startsWith('--') && arg !== '--apply' && !/^--master=(consensus|daily|schools)$/.test(arg))) throw new Error('Usage: node --env-file=.env.local scripts/import-company-catalog.mjs workbook.xlsx [--master=consensus|daily|schools] [--apply]');
const workbook = JSON.parse(execFileSync(process.env.PYTHON || 'python', [fileURLToPath(new URL('./read-company-workbook.py', import.meta.url)), resolve(file)], { encoding: 'utf8', maxBuffer: 5_000_000, windowsHide: true }));
const source = companyCatalog(workbook, master);
const url = new URL(process.env.DATABASE_URL);
const sql = url.protocol === 'mysql:' ? mysqlSql(url.href) : postgres(url.href, { ssl: ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? false : 'verify-full', max: 1, onnotice: () => {} });
const apply = args.includes('--apply');
const actor = 'import:ekskul-2026-2027';
const nameKey = (value = '') => value.toLowerCase().replace(/[^a-z0-9]/g, '');
try {
  const result = await sql.begin(async (tx) => {
    await tx`SELECT id FROM academy_core_state WHERE id = 1 FOR UPDATE`;
    const [archive] = await tx`SELECT md5(${textColumn(tx, 'content')}) AS hash FROM academy_catalog WHERE id = 1`;
    const [history] = await tx`SELECT count(*) AS count FROM teaching_records`;
    const catalog = await core.readAcademicCore(tx);
    const next = structuredClone(catalog);
    const prior = await tx`SELECT entity_kind, entity_id, after_data FROM academy_events WHERE actor_email = ${actor} ORDER BY entity_kind, entity_id, created_at DESC`;
    const changes = [];
    const retainedEdits = [];
    function merge(kind, existing, candidate, fields, refs) {
      const previous = prior.find((event) => event.entity_kind === kind && event.entity_id === candidate.id)?.after_data?._companySource?.fields || {};
      const record = existing ? { ...existing } : { ...candidate };
      const values = {};
      for (const field of fields) {
        if (candidate[field] == null || (candidate[field] === '' && existing)) continue;
        const old = existing?.[field];
        const writable = !existing || JSON.stringify(old) === JSON.stringify(previous[field]) || (!Object.hasOwn(previous, field) && (old === undefined || old === null || old === '' || (Array.isArray(old) && !old.length) || ((existing.revision || 0) === 0 && field === 'name')));
        if (JSON.stringify(old) === JSON.stringify(candidate[field])) { values[field] = candidate[field]; continue; }
        if (!writable) { retainedEdits.push({ kind, id: record.id, field }); continue; }
        record[field] = candidate[field]; values[field] = candidate[field];
      }
      if (!existing || Object.keys(values).some((field) => JSON.stringify(existing[field]) !== JSON.stringify(record[field]))) {
        record.revision = (existing?.revision || 0) + 1;
        if (existing) next[kind][next[kind].findIndex((item) => item.id === existing.id)] = record;
        else next[kind].push(record);
        changes.push({ kind, before: existing || {}, record, source: { sha256: source.sha256, master, refs, fields: { ...previous, ...values } } });
      }
      return record;
    }
    const institutionIds = new Map();
    for (const item of source.institutions) {
      const existing = next.institutions.find((record) => record.id === item.id || nameKey(record.name) === nameKey(item.name));
      const id = existing?.id || item.id; institutionIds.set(item.id, id);
      merge('institutions', existing, { id, name: item.name, city: '', country: 'Indonesia', logo: '', about: '', address: '', contactName: '', email: '', phone: '', website: '', classes: 0, students: 0, reportedStudents: item.reportedStudents }, ['name', 'reportedStudents'], item.source);
    }
    const coachIds = new Map();
    for (const name of [...new Set(source.groups.flatMap((group) => group.coaches))]) {
      const id = `official-coach-${nameKey(name)}`;
      const existing = next.coaches.find((record) => record.id === id);
      if (!existing && next.coaches.some((record) => nameKey(record.name) === nameKey(name))) retainedEdits.push({ kind: 'coaches', id, field: 'identity', reason: 'Same-name legacy profile not merged or granted new class access; admin must verify identity' });
      coachIds.set(name, id);
      const specialty = [...new Set(source.groups.filter((group) => group.coaches.includes(name)).map((group) => group.title))].join(', ');
      merge('coaches', existing, { id, name, specialty, level: 'Coach', image: '', email: '', portalEmail: '', bio: '', classes: 0, students: 0 }, ['specialty'], source.groups.filter((group) => group.coaches.includes(name)).flatMap((group) => group.sources));
    }
    for (const item of source.groups) {
      const institutionId = institutionIds.get(item.institutionId);
      const legacyId = `request-${item.institutionId}-${item.typeId}`;
      const existing = next.klasses.find((record) => record.id === item.id || (!item.groupName && record.id === legacyId));
      const type = next.klasses.find((record) => nameKey(record.title) === nameKey(item.title));
      const candidate = { id: existing?.id || item.id, klassTypeId: type?.klassTypeId || type?.id || `official-type-${item.typeId}`, institutionId, title: type?.title || item.title, category: type?.category || item.category, description: type?.description || '', image: type?.image || '', groupName: item.groupName, plannedMeetings: item.plannedMeetings, reportedStudents: item.reportedStudents, mode: 'Onsite', schedule: item.schedule, coachIds: item.coaches.map((name) => coachIds.get(name)), coaches: [], school: '', students: 0, deadlines: academy.emptyDeadlines() };
      if (existing?.deadlines?.meetings.length > candidate.plannedMeetings && candidate.plannedMeetings !== null) { retainedEdits.push({ kind: 'klasses', id: candidate.id, field: 'plannedMeetings', reason: 'Configured dates exceed source target' }); candidate.plannedMeetings = null; }
      merge('klasses', existing, candidate, ['groupName', 'plannedMeetings', 'reportedStudents', 'schedule', 'coachIds'], item.sources);
    }
    const directory = resolve('outputs', 'company-import', `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`);
    if (apply && changes.length) {
      await mkdir(directory, { recursive: true });
      await writeFile(resolve(directory, 'catalog-before.json'), JSON.stringify(catalog, null, 2), { flag: 'wx', mode: 0o600 });
      await core.writeAcademicCore(tx, academy.catalogCounts(next), catalog);
      for (const { kind, before, record, source: metadata } of changes) await tx`INSERT INTO academy_events (id, actor_email, entity_kind, entity_id, action, before_data, after_data) VALUES (${randomUUID()}, ${actor}, ${kind}, ${record.id}, ${before.id ? 'update' : 'create'}, ${tx.json(before)}, ${tx.json({ ...record, _companySource: metadata })})`;
    }
    assert.equal((await tx`SELECT md5(${textColumn(tx, 'content')}) AS hash FROM academy_catalog WHERE id = 1`)[0].hash, archive.hash, 'Historical JSON catalog must not change');
    assert.equal((await tx`SELECT count(*) AS count FROM teaching_records`)[0].count, history.count, 'Teaching submissions must be preserved');
    const report = { applied: apply, file: source.file, sha256: source.sha256, master, institutions: source.institutions.length, groups: source.groups.length, reportedStudents: source.institutions.reduce((sum, item) => sum + (item.reportedStudents ?? 0), 0), changes: changes.map(({ kind, before, record }) => ({ kind, id: record.id, action: before.id ? 'update' : 'create', label: record.name || `${record.title}${record.groupName ? ` / ${record.groupName}` : ''}` })), retainedEdits, conflicts: source.conflicts, pending: source.pending, notImported: source.notImported, preservedCatalogHash: archive.hash, teachingRecordsPreserved: history.count, note: 'Old records remain active until archival is confirmed. Onsite for new school groups is provisional; admin must verify mode, coach identities/accounts, meeting dates and deadlines.' };
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, 'report.json'), JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
    return { ...report, reportDirectory: directory };
  });
  console.log(JSON.stringify(result, null, 2));
} finally { await sql.end(); }
