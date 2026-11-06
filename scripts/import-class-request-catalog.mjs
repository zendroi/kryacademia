import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { mysqlSql } from '../lib/mysql-tag.mjs';
import { textColumn } from '../lib/sql-dialect.mjs';
import { academy, core } from './academic-modules.mjs';

const source = JSON.parse(await readFile(new URL('../data/class-request-catalog.json', import.meta.url), 'utf8'));
const url = new URL(process.env.DATABASE_URL);
const sql = url.protocol === 'mysql:' ? mysqlSql(url.href) : postgres(url.href, { ssl: ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? false : 'verify-full', max: 1, onnotice: () => {} });
const apply = process.argv.includes('--apply');
try {
  const result = await sql.begin(async (tx) => {
    await tx`SELECT id FROM academy_core_state WHERE id = 1 FOR UPDATE`;
    const [before] = await tx`SELECT md5(${textColumn(tx, 'content')}) AS hash FROM academy_catalog WHERE id = 1`;
    const catalog = await core.readAcademicCore(tx);
    const next = structuredClone(catalog);
    const added = [];
    const institutionIds = new Map();
    const nameKey = (value) => value.trim().replace(/\s+/g, ' ').toLowerCase();
    for (const item of source.institutions) {
      const existing = next.institutions.find((record) => record.id === item.id || nameKey(record.name) === nameKey(item.name));
      institutionIds.set(item.id, existing?.id || item.id);
      if (existing) continue;
      const record = { id: item.id, name: item.name, city: '', country: 'Indonesia', logo: '', about: '', address: '', contactName: '', email: '', phone: '', website: '', revision: 0, classes: 0, students: 0 };
      next.institutions.push(record); added.push({ kind: 'institutions', record });
    }
    for (const item of source.klasses) {
      const id = `request-${item.institutionId}-${item.typeId}`;
      const institutionId = institutionIds.get(item.institutionId);
      if (next.klasses.some((record) => record.id === id || (record.institutionId === institutionId && nameKey(record.title) === nameKey(item.title)))) continue;
      const type = next.klasses.find((record) => record.title.toLowerCase() === item.title.toLowerCase());
      const record = { id, klassTypeId: type?.klassTypeId || type?.id || `request-type-${item.typeId}`, institutionId, title: type?.title || item.title, category: type?.category || item.category, image: type?.image || item.image, description: type?.description || '', mode: 'Onsite', schedule: '', school: '', coaches: [], coachIds: [], students: 0, deadlines: academy.emptyDeadlines(), revision: 0 };
      next.klasses.push(record); added.push({ kind: 'klasses', record });
    }
    if (apply) {
      await core.writeAcademicCore(tx, academy.catalogCounts(next), catalog);
      for (const { kind, record } of added) await tx`INSERT INTO academy_events (id, actor_email, entity_kind, entity_id, action, before_data, after_data) VALUES (${randomUUID()}, 'import:class-request.xlsx', ${kind}, ${record.id}, 'create', '{}', ${tx.json(record)})`;
    }
    assert.equal((await tx`SELECT md5(${textColumn(tx, 'content')}) AS hash FROM academy_catalog WHERE id = 1`)[0].hash, before.hash, 'The historical catalog must not change');
    return { applied: apply, additions: added.map(({ kind, record }) => ({ kind, id: record.id, name: record.name || record.title })), preservedCatalogHash: before.hash, institutionsWithoutKlasses: ['Gloria 1', 'Gloria 3'], unconfigured: 'Coach assignments, schedules, deadlines, and delivery mode must be checked by admin; Onsite is a provisional default.' };
  });
  console.log(JSON.stringify(result, null, 2));
} finally { await sql.end(); }
