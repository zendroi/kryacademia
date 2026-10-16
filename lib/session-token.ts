import { createHmac, timingSafeEqual } from 'node:crypto';

export type Role = 'teacher' | 'admin';
export type Session = { id: string; email: string; role: Role; exp: number };

export function signSession(session: Session, secret: string) {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}

export function readSession(token: string, secret: string): Session | null {
  if (token.length > 2048) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts.every((part) => /^[\w-]+$/.test(part))) return null;
  const [payload, supplied] = parts;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return session && typeof session.id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(session.id) &&
      typeof session.email === 'string' && session.email.length <= 254 && ['admin', 'teacher'].includes(session.role) &&
      Number.isSafeInteger(session.exp) && session.exp > Date.now() ? session : null;
  } catch { return null; }
}
