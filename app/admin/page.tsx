import { requireRole } from '@/lib/auth';
import { loadTeachingRecords } from '@/lib/teaching';
import AdminDashboard from './AdminDashboard';
import './admin.css';
import '../teacher/teacher.css';
import type { TeachingRecord } from '../teacher/teacherData';

export default async function AdminPage() {
  const session = await requireRole('admin');
  let submissions: TeachingRecord[] = [];
  let teachingUnavailable = false;
  try {
    submissions = await loadTeachingRecords();
  } catch (error) {
    console.error('Teacher review queue load failed', error instanceof Error ? error.message : 'Unknown error');
    teachingUnavailable = true;
  }
  return <AdminDashboard email={session.email} initialSubmissions={submissions} teachingUnavailable={teachingUnavailable} />;
}
