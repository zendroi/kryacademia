'use client';
import { useState, type FormEvent } from 'react';
import { Check, RefreshCw, ShieldCheck, ShieldOff, X } from 'lucide-react';
import AnimatedInput from '@/components/smoothui/animated-input';
import type { AccountAction, TeacherAccount } from '@/lib/accounts';
import { TeacherSelect } from '../teacher/TeachingControls';
import { provisionTeacherAccount, refreshTeacherAccounts, renewTeacherInvitation, reviewTeacherAccount } from './account-actions';

export default function TeacherAccounts({ accounts, onChanged, unavailable, query }: { accounts: TeacherAccount[]; onChanged: (accounts: TeacherAccount[]) => void; unavailable: boolean; query: string }) {
  const [status, setStatus] = useState('All');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(unavailable ? 'Teacher accounts are unavailable. Refresh to retry.' : '');
  const [message, setMessage] = useState('');
  const [invitation, setInvitation] = useState('');
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    setPending(true); setError(''); setInvitation('');
    try {
      const result = await provisionTeacherAccount(new FormData(form));
      if (!result.ok) { setError(result.error); return; }
      setInvitation(new URL(result.invitation, window.location.origin).href);
      setMessage(`Account created for ${result.email}. Share the invitation and login details privately.`);
      form.reset();
      const refreshed = await refreshTeacherAccounts();
      if (refreshed.ok) onChanged(refreshed.accounts); else setError('Account created. Keep the invitation below, then refresh accounts.');
    } catch { setError('Could not complete the request. Refresh accounts before retrying.'); }
    finally { setPending(false); }
  }
  async function renew(account: TeacherAccount) {
    setPending(true); setError('');
    try {
      const result = await renewTeacherInvitation(account.id, account.revision);
      if (!result.ok) { setError(result.error); return; }
      setInvitation(new URL(result.invitation, window.location.origin).href);
      onChanged(accounts.map((item) => item.id === account.id ? { ...item, revision: item.revision + 1 } : item));
      setMessage('New invitation created. The previous invitation no longer works.');
    } catch { setError('Could not renew the invitation. Refresh accounts before retrying.'); }
    finally { setPending(false); }
  }
  async function refresh() {
    setPending(true); setError('');
    try { const result = await refreshTeacherAccounts(); if (result.ok) onChanged(result.accounts); else setError(result.error); }
    catch { setError('Could not refresh teacher accounts.'); }
    finally { setPending(false); }
  }
  async function review(event: FormEvent<HTMLFormElement>, account: TeacherAccount) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') as AccountAction;
    setPending(true); setError(''); setMessage('');
    try {
      const result = await reviewTeacherAccount(account.id, account.revision, action, String(form.get('note') || ''));
      if (result.ok) { onChanged(accounts.map((item) => item.id === account.id ? { ...item, ...result.account } : item)); setMessage('Account updated. Previous sessions have been revoked.'); }
      else setError(result.error);
    } catch { setError('Could not update this account. Refresh before retrying.'); }
    finally { setPending(false); }
  }
  const filtered = accounts.filter((account) => (status === 'All' || account.status === status) && `${account.name} ${account.email}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="teacher-account-list">
    <form className="admin-record-form" onSubmit={create}><h2>Create teacher account</h2><fieldset disabled={pending || unavailable} className="catalog-fields"><AnimatedInput className="admin-animated-input" label="Teacher name" name="name" required maxLength={120} /><AnimatedInput className="admin-animated-input" label="Teacher login email" name="email" type="email" required maxLength={254} /><AnimatedInput className="admin-animated-input" label="Initial password (15+ characters)" name="password" type="password" autoComplete="new-password" required minLength={15} maxLength={72} /><button type="submit" className="admin-primary-action"><Check size={16} />Create account & invitation</button></fieldset></form>
    {invitation && <label className="admin-text-field"><span>Registration invitation / valid for 48 hours</span><input aria-label="Registration invitation" readOnly value={invitation} onFocus={(event) => event.target.select()} /></label>}
    <div className="admin-data-tools"><TeacherSelect label="Account status" value={status} options={['All', 'pending', 'active', 'suspended', 'rejected'].map((id) => ({ id, label: id }))} onChange={setStatus} /><button type="button" className="admin-secondary-action" disabled={pending} onClick={refresh}><RefreshCw size={17} />Refresh accounts</button></div>
    {error && <p role="alert" className="admin-form-error">{error}</p>}
    {message && <p role="status">{message}</p>}
    {!filtered.length && !error && <p>No matching teacher accounts.</p>}
    {filtered.map((account) => <details className="teacher-account-row" key={account.id}>
      <summary><span><strong>{account.name || account.email}</strong><small>{account.email}</small></span><span className={`admin-status status-${account.status}`}>{account.status}</span></summary>
      {account.identityId && <div className="teacher-account-private"><p>{account.bankName} / {account.bankAccount} / {account.accountHolder}</p><a href={`/api/teacher-identities/${account.identityId}`} target="_blank" rel="noopener noreferrer">View KTP photo</a></div>}
      {account.status === 'pending' && !account.onboardingComplete && <button type="button" className="admin-secondary-action" disabled={pending} onClick={() => void renew(account)}><RefreshCw size={16} />Renew registration invitation</button>}
      <form onSubmit={(event) => review(event, account)}><fieldset disabled={pending}><label><span>Review note</span><textarea name="note" aria-label={`Review note for ${account.email}`} maxLength={1000} defaultValue={account.note} rows={2} /></label><div className="teacher-account-actions">
        {account.status === 'pending' && <><button className="admin-primary-action" value="approve" type="submit"><Check size={16} />Approve</button><button className="admin-secondary-action" value="reject" type="submit"><X size={16} />Reject</button></>}
        {account.status === 'active' && <><button className="admin-secondary-action" value="suspend" type="submit"><ShieldOff size={16} />Suspend</button><button className="admin-secondary-action" value="revoke" type="submit"><ShieldCheck size={16} />Revoke sessions</button></>}
        {account.status === 'suspended' && <button className="admin-primary-action" value="reactivate" type="submit"><Check size={16} />Reactivate</button>}
      </div></fieldset></form>
    </details>)}
  </section>;
}
