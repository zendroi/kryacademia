import { workspace } from '@/lib/workspace';
import type { AccountAction } from '@/lib/accounts';
export const provisionTeacherAccount = (form: FormData) => workspace('accounts', Object.fromEntries(form));
export const refreshTeacherAccounts = () => workspace('accounts');
export const renewTeacherInvitation = (id: string, revision: number) => workspace('accounts/invitation', { id, revision });
export const reviewTeacherAccount = (id: string, revision: number, action: AccountAction, note: string) => workspace('accounts/review', { id, revision, action, note });
