import { requireRole } from '@/lib/auth';
import AdminDashboard from './AdminDashboard';
import './admin.css';

export default async function AdminPage() {
  const session = await requireRole('admin');
  return <AdminDashboard email={session.email} />;
}
