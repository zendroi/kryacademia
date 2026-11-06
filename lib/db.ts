import 'server-only';
import postgres from 'postgres';
import { mysqlSql } from './mysql-tag.mjs';

let client: ReturnType<typeof postgres> | undefined;

export function db() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured');
  if (new URL(connectionString).protocol === 'mysql:') {
    client ??= mysqlSql(connectionString) as unknown as ReturnType<typeof postgres>;
    return client;
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(connectionString).hostname);
  client ??= postgres(connectionString, {
    max: 5,
    ssl: local ? false : 'verify-full',
  });
  return client;
}
