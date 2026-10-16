import 'server-only';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';
import { readSession, signSession, type Session, type Role } from './session-token';

export type { Role, Session } from './session-token';
export const SESSION_COOKIE = 'krya_session';

function secret() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters');
  return process.env.SESSION_SECRET;
}

export async function createSessionToken(email: string, role: Role) {
  const session: Session = { id: randomUUID(), email, role, exp: Date.now() + 8 * 60 * 60 * 1000 };
  const token = signSession(session, secret());
  await db().begin(async (tx) => {
    const [user] = await tx`SELECT email FROM portal_users WHERE email = ${email} AND role = ${role} AND status = 'active' FOR SHARE`;
    if (!user) throw new Error('Account unavailable');
    await tx`DELETE FROM portal_sessions WHERE expires_at <= NOW()`;
    await tx`INSERT INTO portal_sessions (id, email, expires_at) VALUES (${session.id}, ${email}, ${new Date(session.exp)})`;
  });
  return token;
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = readSession(token, secret());
  if (!session) return null;
  const [user] = await db()`SELECT u.role FROM portal_sessions s JOIN portal_users u ON u.email = s.email
    WHERE s.id = ${session.id} AND s.email = ${session.email} AND s.expires_at > NOW() AND u.status = 'active'`;
  return user?.role === session.role ? session : null;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

export async function requireRole(role: Role) {
  const session = await requireSession();
  if (session.role !== role) redirect(`/${session.role}`);
  return session;
}

export async function revokeCurrentSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token && readSession(token, secret());
  if (session) await db()`DELETE FROM portal_sessions WHERE id = ${session.id} AND email = ${session.email}`;
}
