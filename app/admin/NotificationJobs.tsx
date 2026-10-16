'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
import type { NotificationJob } from '@/lib/notifications';
import { refreshNotificationJobs, retryNotificationJob } from './notification-actions';

export default function NotificationJobs({ query }: { query: string }) {
  const [jobs, setJobs] = useState<NotificationJob[]>([]);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    refreshNotificationJobs().then((result) => { if (active) { if (result.ok) setJobs(result.jobs); else setError(result.error); } })
      .catch(() => { if (active) setError('Could not load delivery jobs.'); }).finally(() => { if (active) setPending(false); });
    return () => { active = false; };
  }, []);
  async function refresh(id?: string) {
    setPending(true); setError('');
    try {
      const result = id ? await retryNotificationJob(id) : await refreshNotificationJobs();
      if (result.ok) setJobs(result.jobs); else setError(result.error);
    } catch { setError('Could not update delivery jobs.'); }
    finally { setPending(false); }
  }
  const filtered = jobs.filter((job) => `${job.teacherEmail} ${job.title} ${job.status}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="teacher-review-queue" aria-label="Delivery jobs">
    <header className="teacher-section-head"><div><span>Dashboard notifications</span><h2>Recent delivery jobs</h2></div><button className="admin-secondary-action" type="button" disabled={pending} onClick={() => void refresh()}><RefreshCw size={16} />Refresh jobs</button></header>
    {error && <p className="admin-form-error" role="alert">{error}</p>}
    {pending && <p role="status">Loading delivery jobs...</p>}
    <div className="admin-table-wrap"><table><thead><tr><th>Teacher</th><th>Notification</th><th>Status</th><th>Attempts</th><th>Delivery</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filtered.map((job) => <tr key={job.id}><td>{job.teacherEmail}</td><td><strong>{job.title}</strong><small>{new Date(job.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta' })}</small></td><td><span className={`admin-status status-${job.status}`}>{job.status}</span></td><td>{job.attempts} / 5</td><td>{job.lastError || (job.status === 'pending' ? `Next attempt: ${new Date(job.availableAt).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta' })}` : 'Dashboard')}</td><td>{job.status === 'failed' && <button className="admin-icon-button" disabled={pending} type="button" title="Retry delivery" aria-label={`Retry ${job.title}`} onClick={() => void refresh(job.id)}><RotateCcw size={17} /></button>}</td></tr>)}</tbody></table></div>
    {!pending && !error && !filtered.length && <p className="detail-muted">{jobs.length ? 'No matching jobs.' : 'No delivery jobs yet.'}</p>}
  </section>;
}
