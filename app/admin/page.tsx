import { requireRole } from '@/lib/auth';
import PortalComingSoon from '../portal-coming-soon';
import '../login/login.css';

export default async function AdminPage() {
  const session = await requireRole('admin');
  return <PortalComingSoon email={session.email} role={session.role} />;
}
