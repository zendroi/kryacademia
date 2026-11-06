'use server';
import { changeTeacherAccount, loadTeacherAccounts, type AccountAction } from '@/lib/accounts';
import { requireRole } from '@/lib/auth';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { portalLimit } from '@/lib/portal-limits';
import { hashPassword } from '@/lib/passwords.mjs';
import { clause, conflict } from '@/lib/sql-dialect.mjs';

export async function provisionTeacherAccount(form: FormData) {
  const admin = await requireRole('admin');
  try {
    if (!(form instanceof FormData)) throw new Error('Invalid account.');
    const email = String(form.get('email') || '').trim().toLowerCase();
    const name = String(form.get('name') || '').trim();
    const password = String(form.get('password') || '');
    if (!name || name.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 15 || Buffer.byteLength(password) > 72) throw new Error('Enter a name, valid email, and a password of at least 15 characters (maximum 72 bytes).');
    if (!(await portalLimit('accounts:create', admin.email, 20, 3600))) throw new Error('Too many new accounts. Please try again later.');
    const passwordHash = await hashPassword(password);
    const token = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(token).digest('hex');
    await db().begin(async (tx) => {
      if ((await tx`SELECT email FROM portal_users WHERE email = ${email} FOR UPDATE`).length) throw new Error('An account already uses this email.');
      await tx`INSERT INTO portal_users (email, display_name, password_hash, role, status) VALUES (${email}, ${name}, ${passwordHash}, 'teacher', 'pending')`;
      await tx`INSERT INTO teacher_onboarding (email, invitation_hash, expires_at) VALUES (${email}, ${hash}, CURRENT_TIMESTAMP(6) + ${clause(tx, "INTERVAL '48 hours'", 'INTERVAL 48 HOUR')})`;
      await tx`INSERT INTO portal_account_events (id, actor_email, target_email, action) VALUES (${randomUUID()}, ${admin.email}, ${email}, 'create')`;
    });
    return { ok: true as const, invitation: `/register?invitation=${token}`, email };
  } catch (error) { return { ok: false as const, error: error instanceof Error && !(error as { code?: string }).code ? error.message : 'Could not create the teacher account.' }; }
}

export async function refreshTeacherAccounts() {
  await requireRole('admin');
  try { return { ok: true as const, accounts: await loadTeacherAccounts() }; }
  catch { return { ok: false as const, error: 'Could not load teacher accounts.' }; }
}

export async function renewTeacherInvitation(id: string, revision: number) {
  const admin = await requireRole('admin');
  try {
    if (!/^\d{1,18}$/.test(id) || !Number.isSafeInteger(revision) || revision < 0) throw new Error('Invalid account.');
    if (!(await portalLimit('accounts:invite', admin.email, 20, 3600))) throw new Error('Too many invitations. Try again later.');
    const token = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(token).digest('hex');
    await db().begin(async (tx) => {
      const [user] = await tx`SELECT email FROM portal_users WHERE id = ${id} AND role = 'teacher' AND status = 'pending' AND revision = ${revision} FOR UPDATE`;
      if (!user) throw new Error('This account changed. Refresh accounts.');
      if ((await tx`SELECT email FROM teacher_onboarding WHERE email = ${user.email} AND completed_at IS NOT NULL FOR UPDATE`).length) throw new Error('Registration is already complete.');
      await tx`INSERT INTO teacher_onboarding (email, invitation_hash, expires_at) VALUES (${user.email}, ${hash}, CURRENT_TIMESTAMP(6) + ${clause(tx, "INTERVAL '48 hours'", 'INTERVAL 48 HOUR')}) ${conflict(tx, 'email', 'invitation_hash = EXCLUDED.invitation_hash, expires_at = EXCLUDED.expires_at')}`;
      await tx`UPDATE portal_users SET revision = revision + 1 WHERE id = ${id}`;
      await tx`INSERT INTO portal_account_events (id, actor_email, target_email, action) VALUES (${randomUUID()}, ${admin.email}, ${user.email}, 'invite')`;
    });
    return { ok: true as const, invitation: `/register?invitation=${token}` };
  } catch (error) { return { ok: false as const, error: error instanceof Error && !(error as { code?: string }).code ? error.message : 'Could not renew the invitation.' }; }
}

export async function reviewTeacherAccount(id: string, revision: number, action: AccountAction, note: string) {
  await requireRole('admin');
  try { return { ok: true as const, account: await changeTeacherAccount(id, revision, action, note) }; }
  catch (error) { return { ok: false as const, error: error instanceof Error && !(error as { code?: string }).code ? error.message : 'Could not update this account. Please retry.' }; }
}
