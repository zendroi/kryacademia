import { createHash } from 'node:crypto';

export const isMySQL = (sql) => sql.dialect === 'mysql';
export const clause = (sql, pg, mysql) => sql.unsafe(isMySQL(sql) ? mysql : pg);
export function textColumn(sql, column) {
  if (!/^[a-z_]+(?:\.[a-z_]+)?$/i.test(column)) throw new Error('Invalid column.');
  if (!isMySQL(sql)) return sql.unsafe(`${column}::text`);
  return sql.unsafe(column.endsWith('_at') ? `DATE_FORMAT(${column}, '%Y-%m-%dT%H:%i:%s.%fZ')` : `CAST(${column} AS CHAR)`);
}
export function conflict(sql, keys, updates) {
  return clause(sql, `ON CONFLICT (${keys}) DO ${updates ? `UPDATE SET ${updates}` : 'NOTHING'}`,
    updates ? `ON DUPLICATE KEY UPDATE ${updates.replace(/EXCLUDED\.([a-z_]+)/g, 'VALUES($1)')}` : `ON DUPLICATE KEY UPDATE ${keys.split(',')[0]} = ${keys.split(',')[0]}`);
}
export async function lockScope(sql, scope) {
  if (!isMySQL(sql)) { await sql`SELECT pg_advisory_xact_lock(hashtextextended(${scope}, 0))`; return; }
  const key = createHash('sha256').update(scope).digest('hex');
  await sql`INSERT INTO portal_locks (id) VALUES (${key}) ON DUPLICATE KEY UPDATE id = id`;
  await sql`SELECT id FROM portal_locks WHERE id = ${key} FOR UPDATE`;
}
