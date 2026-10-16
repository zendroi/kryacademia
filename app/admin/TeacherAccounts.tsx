'use client';
import { useState, type FormEvent } from 'react';
import { Check, RefreshCw, ShieldCheck, ShieldOff, X } from 'lucide-react';
import type { AccountAction, TeacherAccount } from '@/lib/accounts';
import { TeacherSelect } from '../teacher/TeachingControls';
import { refreshTeacherAccounts, reviewTeacherAccount } from './account-actions';

export default function TeacherAccounts({ accounts, onChanged, unavailable, query }: { accounts: TeacherAccount[]; onChanged: (accounts: TeacherAccount[]) => void; unavailable: boolean; query: string }) {
  const [status, setStatus] = useState('All');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(unavailable ? 'Teacher accounts are unavailable. Refresh to retry.' : '');
  const [message, setMessage] = useState('');
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
      if (result.ok) { onChanged(accounts.map((item) => item.id === account.id ? result.account : item)); setMessage('Account updated. Previous sessions have been revoked.'); }
      else setError(result.error);
    } catch { setError('Could not update this account. Refresh before retrying.'); }
    finally { setPending(false); }
  }
  const filtered = accounts.filter((account) => (status === 'All' || account.status === status) && `${account.name} ${account.email}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="teacher-account-list">
    <div className="admin-data-tools"><TeacherSelect label="Account status" value={status} options={['All', 'pending', 'active', 'suspended', 'rejected'].map((id) => ({ id, label: id }))} onChange={setStatus} /><button type="button" className="admin-secondary-action" disabled={pending} onClick={refresh}><RefreshCw size={17} />Refresh accounts</button></div>
    {error && <p role="alert" className="admin-form-error">{error}</p>}
    {message && <p role="status">{message}</p>}
    {!filtered.length && !error && <p>No matching teacher accounts.</p>}
    {filtered.map((account) => <details className="teacher-account-row" key={account.id}>
      <summary><span><strong>{account.name || account.email}</strong><small>{account.email}</small></span><span className={`admin-status status-${account.status}`}>{account.status}</span></summary>
      <form onSubmit={(event) => review(event, account)}><fieldset disabled={pending}><label><span>Review note</span><textarea name="note" aria-label={`Review note for ${account.email}`} maxLength={1000} defaultValue={account.note} rows={2} /></label><div className="teacher-account-actions">
        {account.status === 'pending' && <><button className="admin-primary-action" value="approve" type="submit"><Check size={16} />Approve</button><button className="admin-secondary-action" value="reject" type="submit"><X size={16} />Reject</button></>}
        {account.status === 'active' && <><button className="admin-secondary-action" value="suspend" type="submit"><ShieldOff size={16} />Suspend</button><button className="admin-secondary-action" value="revoke" type="submit"><ShieldCheck size={16} />Revoke sessions</button></>}
        {account.status === 'suspended' && <button className="admin-primary-action" value="reactivate" type="submit"><Check size={16} />Reactivate</button>}
      </div></fieldset></form>
    </details>)}
  </section>;
}
