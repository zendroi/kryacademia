'use server';
import { changeTeacherAccount, loadTeacherAccounts, type AccountAction } from '@/lib/accounts';
import { requireRole } from '@/lib/auth';

export async function refreshTeacherAccounts() {
  await requireRole('admin');
  try { return { ok: true as const, accounts: await loadTeacherAccounts() }; }
  catch { return { ok: false as const, error: 'Could not load teacher accounts.' }; }
}

export async function reviewTeacherAccount(id: string, revision: number, action: AccountAction, note: string) {
  await requireRole('admin');
  try { return { ok: true as const, account: await changeTeacherAccount(id, revision, action, note) }; }
  catch (error) { return { ok: false as const, error: error instanceof Error && !(error as { code?: string }).code ? error.message : 'Could not update this account. Please retry.' }; }
}
