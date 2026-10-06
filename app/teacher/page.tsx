import { requireRole } from '@/lib/auth';
import { loadTeachingRecords, loadTeacherNotifications, teachingConfig } from '@/lib/teaching';
import { loadTeachingCatalog } from '@/lib/academy-store';
import type { TeachingCatalog } from '@/lib/academy';
import TeacherDashboard from './TeacherDashboard';
import type { TeachingRecord, TeacherNotification } from './teacherData';
import '../admin/admin.css';
import './teacher.css';

export default async function TeacherPage() {
  const session = await requireRole('teacher');
  const config = teachingConfig();
  let records: TeachingRecord[] = [];
  let notifications: TeacherNotification[] = [];
  let catalog: TeachingCatalog = { klasses: [], students: [] };
  let storageError = false;
  try {
    [records, notifications, catalog] = await Promise.all([loadTeachingRecords(session.email), loadTeacherNotifications(session.email), loadTeachingCatalog(session.email)]);
  } catch (error) {
    console.error('Teacher workspace load failed', error instanceof Error ? error.message : 'Unknown error');
    storageError = true;
  }
  return <TeacherDashboard email={session.email} initialCatalog={catalog} initialRecords={records} initialNotifications={notifications} config={config} storageError={storageError} />;
}
