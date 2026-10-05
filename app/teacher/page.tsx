import { requireRole } from '@/lib/auth';
import PortalComingSoon from '../portal-coming-soon';
import '../login/login.css';

export default async function TeacherPage() {
  const session = await requireRole('teacher');
  return <PortalComingSoon email={session.email} role={session.role} />;
}
