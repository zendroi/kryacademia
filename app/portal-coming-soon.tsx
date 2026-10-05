import Image from 'next/image';
import Link from 'next/link';
import { logout } from './login/actions';
import type { Role } from '@/lib/auth';

export default function PortalComingSoon({ email, role }: { email: string; role: Role }) {
  const label = role === 'admin' ? 'Admin' : 'Teacher';
  return <main className="auth-page">
    <Link className="auth-brand" href="/" aria-label="KRYAcademia home"><Image src="/kryacademia-logo.png" width={52} height={56} alt="" priority /><strong>KRYAcademia</strong></Link>
    <div className="auth-art" aria-hidden="true"><b>21</b></div>
    <section className="auth-panel portal-panel">
      <span>{label} Portal</span>
      <h1>Coming<br /><em>Soon.</em></h1>
      <p>We are preparing a dedicated KRYAcademia workspace for {label.toLowerCase()} accounts.</p>
      <small>Signed in as {email}</small>
      <div className="portal-actions"><Link href="/">Back to Website</Link><form action={logout}><button type="submit">Log Out</button></form></div>
    </section>
    <footer>THE 21ST EDUCATION CENTER</footer>
  </main>;
}
