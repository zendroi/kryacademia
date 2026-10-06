import { requireRole } from '@/lib/auth';
import { loadTeachingRecords } from '@/lib/teaching';
import { loadInquiries } from '@/lib/inquiries';
import { loadAcademyCatalog } from '@/lib/academy-store';
import AdminDashboard from './AdminDashboard';
import './admin.css';
import '../teacher/teacher.css';

export default async function AdminPage() {
  const session = await requireRole('admin');
  const [teaching, inbox, catalog] = await Promise.allSettled([loadTeachingRecords(), loadInquiries(), loadAcademyCatalog()]);
  if (teaching.status === 'rejected') console.error('Teacher review queue load failed');
  if (inbox.status === 'rejected') console.error('Inquiry inbox load failed');
  if (catalog.status === 'rejected') console.error('Academy catalog load failed');
  return <AdminDashboard email={session.email}
    initialCatalog={catalog.status === 'fulfilled' ? catalog.value : { klasses: [], coaches: [], students: [], institutions: [] }} catalogUnavailable={catalog.status === 'rejected'}
    initialSubmissions={teaching.status === 'fulfilled' ? teaching.value : []} teachingUnavailable={teaching.status === 'rejected'}
    initialInquiries={inbox.status === 'fulfilled' ? inbox.value : []} inquiriesUnavailable={inbox.status === 'rejected'} />;
}
