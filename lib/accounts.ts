import 'server-only';
import { randomUUID } from 'node:crypto';
import { db } from './db';
import { requireRole } from './auth';

export type TeacherAccount = { id: string; email: string; name: string; status: 'pending' | 'active' | 'suspended' | 'rejected'; revision: number; note: string; createdAt: string };
export type AccountAction = 'approve' | 'reject' | 'suspend' | 'reactivate' | 'revoke';

export async function loadTeacherAccounts(): Promise<TeacherAccount[]> {
  await requireRole('admin');
  return db()<TeacherAccount[]>`SELECT id::text, email, display_name AS name, status, revision, review_note AS note, created_at::text AS "createdAt"
    FROM portal_users WHERE role = 'teacher' ORDER BY (status = 'pending') DESC, created_at DESC`;
}

export async function changeTeacherAccount(id: string, revision: number, action: AccountAction, note: string) {
  const admin = await requireRole('admin');
  if (typeof id !== 'string' || !/^\d{1,18}$/.test(id) || !Number.isSafeInteger(revision) || revision < 0 || !['approve', 'reject', 'suspend', 'reactivate', 'revoke'].includes(action) || typeof note !== 'string' || note.length > 1000 || (['reject', 'suspend'].includes(action) && !note.trim())) throw new Error('Check the account action and review note.');
  return db().begin(async (tx) => {
    const [user] = await tx`SELECT email, status, revision FROM portal_users WHERE id = ${id} AND role = 'teacher' FOR UPDATE`;
    const from = { approve: 'pending', reject: 'pending', suspend: 'active', reactivate: 'suspended', revoke: 'active' };
    if (!user || user.revision !== revision || user.status !== from[action]) throw new Error('This account changed. Refresh before retrying.');
    const status = { approve: 'active', reject: 'rejected', suspend: 'suspended', reactivate: 'active', revoke: 'active' }[action];
    const [account] = await tx<TeacherAccount[]>`UPDATE portal_users SET status = ${status}, revision = revision + 1, review_note = ${note.trim()}
      WHERE id = ${id} RETURNING id::text, email, display_name AS name, status, revision, review_note AS note, created_at::text AS "createdAt"`;
    await tx`DELETE FROM portal_sessions WHERE email = ${user.email}`;
    await tx`INSERT INTO portal_account_events (id, actor_email, target_email, action, note) VALUES (${randomUUID()}, ${admin.email}, ${user.email}, ${action}, ${note.trim()})`;
    return account;
  });
}
