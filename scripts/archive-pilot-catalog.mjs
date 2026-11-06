import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { mysqlSql } from '../lib/mysql-tag.mjs';
import { textColumn } from '../lib/sql-dialect.mjs';
import { academy, core } from './academic-modules.mjs';

const apply = process.argv.includes('--apply');
assert.ok(process.argv.slice(2).every((arg) => arg === '--apply'), 'Use --apply only after inspecting the preview');
const url = new URL(process.env.DATABASE_URL);
const sql = url.protocol === 'mysql:' ? mysqlSql(url.href) : postgres(url.href, { ssl: ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? false : 'verify-full', max: 1, onnotice: () => {} });
try {
  const report = await sql.begin(async (tx) => {
    await tx`SELECT id FROM academy_core_state WHERE id = 1 FOR UPDATE`;
    const [before] = await tx`SELECT md5(${textColumn(tx, 'content')}) AS hash FROM academy_catalog WHERE id = 1`;
    const [history] = await tx`SELECT count(*) AS count FROM teaching_records`;
    const catalog = await core.readAcademicCore(tx);
    const seed = academy.seedCatalog();
    const archive = { klasses: [], institutions: [], coaches: [], students: [] };
    const skipped = [];
    for (const item of catalog.klasses) {
      const prototype = seed.klasses.find((record) => record.id === item.id);
      if (prototype && prototype.title === item.title && prototype.institutionId === item.institutionId) archive.klasses.push(item);
    }
    for (const id of ['request-sma-dharma-mulya-technova', 'request-smp-dharma-mulya-technova']) {
      const item = catalog.klasses.find((record) => record.id === id);
      if (!item || !catalog.klasses.some((group) => group.institutionId === item.institutionId && group.groupName)) continue;
      const [used] = await tx`SELECT EXISTS (SELECT 1 FROM teaching_records WHERE class_id = ${id}) OR EXISTS (SELECT 1 FROM enrollments WHERE class_group_id = ${id} AND status = 'active') OR EXISTS (SELECT 1 FROM coach_assignments WHERE class_group_id = ${id}) AS used`;
      if (!used.used && !item.schedule && !item.deadlines?.meetings.length) archive.klasses.push(item);
      else skipped.push({ kind: 'klasses', id, reason: 'Aggregate group is in use; not archived automatically' });
    }
    for (const item of catalog.students) {
      const prototype = seed.students.find((record) => record.id === item.id);
      if (prototype?.name === item.name && (item.classIds || []).every((id) => archive.klasses.some((group) => group.id === id))) archive.students.push(item);
    }
    for (const item of catalog.coaches) {
      const prototype = seed.coaches.find((record) => record.id === item.id);
      if (prototype?.name === item.name && item.email.endsWith('@example.com') && !catalog.klasses.some((group) => !archive.klasses.some((old) => old.id === group.id) && group.coachIds?.includes(item.id))) archive.coaches.push(item);
    }
    for (const item of catalog.institutions) {
      const prototype = seed.institutions.find((record) => record.id === item.id);
      if (prototype?.name !== item.name) continue;
      if (!catalog.klasses.some((group) => group.institutionId === item.id && !archive.klasses.some((old) => old.id === group.id)) && !catalog.students.some((student) => student.institutionId === item.id && !archive.students.some((old) => old.id === student.id))) archive.institutions.push(item);
      else skipped.push({ kind: 'institutions', id: item.id, reason: 'Institution still has non-pilot active records' });
    }
    const ciputra = catalog.klasses.find((item) => item.id === 'official-ciputra-kasih-digital-animation');
    assert.ok(ciputra, 'Import the official company catalog before applying this cleanup');
    const corrected = { ...ciputra, schedule: 'Monday, 15:00 - 16:00', revision: (ciputra.revision || 0) + 1 };
    const correctionNeeded = ciputra.schedule !== corrected.schedule;
    const changed = correctionNeeded || Object.values(archive).some((items) => items.length);
    const directory = resolve('outputs/company-import', `archive-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`);
    const tables = { klasses: 'class_groups', institutions: 'institutions', coaches: 'coach_profiles', students: 'student_profiles' };
    if (apply && changed) {
      await mkdir(directory, { recursive: true });
      await writeFile(resolve(directory, 'catalog-before.json'), JSON.stringify(catalog, null, 2), { flag: 'wx', mode: 0o600 });
      if (correctionNeeded) {
        await core.writeAcademicCore(tx, { ...catalog, klasses: catalog.klasses.map((item) => item.id === corrected.id ? corrected : item) }, catalog);
        await tx`INSERT INTO academy_events (id, actor_email, entity_kind, entity_id, action, before_data, after_data) VALUES (${randomUUID()}, 'user-confirmed:2026-10-24', 'klasses', ${corrected.id}, 'update', ${tx.json(ciputra)}, ${tx.json({ ...corrected, confirmation: 'User confirmed Ciputra 15:00-16:00 in chat' })})`;
      }
      for (const [kind, items] of Object.entries(archive)) {
        if (!items.length) continue;
        await tx`UPDATE ${tx(tables[kind])} SET active = FALSE, revision = revision + 1, updated_at = NOW() WHERE id IN ${tx(items.map((item) => item.id))}`;
        for (const item of items) await tx`INSERT INTO academy_events (id, actor_email, entity_kind, entity_id, action, before_data, after_data) VALUES (${randomUUID()}, 'user-confirmed:2026-10-24', ${kind}, ${item.id}, 'update', ${tx.json(item)}, ${tx.json({ ...item, active: false, reason: 'Archive known pilot seed or unused superseded aggregate; keep history and references' })})`;
      }
    }
    assert.equal((await tx`SELECT md5(${textColumn(tx, 'content')}) AS hash FROM academy_catalog WHERE id = 1`)[0].hash, before.hash);
    assert.equal((await tx`SELECT count(*) AS count FROM teaching_records`)[0].count, history.count);
    return { applied: apply, ciputra: { schedule: corrected.schedule, changed: correctionNeeded }, archive: Object.fromEntries(Object.entries(archive).map(([kind, items]) => [kind, items.map((item) => ({ id: item.id, name: item.name || item.title }))])), skipped, teachingRecordsPreserved: history.count, preservedCatalogHash: before.hash, backupDirectory: apply && changed ? directory : null };
  });
  console.log(JSON.stringify(report, null, 2));
} finally { await sql.end(); }
