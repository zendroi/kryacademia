import { requireRole } from '@/lib/auth';
import { loadTeachingRecords, loadTeacherNotifications, teachingConfig } from '@/lib/teaching';
import TeacherDashboard from './TeacherDashboard';
import type { TeachingRecord, TeacherNotification } from './teacherData';
import '../admin/admin.css';
import './teacher.css';

export default async function TeacherPage() {
  const session = await requireRole('teacher');
  const config = teachingConfig();
  let records: TeachingRecord[] = [];
  let notifications: TeacherNotification[] = [];
  let storageError = false;
  try {
    [records, notifications] = await Promise.all([loadTeachingRecords(session.email), loadTeacherNotifications(session.email)]);
  } catch (error) {
    console.error('Teacher workspace load failed', error instanceof Error ? error.message : 'Unknown error');
    storageError = true;
  }
  return <TeacherDashboard email={session.email} initialRecords={records} initialNotifications={notifications} config={config} storageError={storageError} />;
}
