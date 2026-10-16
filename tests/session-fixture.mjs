import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../lib/session-token.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
export const { signSession, readSession } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const sessions = [];

export async function fixtureSession(sql, email, role) {
  const session = { id: randomUUID(), email, role, exp: Date.now() + 3600000 };
  await sql`INSERT INTO portal_sessions (id, email, expires_at) VALUES (${session.id}, ${email}, ${new Date(session.exp)})`;
  sessions.push(session.id);
  return signSession(session, process.env.SESSION_SECRET);
}

export async function clearFixtureSessions(sql) {
  if (sessions.length) await sql`DELETE FROM portal_sessions WHERE id IN ${sql(sessions)}`;
}
