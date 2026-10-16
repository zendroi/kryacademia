import 'server-only';
import postgres from 'postgres';

let client: ReturnType<typeof postgres> | undefined;

export function db() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(connectionString).hostname);
  client ??= postgres(connectionString, {
    max: 5,
    ssl: local ? false : 'verify-full',
  });
  return client;
}
