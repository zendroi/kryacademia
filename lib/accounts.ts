import 'server-only';
import { textColumn } from './sql-dialect.mjs';
import { randomUUID } from 'node:crypto';
import { db } from './db';
import { requireRole } from './auth';

export type TeacherAccount = { id: string; email: string; name: string; status: 'pending' | 'active' | 'suspended' | 'rejected'; revision: number; note: string; createdAt: string; onboardingComplete?: boolean; bankName?: string; bankAccount?: string; accountHolder?: string; identityId?: string };
export type AccountAction = 'approve' | 'reject' | 'suspend' | 'reactivate' | 'revoke';

export async function loadTeacherAccounts(): Promise<TeacherAccount[]> {
  await requireRole('admin');
  return db()<TeacherAccount[]>`SELECT ${textColumn(db(), 'u.id')} AS id, u.email, u.display_name AS name, u.status, u.revision, u.review_note AS note, ${textColumn(db(), 'u.created_at')} AS "createdAt",
    o.completed_at IS NOT NULL AS "onboardingComplete", o.bank_name AS "bankName", o.bank_account AS "bankAccount", o.account_holder AS "accountHolder", ${textColumn(db(), 'o.identity_object_id')} AS "identityId"
    FROM portal_users u LEFT JOIN teacher_onboarding o ON o.email = u.email WHERE u.role = 'teacher' ORDER BY (u.status = 'pending') DESC, u.created_at DESC`
    .then((rows) => rows.map((row) => ({ ...row, onboardingComplete: Number(row.onboardingComplete) === 1 })));
}

export async function changeTeacherAccount(id: string, revision: number, action: AccountAction, note: string) {
  const admin = await requireRole('admin');
  if (typeof id !== 'string' || !/^\d{1,18}$/.test(id) || !Number.isSafeInteger(revision) || revision < 0 || !['approve', 'reject', 'suspend', 'reactivate', 'revoke'].includes(action) || typeof note !== 'string' || note.length > 1000 || (['reject', 'suspend'].includes(action) && !note.trim())) throw new Error('Check the account action and review note.');
  return db().begin(async (tx) => {
    const [user] = await tx`SELECT email, status, revision FROM portal_users WHERE id = ${id} AND role = 'teacher' FOR UPDATE`;
    const from = { approve: 'pending', reject: 'pending', suspend: 'active', reactivate: 'suspended', revoke: 'active' };
    if (!user || user.revision !== revision || user.status !== from[action]) throw new Error('This account changed. Refresh before retrying.');
    if (action === 'approve' && (await tx`SELECT email FROM teacher_onboarding WHERE email = ${user.email} AND completed_at IS NULL`).length) throw new Error('The teacher must complete their identity and bank details first.');
    const status = { approve: 'active', reject: 'rejected', suspend: 'suspended', reactivate: 'active', revoke: 'active' }[action];
    await tx`UPDATE portal_users SET status = ${status}, revision = revision + 1, review_note = ${note.trim()} WHERE id = ${id}`;
    const [account] = await tx<TeacherAccount[]>`SELECT ${textColumn(tx, 'id')} AS id, email, display_name AS name, status, revision, review_note AS note, ${textColumn(tx, 'created_at')} AS "createdAt" FROM portal_users WHERE id = ${id}`;
    await tx`DELETE FROM portal_sessions WHERE email = ${user.email}`;
    await tx`INSERT INTO portal_account_events (id, actor_email, target_email, action, note) VALUES (${randomUUID()}, ${admin.email}, ${user.email}, ${action}, ${note.trim()})`;
    return account;
  });
}
